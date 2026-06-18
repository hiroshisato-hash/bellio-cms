import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

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

  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'email が必要です' }, { status: 400 })
  }

  // Supabase invite → 招待メールを送信（ユーザーがリンクをクリックしてパスワード設定）
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/invite`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  const json = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: json.msg ?? json.message ?? '招待メール送信失敗' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: json.id, email: json.email })
}
