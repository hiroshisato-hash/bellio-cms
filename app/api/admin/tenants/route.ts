import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

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

export async function POST(req: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { company_name, phone_number, plan, is_active } = await req.json()
  const db = adminDb()

  const { data, error } = await db
    .from('tenants')
    .insert({ company_name, phone_number, plan, is_active })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('tenant_settings').insert({
    tenant_id: data.id,
    greeting_text: `お電話ありがとうございます。${company_name}でございます。この通話は通話品質及びAIの向上のため録音させていただきます。ご用件をお聞かせください。`,
    mode: 'hybrid',
    faq_threshold: 0.75,
    urgent_keywords: ['緊急', '事故', '火事', '大至急'],
  })

  return NextResponse.json({ id: data.id })
}

export async function PUT(req: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, company_name, phone_number, plan, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const { error } = await adminDb()
    .from('tenants')
    .update({ company_name, phone_number, plan, is_active })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
