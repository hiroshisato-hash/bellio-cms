import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'
import SettingsForm from './SettingsForm'

export const revalidate = 0

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const { data: tenant } = await db()
    .from('tenants')
    .select('id, company_name, phone_number')
    .eq('id', tenantId)
    .single()

  if (!tenant) return <p className="text-slate-500">テナントが見つかりません</p>

  const { data: settings } = await db()
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">設定</h1>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-700 mb-3">基本情報</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-400">会社名</dt>
          <dd className="text-slate-800">{tenant.company_name}</dd>
          <dt className="text-slate-400">電話番号</dt>
          <dd className="text-slate-800 font-mono">{tenant.phone_number}</dd>
        </dl>
      </div>

      <SettingsForm tenantId={tenant.id} initialSettings={settings} />
    </div>
  )
}
