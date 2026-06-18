import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'
import FaqForm from './FaqForm'
import FaqDelete from './FaqDelete'

export const revalidate = 0

type FaqItem = {
  id: string
  question: string
  answer: string
  hit_count: number
  is_active: boolean
  created_at: string
}

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function FaqsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const { data: faqs } = await db()
    .from('faq_items')
    .select('id, question, answer, hit_count, is_active, created_at')
    .eq('tenant_id', tenantId)
    .order('hit_count', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">FAQ管理</h1>
        <span className="text-slate-400 text-sm">{faqs?.length ?? 0} 件</span>
      </div>

      <FaqForm tenantId={tenantId} />

      <div className="mt-6 flex flex-col gap-3">
        {faqs?.map((faq: FaqItem) => (
          <div key={faq.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {!faq.is_active && (
                    <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">無効</span>
                  )}
                  <span className="text-xs text-slate-400">🔥 {faq.hit_count} 回一致</span>
                </div>
                <p className="font-semibold text-slate-800 mb-1">Q: {faq.question}</p>
                <p className="text-slate-600 text-sm">A: {faq.answer}</p>
              </div>
              <FaqDelete id={faq.id} />
            </div>
          </div>
        ))}
        {faqs?.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-12">FAQがまだありません。上のフォームから追加してください。</p>
        )}
      </div>
    </div>
  )
}
