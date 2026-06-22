import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'

export const revalidate = 0

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// call_logs.resolution_mode の表示マップ（DBの CHECK 制約に対応）
const modeMeta: Record<string, { label: string; badge: string; bar: string }> = {
  faq_resolved:       { label: 'FAQ解決', badge: 'bg-green-100 text-green-700',  bar: 'bg-green-400' },
  callback_scheduled: { label: '折り返し', badge: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-400' },
  urgent_alert:       { label: '緊急',     badge: 'bg-red-100 text-red-700',     bar: 'bg-red-400' },
  abandoned:          { label: '離脱',     badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300' },
}
const MODE_ORDER = ['faq_resolved', 'callback_scheduled', 'urgent_alert', 'abandoned'] as const

const priorityLabel = (p: number) => {
  if (p >= 8) return { label: '緊急', cls: 'bg-red-100 text-red-700' }
  if (p >= 5) return { label: '通常', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: '低', cls: 'bg-slate-100 text-slate-600' }
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDuration(secs: number | null) {
  if (!secs) return '-'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type PendingRow = {
  id: string
  caller_number: string
  caller_name: string | null
  purpose: string | null
  priority: number
  preferred_callback_at: string | null
}
type CallRow = {
  id: string
  caller_number: string
  started_at: string
  duration_seconds: number | null
  resolution_mode: string | null
}
type FaqRow = { id: string; question: string; hit_count: number }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Super Admin はテナント横断の管理画面へ
  if (user?.email === SUPER_ADMIN_EMAIL) redirect('/admin')

  const tenantId = await getCurrentTenantId(user?.email)
  if (!tenantId) return <p className="text-slate-500">テナントが選択されていません</p>

  const supa = db()
  // 「本日」は JST 基準で算出（サーバーは UTC のため +9h して日付を取る）
  const nowMs = Date.now()
  const jst = new Date(nowMs + 9 * 3600 * 1000)
  const todayStart = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - 9 * 3600 * 1000,
  ).toISOString()
  const weekAgo = new Date(nowMs - 7 * 24 * 3600 * 1000).toISOString()

  const scoped = () => supa.from('callback_requests').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)

  const [
    todayCalls,
    faqResolvedToday,
    pendingCount,
    inProgressCount,
    completedToday,
    urgentUnack,
    topPending,
    recentCalls,
    topFaqs,
    weekModes,
    tenant,
  ] = await Promise.all([
    supa.from('call_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('started_at', todayStart),
    supa.from('call_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('started_at', todayStart).eq('resolution_mode', 'faq_resolved'),
    scoped().eq('status', 'pending'),
    scoped().eq('status', 'in_progress'),
    scoped().eq('status', 'completed').gte('completed_at', todayStart),
    supa.from('urgent_alerts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('acknowledged_at', null),
    supa.from('callback_requests')
      .select('id, caller_number, caller_name, purpose, priority, preferred_callback_at')
      .eq('tenant_id', tenantId).eq('status', 'pending')
      .order('priority', { ascending: false }).order('created_at', { ascending: true }).limit(3),
    supa.from('call_logs')
      .select('id, caller_number, started_at, duration_seconds, resolution_mode')
      .eq('tenant_id', tenantId).order('started_at', { ascending: false }).limit(5),
    supa.from('faq_items')
      .select('id, question, hit_count')
      .eq('tenant_id', tenantId).gt('hit_count', 0)
      .order('hit_count', { ascending: false }).limit(5),
    supa.from('call_logs')
      .select('resolution_mode')
      .eq('tenant_id', tenantId).gte('started_at', weekAgo).limit(2000),
    supa.from('tenants').select('company_name').eq('id', tenantId).maybeSingle(),
  ])

  const pending = (topPending.data ?? []) as PendingRow[]
  const calls = (recentCalls.data ?? []) as CallRow[]
  const faqs = (topFaqs.data ?? []) as FaqRow[]

  // 直近7日の対応モード内訳
  const modeCounts: Record<string, number> = { faq_resolved: 0, callback_scheduled: 0, urgent_alert: 0, abandoned: 0 }
  for (const r of (weekModes.data ?? []) as { resolution_mode: string | null }[]) {
    const m = r.resolution_mode ?? 'abandoned'
    modeCounts[m] = (modeCounts[m] ?? 0) + 1
  }
  const modeTotal = Object.values(modeCounts).reduce((a, b) => a + b, 0)

  const companyName = (tenant.data as { company_name?: string } | null)?.company_name ?? ''

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>
        {companyName && <p className="text-slate-400 text-sm mt-1">{companyName}</p>}
      </div>

      {/* KPI カード（本日） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="📞" label="本日の着信" value={todayCalls.count ?? 0} />
        <KpiCard icon="⏳" label="未対応の折り返し" value={pendingCount.count ?? 0} href="/callbacks" alert={(pendingCount.count ?? 0) > 0} />
        <KpiCard icon="💬" label="本日のFAQ自動解決" value={faqResolvedToday.count ?? 0} />
        <KpiCard icon="🚨" label="未確認の緊急アラート" value={urgentUnack.count ?? 0} danger={(urgentUnack.count ?? 0) > 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 折り返しサマリー */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">折り返し状況</h2>
            <Link href="/callbacks" className="text-xs text-slate-400 hover:text-yellow-600 transition">一覧へ →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <MiniStat label="未対応" value={pendingCount.count ?? 0} cls="text-orange-600" />
            <MiniStat label="対応中" value={inProgressCount.count ?? 0} cls="text-blue-600" />
            <MiniStat label="本日完了" value={completedToday.count ?? 0} cls="text-green-600" />
          </div>
          <div className="text-xs text-slate-400 mb-2">優先度の高い未対応</div>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">未対応の折り返しはありません 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map(cb => {
                const pri = priorityLabel(cb.priority)
                return (
                  <li key={cb.id}>
                    <Link href={`/callbacks/${cb.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded transition">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${pri.cls}`}>{pri.label}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-slate-800 font-medium truncate">{cb.caller_name ?? cb.caller_number}</span>
                        <span className="block text-xs text-slate-400 truncate">{cb.purpose ?? '用件未記入'}</span>
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{formatTime(cb.preferred_callback_at)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* 対応モード内訳（直近7日） */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">対応モード内訳</h2>
            <span className="text-xs text-slate-400">直近7日 / 計 {modeTotal} 件</span>
          </div>
          {modeTotal === 0 ? (
            <p className="text-sm text-slate-400 py-3">この期間の通話がありません</p>
          ) : (
            <div className="space-y-3">
              {MODE_ORDER.map(m => {
                const meta = modeMeta[m]
                const count = modeCounts[m] ?? 0
                const pct = Math.round((count / modeTotal) * 100)
                return (
                  <div key={m}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{meta.label}</span>
                      <span className="text-slate-400">{count} 件 ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 直近の通話 */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">直近の通話</h2>
            <Link href="/call-logs" className="text-xs text-slate-400 hover:text-yellow-600 transition">通話履歴へ →</Link>
          </div>
          {calls.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">通話履歴がまだありません</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {calls.map(c => {
                const meta = c.resolution_mode ? modeMeta[c.resolution_mode] : null
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-xs text-slate-400 shrink-0 w-20">{formatTime(c.started_at)}</span>
                    <span className="flex-1 font-mono text-sm text-slate-700 truncate">{c.caller_number}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatDuration(c.duration_seconds)}</span>
                    <span className="shrink-0 w-16 text-right">
                      {meta && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* よく聞かれるFAQ */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">よく聞かれるFAQ</h2>
            <Link href="/faqs" className="text-xs text-slate-400 hover:text-yellow-600 transition">FAQ管理へ →</Link>
          </div>
          {faqs.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">まだ参照されたFAQがありません</p>
          ) : (
            <ol className="space-y-2.5">
              {faqs.map((f, i) => (
                <li key={f.id} className="flex items-center gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="flex-1 text-sm text-slate-700 truncate">{f.question}</span>
                  <span className="shrink-0 text-xs text-slate-400">{f.hit_count} 回</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, href, alert, danger }: {
  icon: string; label: string; value: number; href?: string; alert?: boolean; danger?: boolean
}) {
  const ring = danger ? 'border-red-200 bg-red-50' : alert ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-white'
  const num = danger ? 'text-red-600' : alert ? 'text-orange-600' : 'text-slate-800'
  const inner = (
    <div className={`rounded-xl shadow-sm border p-5 transition ${ring} ${href ? 'hover:shadow-md' : ''}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-3xl font-bold ${num}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

function MiniStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-slate-50 rounded-lg py-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}
