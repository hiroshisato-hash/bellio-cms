import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'
import CallbackActions from './CallbackActions'

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
  employees: { name: string } | null
}

const priorityLabel = (p: number) => {
  if (p >= 8) return { label: '緊急', cls: 'bg-red-100 text-red-700' }
  if (p >= 5) return { label: '通常', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: '低', cls: 'bg-slate-100 text-slate-600' }
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  pending:    { label: '未対応', cls: 'bg-orange-100 text-orange-700' },
  in_progress:{ label: '対応中', cls: 'bg-blue-100 text-blue-700' },
  completed:  { label: '完了',   cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'キャンセル', cls: 'bg-slate-100 text-slate-500' },
}

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function CallbacksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const { data: callbacks } = await db()
    .from('callback_requests')
    .select('*, employees(name)')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  const { data: completed } = await db()
    .from('callback_requests')
    .select('*, employees(name)')
    .eq('tenant_id', tenantId)
    .in('status', ['completed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(20)

  function formatDate(iso: string | null) {
    if (!iso) return '未定'
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">折り返しキュー</h1>
        <span className="bg-orange-100 text-orange-700 text-sm font-medium px-3 py-1 rounded-full">
          未対応 {callbacks?.length ?? 0} 件
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">優先度</th>
              <th className="text-left px-4 py-3">発信者</th>
              <th className="text-left px-4 py-3">用件</th>
              <th className="text-left px-4 py-3">担当者</th>
              <th className="text-left px-4 py-3">希望時間</th>
              <th className="text-left px-4 py-3">受信</th>
              <th className="text-left px-4 py-3">ステータス</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {callbacks?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  未対応の折り返しはありません
                </td>
              </tr>
            )}
            {callbacks?.map((cb: Callback) => {
              const pri = priorityLabel(cb.priority)
              const st = statusLabel[cb.status] ?? statusLabel.pending
              return (
                <tr key={cb.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pri.cls}`}>{pri.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{cb.caller_name ?? '不明'}</div>
                    <div className="text-slate-400 text-xs">{cb.caller_number}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-48 truncate">{cb.purpose ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{cb.employees?.name ?? '未割当'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(cb.preferred_callback_at)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(cb.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <CallbackActions id={cb.id} status={cb.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(completed?.length ?? 0) > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-600 mb-3">完了済み（直近20件）</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">発信者</th>
                  <th className="text-left px-4 py-3">用件</th>
                  <th className="text-left px-4 py-3">受信</th>
                  <th className="text-left px-4 py-3">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completed?.map((cb: Callback) => {
                  const st = statusLabel[cb.status] ?? statusLabel.completed
                  return (
                    <tr key={cb.id} className="opacity-60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{cb.caller_name ?? '不明'}</div>
                        <div className="text-slate-400 text-xs">{cb.caller_number}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-48 truncate">{cb.purpose ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(cb.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
