import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: async () => (await cookies()).getAll() } },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tenantId, email, password } = await req.json()
  if (!tenantId || !email || !password) {
    return NextResponse.json({ error: 'tenantId / email / password が必要です' }, { status: 400 })
  }

  // Supabase Admin API でユーザー作成
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })

  const json = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: json.msg ?? json.message ?? 'ユーザー作成失敗' }, { status: 500 })
  }

  // tenant_users テーブルに紐付け（存在する場合）
  await supabase.from('tenant_users').upsert({
    tenant_id: tenantId,
    user_id: json.id,
  }).eq('tenant_id', tenantId).eq('user_id', json.id)

  return NextResponse.json({ ok: true, userId: json.id, email: json.email })
}
