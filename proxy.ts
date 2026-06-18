import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 認証不要ルート
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return await updateSession(request)
  }

  const res = await updateSession(request)

  // 未認証 → ログインへ
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const cookieHeader = request.headers.get('cookie') ?? ''
  const accessToken = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/)?.[1]

  if (!accessToken && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
