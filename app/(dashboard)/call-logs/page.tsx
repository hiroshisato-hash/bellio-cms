import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'

export const revalidate = 0

type CallLog = {
  id: string
  caller_number: string
  duration_seconds: number | null
  resolution_mode: string | null
  transcript: string | null
  started_at: string
}

// call_logs.resolution_mode の表示マップ（DBの CHECK 制約に対応）
const resolutionModeLabel: Record<string, { label: string; cls: string }> = {
  faq_resolved:       { label: 'FAQ解決', cls: 'bg-green-100 text-green-700' },
  callback_scheduled: { label: '折り返し', cls: 'bg-blue-100 text-blue-700' },
  urgent_alert:       { label: '緊急', cls: 'bg-red-100 text-red-700' },
  abandoned:          { label: '離脱', cls: 'bg-slate-100 text-slate-500' },
}

function formatDuration(secs: number | null) {
  if (!secs) return '-'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function CallLogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const { data: logs } = await db()
    .from('call_logs')
    .select('id, caller_number, duration_seconds, resolution_mode, transcript, started_at')
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">通話履歴</h1>
        <span className="text-slate-400 text-sm">{logs?.length ?? 0} 件（直近100件）</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">日時</th>
              <th className="text-left px-4 py-3">発信者</th>
              <th className="text-left px-4 py-3">通話時間</th>
              <th className="text-left px-4 py-3">結果</th>
              <th className="text-left px-4 py-3">会話内容</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  通話履歴がまだありません
                </td>
              </tr>
            )}
            {logs?.map((log: CallLog) => {
              const out = log.resolution_mode ? (resolutionModeLabel[log.resolution_mode] ?? { label: log.resolution_mode, cls: 'bg-slate-100 text-slate-600' }) : null
              return (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(log.started_at)}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{log.caller_number}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDuration(log.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    {out && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${out.cls}`}>{out.label}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-sm truncate">{log.transcript ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
