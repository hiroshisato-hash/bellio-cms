import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'
import FaqForm from './FaqForm'
import FaqDelete from './FaqDelete'
import CategoryManager from './CategoryManager'
import FaqImportExport from './FaqImportExport'
import FaqAiGenerate from './FaqAiGenerate'
import type { Category } from './CategoryManager'

export const revalidate = 0

type FaqItem = {
  id: string
  question: string
  answer: string
  hit_count: number
  is_active: boolean
  category_id: string | null
  created_at: string
}

const COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
]

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

  const [{ data: categories }, { data: faqs }] = await Promise.all([
    db()
      .from('faq_categories')
      .select('id, name, display_order, is_active')
      .eq('tenant_id', tenantId)
      .order('display_order', { ascending: true }),
    db()
      .from('faq_items')
      .select('id, question, answer, hit_count, is_active, category_id, created_at')
      .eq('tenant_id', tenantId)
      .order('hit_count', { ascending: false }),
  ])

  const cats: Category[] = categories ?? []
  const faqList: FaqItem[] = faqs ?? []

  // カテゴリごとにグループ化
  const catMap = new Map<string, FaqItem[]>()
  const uncategorized: FaqItem[] = []
  for (const faq of faqList) {
    if (faq.category_id) {
      const arr = catMap.get(faq.category_id) ?? []
      arr.push(faq)
      catMap.set(faq.category_id, arr)
    } else {
      uncategorized.push(faq)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">FAQ管理</h1>
        <span className="text-slate-400 text-sm">{faqList.length} 件</span>
      </div>

      <FaqAiGenerate tenantId={tenantId} />
      <FaqImportExport tenantId={tenantId} />
      <CategoryManager tenantId={tenantId} categories={cats} />
      <FaqForm tenantId={tenantId} categories={cats} />

      <div className="mt-6 flex flex-col gap-6">
        {/* カテゴリ別グループ */}
        {cats.map((cat, i) => {
          const items = catMap.get(cat.id) ?? []
          return (
            <section key={cat.id}>
              <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold mb-3 ${COLORS[i % COLORS.length]}`}>
                {cat.name}
                <span className="opacity-60">({items.length})</span>
              </div>
              {items.length === 0 ? (
                <p className="text-slate-400 text-sm ml-1">このカテゴリにFAQはありません</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map(faq => <FaqCard key={faq.id} faq={faq} />)}
                </div>
              )}
            </section>
          )
        })}

        {/* 未分類 */}
        {(uncategorized.length > 0 || cats.length === 0) && (
          <section>
            {cats.length > 0 && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold mb-3 bg-slate-100 text-slate-500 border-slate-200">
                未分類
                <span className="opacity-60">({uncategorized.length})</span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {uncategorized.map(faq => <FaqCard key={faq.id} faq={faq} />)}
            </div>
          </section>
        )}

        {faqList.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-12">FAQがまだありません。上のフォームから追加してください。</p>
        )}
      </div>
    </div>
  )
}

function FaqCard({ faq }: { faq: FaqItem }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
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
  )
}
