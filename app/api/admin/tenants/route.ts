import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

async function getAdminSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: async () => (await cookies()).getAll() } },
  )
}

async function assertAdmin(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await (supabase as Awaited<ReturnType<typeof getAdminSupabase>>).auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) return false
  return true
}

export async function POST(req: NextRequest) {
  const supabase = await getAdminSupabase()
  if (!await assertAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { company_name, phone_number, plan, is_active } = await req.json()

  const { data, error } = await supabase
    .from('tenants')
    .insert({ company_name, phone_number, plan, is_active })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // tenant_settings のデフォルト行を作成
  await supabase.from('tenant_settings').insert({
    tenant_id: data.id,
    greeting_text: `お電話ありがとうございます。${company_name}でございます。この通話は通話品質及びAIの向上のため録音させていただきます。ご用件をお聞かせください。`,
    mode: 'hybrid',
    faq_threshold: 0.75,
    urgent_keywords: ['緊急', '事故', '火事', '大至急'],
  })

  return NextResponse.json({ id: data.id })
}

export async function PUT(req: NextRequest) {
  const supabase = await getAdminSupabase()
  if (!await assertAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, company_name, phone_number, plan, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const { error } = await supabase
    .from('tenants')
    .update({ company_name, phone_number, plan, is_active })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
