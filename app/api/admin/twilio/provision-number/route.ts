import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function assertAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === SUPER_ADMIN_EMAIL
}

interface TwilioAvailableNumber {
  phone_number: string
  friendly_name: string
}

interface TwilioIncomingNumber {
  sid: string
  phone_number: string
  voice_url: string
}

interface PurchaseInput {
  tenantId: string
  areaCode?: string
  contains?: string
}

function basicAuth(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
}

async function searchAvailable(
  accountSid: string,
  auth: string,
  filter: { areaCode?: string; contains?: string },
): Promise<TwilioAvailableNumber[]> {
  // Twilio JP API only exposes 'local' and 'toll_free' types. 050 (IP phone)
  // numbers live inside 'local' but the unfiltered top of the inventory
  // returns regional landlines (044/075/etc) instead. Force a Contains=50
  // filter so we only pick up actual 050 numbers, matching the proven
  // Bundle + Address combo. (Same constraint as callmint-cms.)
  const params = new URLSearchParams({ VoiceEnabled: 'true', PageSize: '5' })
  params.set('Contains', filter.contains ?? '50')
  if (filter.areaCode) params.set('AreaCode', filter.areaCode)

  const resp = await fetch(
    `${TWILIO_API_BASE}/Accounts/${accountSid}/AvailablePhoneNumbers/JP/Local.json?${params.toString()}`,
    { headers: { Authorization: auth } },
  )
  if (!resp.ok) {
    throw new Error(`twilio search failed: ${resp.status} ${await resp.text()}`)
  }
  const data = (await resp.json()) as { available_phone_numbers?: TwilioAvailableNumber[] }
  // Belt-and-suspenders: reject anything that doesn't start with +8150 so we
  // never accidentally buy a regional landline with mismatched address reqs.
  return (data.available_phone_numbers ?? []).filter((n) =>
    n.phone_number.startsWith('+8150'),
  )
}

async function purchaseNumber(
  accountSid: string,
  auth: string,
  params: {
    phoneNumber: string
    voiceUrl: string
    bundleSid: string
    addressSid?: string
    friendlyName: string
  },
): Promise<TwilioIncomingNumber> {
  const body = new URLSearchParams({
    PhoneNumber: params.phoneNumber,
    VoiceUrl: params.voiceUrl,
    VoiceMethod: 'POST',
    BundleSid: params.bundleSid,
    FriendlyName: params.friendlyName,
  })
  if (params.addressSid) body.set('AddressSid', params.addressSid)

  const resp = await fetch(
    `${TWILIO_API_BASE}/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
    {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  )
  if (!resp.ok) {
    throw new Error(`twilio purchase failed: ${resp.status} ${await resp.text()}`)
  }
  return (await resp.json()) as TwilioIncomingNumber
}

export async function POST(request: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const bundleSid = process.env.TWILIO_JP_BUNDLE_SID
  const addressSid = process.env.TWILIO_JP_ADDRESS_SID
  // bellio-voice の Twilio webhook ハンドラは `/twilio/voice`（src/server.ts）。
  // 別 URL を使いたい場合のみ TWILIO_VOICE_WEBHOOK_URL で上書きする。
  const voiceUrl =
    process.env.TWILIO_VOICE_WEBHOOK_URL ?? 'https://bellio-voice.fly.dev/twilio/voice'

  if (!accountSid || !authToken || !bundleSid) {
    return NextResponse.json(
      {
        error:
          'Twilio 設定が不足しています (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_JP_BUNDLE_SID)',
      },
      { status: 500 },
    )
  }

  let input: PurchaseInput
  try {
    input = (await request.json()) as PurchaseInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  if (!input.tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }

  const db = adminDb()
  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('id, company_name, phone_number')
    .eq('id', input.tenantId)
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: `tenant not found: ${input.tenantId}` }, { status: 404 })
  }

  const auth = basicAuth(accountSid, authToken)

  let candidates: TwilioAvailableNumber[]
  try {
    candidates = await searchAvailable(accountSid, auth, {
      areaCode: input.areaCode,
      contains: input.contains,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: '在庫がありませんでした。areaCode / contains を変えて再試行してください' },
      { status: 404 },
    )
  }

  const picked = candidates[0]

  let purchased: TwilioIncomingNumber
  try {
    purchased = await purchaseNumber(accountSid, auth, {
      phoneNumber: picked.phone_number,
      voiceUrl,
      bundleSid,
      addressSid,
      friendlyName: tenant.id,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  // bellio-voice の fetchTenantByPhone は Twilio の `To`（E.164 +8150...）と
  // tenants.phone_number を完全一致で照合する（src/cms.ts）。よって取得番号は
  // E.164 のまま保存する。phone_number は単一 UNIQUE 列なので上書き。
  const e164 = purchased.phone_number
  const { error: updateError } = await db
    .from('tenants')
    .update({ phone_number: e164 })
    .eq('id', tenant.id)

  if (updateError) {
    // 番号は取得済みだが DB 更新に失敗。管理者が手動回復できるよう両方返す。
    return NextResponse.json(
      {
        error: `Twilio 番号は取得済みですが DB 更新に失敗: ${updateError.message}`,
        purchased: { sid: purchased.sid, phone_number: purchased.phone_number },
      },
      { status: 500 },
    )
  }

  console.log(
    `[twilio/provision] tenant=${tenant.id} purchased=${e164} sid=${purchased.sid}`,
  )

  return NextResponse.json({
    ok: true,
    tenantId: tenant.id,
    phoneNumber: e164,
    twilioSid: purchased.sid,
    voiceUrl: purchased.voice_url,
  })
}
