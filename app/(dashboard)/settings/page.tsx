import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'

export const revalidate = 0

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, company_name, phone_number')
    .eq('is_active', true)
    .single()

  if (!tenant) return <p className="text-slate-500">テナントが見つかりません</p>

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenant.id)
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
