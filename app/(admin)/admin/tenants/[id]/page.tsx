import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import TenantForm from '../TenantForm'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = adminDb()

  const { data: tenant } = await db
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single()

  if (!tenant) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{tenant.company_name}</h1>
      <p className="text-slate-400 text-sm mb-6 font-mono">{tenant.id}</p>
      <TenantForm initialTenant={tenant} />
    </div>
  )
}
