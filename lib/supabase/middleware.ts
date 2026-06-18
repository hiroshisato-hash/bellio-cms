import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login')
  const isPublicAuthPage = pathname.startsWith('/forgot-password')
  const isAuthCallback = pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/line/')
  const isCron = pathname.startsWith('/api/cron')
  const isWebhook = pathname.startsWith('/api/webhook/')
  const isAdminRoute = pathname.startsWith('/admin')
  const isSignupPage = pathname.startsWith('/signup')
  const isLiff = pathname === '/l' || pathname.startsWith('/l/') || pathname.startsWith('/member/')

  if (!user && !isAuthPage && !isPublicAuthPage && !isAuthCallback && !isCron && !isWebhook && !isSignupPage && !isLiff) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (isAuthPage || isPublicAuthPage) && request.method === 'GET') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // /admin/* は super_admin のみアクセス可
  if (user && isAdminRoute) {
    const { data: role } = await supabase
      .from('user_salon_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .limit(1)
      .maybeSingle()

    if (!role) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
