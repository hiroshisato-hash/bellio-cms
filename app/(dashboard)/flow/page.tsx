import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'
import FlowBuilder from './FlowBuilder'

export const revalidate = 0

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function FlowPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const [{ data: categories }, { data: faqs }, { data: flow }] = await Promise.all([
    db()
      .from('faq_categories')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('display_order', { ascending: true }),
    db()
      .from('faq_items')
      .select('id, question, answer, category_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    db()
      .from('conversation_flows')
      .select('flow_json')
      .eq('tenant_id', tenantId)
      .eq('name', 'メインフロー')
      .maybeSingle(),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">会話フロー設計</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            電話着信後の分岐をビジュアルで設計できます。ノードをドラッグして自由に配置してください。
          </p>
        </div>
      </div>

      <FlowBuilder
        tenantId={tenantId}
        categories={categories ?? []}
        faqs={faqs ?? []}
        savedFlow={flow?.flow_json ?? null}
      />
    </div>
  )
}
