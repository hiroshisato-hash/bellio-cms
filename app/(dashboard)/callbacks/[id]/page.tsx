import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'
import CallbackActions from '../CallbackActions'

export const revalidate = 0

type Callback = {
  id: string
  caller_number: string
  caller_name: string | null
  purpose: string | null
  preferred_callback_at: string | null
  priority: number
  status: string
  created_at: string
  completed_at: string | null
  resolved_by: string | null
  notes: string | null
  employee_id: string | null
  employees: { name: string } | null
}

const priorityLabel = (p: number) => {
  if (p >= 8) return { label: '緊急', cls: 'bg-red-100 text-red-700' }
  if (p >= 5) return { label: '通常', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: '低', cls: 'bg-slate-100 text-slate-600' }
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  pending:     { label: '未対応',     cls: 'bg-orange-100 text-orange-700' },
  in_progress: { label: '対応中',     cls: 'bg-blue-100 text-blue-700' },
  completed:   { label: '完了',       cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: '対応不要',   cls: 'bg-slate-100 text-slate-500' },
}

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '未定'
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default async function CallbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const { data: cb } = await db()
    .from('callback_requests')
    .select('*, employees(name)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle<Callback>()

  if (!cb) notFound()

  const pri = priorityLabel(cb.priority)
  const st = statusLabel[cb.status] ?? statusLabel.pending

  return (
    <div className="max-w-2xl">
      <Link href="/callbacks" className="text-sm text-slate-400 hover:text-yellow-600 transition">← 折り返しキューに戻る</Link>

      <div className="flex items-center gap-3 mt-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">折り返し依頼</h1>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pri.cls}`}>{pri.label}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
        <dl className="divide-y divide-slate-100 text-sm">
          <Row label="発信者">
            <div className="font-medium text-slate-800">{cb.caller_name ?? '不明'}</div>
            <div className="text-slate-400 text-xs">{cb.caller_number}</div>
          </Row>
          <Row label="用件">{cb.purpose ?? '-'}</Row>
          <Row label="担当者">{cb.employees?.name ?? '未割当'}</Row>
          <Row label="折返し希望時間">{formatDate(cb.preferred_callback_at)}</Row>
          <Row label="受信日時">{formatDate(cb.created_at)}</Row>
          {cb.notes && <Row label="メモ">{cb.notes}</Row>}
          {cb.completed_at && <Row label="対応日時">{formatDate(cb.completed_at)}</Row>}
          {cb.resolved_by && <Row label="対応者">{cb.resolved_by}</Row>}
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="text-sm text-slate-500 mb-3">この依頼への対応</div>
        <CallbackActions id={cb.id} status={cb.status} />
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex py-3">
      <dt className="w-32 shrink-0 text-slate-400">{label}</dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  )
}
