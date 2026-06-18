import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import TenantForm from '../TenantForm'

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: async () => (await cookies()).getAll() } },
  )

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single()

  if (!tenant) notFound()

  const { data: authUsers } = await supabase
    .from('tenant_users')
    .select('user_id, email:auth_users(email)')
    .eq('tenant_id', id)
    .limit(10)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{tenant.company_name}</h1>
      <p className="text-slate-400 text-sm mb-6 font-mono">{tenant.id}</p>
      <TenantForm initialTenant={tenant} />

      <div className="mt-8 bg-slate-900 rounded-xl border border-slate-700 p-5">
        <h2 className="font-semibold mb-3">ログインユーザー</h2>
        {authUsers && authUsers.length > 0 ? (
          <ul className="text-sm text-slate-300 space-y-1">
            {authUsers.map((u: { user_id: string }) => (
              <li key={u.user_id} className="font-mono">{u.user_id}</li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm">なし（下の「ユーザー発行」APIで追加）</p>
        )}
      </div>
    </div>
  )
}
