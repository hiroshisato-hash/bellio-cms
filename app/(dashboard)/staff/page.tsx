import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'
import StaffManager from './StaffManager'

export const revalidate = 0

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const { data: employees } = await db()
    .from('employees')
    .select('id, name, name_kana, department, title, email, phone, is_active, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">担当者管理</h1>
        <p className="text-sm text-slate-500 mt-1">折り返し対応を担当するスタッフを登録します</p>
      </div>
      <StaffManager tenantId={tenantId} initialEmployees={employees ?? []} />
    </div>
  )
}
