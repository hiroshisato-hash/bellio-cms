import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'
const TENANT_COOKIE = 'bellio-view-tenant'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function getCurrentTenantId(userEmail: string | null | undefined): Promise<string | null> {
  const cookieStore = await cookies()

  // adminがテナント切替中
  if (userEmail === SUPER_ADMIN_EMAIL) {
    const viewTenant = cookieStore.get(TENANT_COOKIE)?.value
    if (viewTenant) return viewTenant
    // cookieなし→adminはテナント画面を持たない
    return null
  }

  // 通常ユーザー: is_active=trueの最初のテナントを返す
  const { data } = await adminDb()
    .from('tenants')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  return data?.id ?? null
}
