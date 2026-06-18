import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'
const TENANT_COOKIE = 'bellio-view-tenant'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tenantId } = await req.json()
  const res = NextResponse.json({ ok: true })

  if (tenantId) {
    res.cookies.set(TENANT_COOKIE, tenantId, { path: '/', httpOnly: true, sameSite: 'lax' })
  } else {
    res.cookies.delete(TENANT_COOKIE)
  }

  return res
}
