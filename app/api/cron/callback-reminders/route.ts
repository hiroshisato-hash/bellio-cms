import { NextRequest, NextResponse } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

type Row = {
  id: string
  tenant_id: string
  caller_number: string
  caller_name: string | null
  purpose: string | null
  created_at?: string
  preferred_callback_at?: string | null
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '未定'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function postSlack(url: string, text: string) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch (err) {
    console.error('[cron] slack post failed', err)
  }
}

// Vercel Cron で定期実行（vercel.json の crons 参照）。
//  1) 受信から30分以上 未対応(pending) → 「未対応です」リマインド（reminded_at で重複防止）
//  2) 折返し希望時刻の5分前 → 「お電話するお時間です」リマインド（due_reminded_at で重複防止）
// staff向け通知は tenant_settings.notification_channels.slack に送る（SMSは発信者向けのため使わない）。
export async function GET(req: NextRequest) {
  // Vercel Cron は CRON_SECRET 設定時に Authorization: Bearer <secret> を付与する
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supa = db()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const overdueBefore = new Date(now - 30 * 60 * 1000).toISOString() // 30分前
  const dueWithin = new Date(now + 5 * 60 * 1000).toISOString()      // 5分後まで
  const dueGrace = new Date(now - 30 * 60 * 1000).toISOString()      // 古すぎる予定は対象外
  const origin = new URL(req.url).origin

  const [{ data: overdue }, { data: dueSoon }] = await Promise.all([
    supa
      .from('callback_requests')
      .select('id, tenant_id, caller_number, caller_name, purpose, created_at')
      .eq('status', 'pending')
      .lte('created_at', overdueBefore)
      .is('reminded_at', null)
      .limit(100),
    supa
      .from('callback_requests')
      .select('id, tenant_id, caller_number, caller_name, purpose, preferred_callback_at')
      .in('status', ['pending', 'in_progress'])
      .not('preferred_callback_at', 'is', null)
      .lte('preferred_callback_at', dueWithin)
      .gte('preferred_callback_at', dueGrace)
      .is('due_reminded_at', null)
      .limit(100),
  ])

  const overdueRows = (overdue ?? []) as Row[]
  const dueRows = (dueSoon ?? []) as Row[]

  if (overdueRows.length === 0 && dueRows.length === 0) {
    return NextResponse.json({ ok: true, overdue: 0, dueSoon: 0 })
  }

  // 対象テナントの Slack URL と会社名をまとめて取得
  const tenantIds = [...new Set([...overdueRows, ...dueRows].map(r => r.tenant_id))]
  const [{ data: settings }, { data: tenants }] = await Promise.all([
    supa.from('tenant_settings').select('tenant_id, notification_channels').in('tenant_id', tenantIds),
    supa.from('tenants').select('id, company_name').in('id', tenantIds),
  ])

  const slackMap = new Map<string, string>()
  for (const s of settings ?? []) {
    const url = (s.notification_channels as { slack?: string } | null)?.slack
    if (url) slackMap.set(s.tenant_id as string, url)
  }
  const nameMap = new Map<string, string>()
  for (const t of tenants ?? []) nameMap.set(t.id as string, t.company_name as string)

  let overdueSent = 0
  for (const cb of overdueRows) {
    const slack = slackMap.get(cb.tenant_id)
    if (!slack) continue
    const company = nameMap.get(cb.tenant_id) ?? ''
    const link = `${origin}/callbacks/${cb.id}`
    await postSlack(
      slack,
      `⏰ 未対応の折り返しがあります [${company}]\n` +
      `発信者: ${cb.caller_name ?? cb.caller_number}\n` +
      `用件: ${cb.purpose ?? '未記入'}\n` +
      `受信から30分以上 未対応です。\n対応はこちら → ${link}`,
    )
    await supa.from('callback_requests').update({ reminded_at: nowIso }).eq('id', cb.id)
    overdueSent++
  }

  let dueSent = 0
  for (const cb of dueRows) {
    const slack = slackMap.get(cb.tenant_id)
    if (!slack) continue
    const company = nameMap.get(cb.tenant_id) ?? ''
    const link = `${origin}/callbacks/${cb.id}`
    await postSlack(
      slack,
      `🔔 まもなく折り返しのお時間です [${company}]\n` +
      `${cb.caller_name ?? cb.caller_number} 様 (${cb.caller_number}) に ${formatTime(cb.preferred_callback_at)} のお約束です。\n` +
      `対応はこちら → ${link}`,
    )
    await supa.from('callback_requests').update({ due_reminded_at: nowIso }).eq('id', cb.id)
    dueSent++
  }

  return NextResponse.json({ ok: true, overdue: overdueSent, dueSoon: dueSent })
}
