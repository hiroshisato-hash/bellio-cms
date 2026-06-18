import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const revalidate = 0

type Tenant = {
  id: string
  company_name: string
  phone_number: string
  plan: string
  is_active: boolean
  created_at: string
}

const planLabel: Record<string, { label: string; cls: string }> = {
  basic:      { label: 'Basic',      cls: 'bg-slate-700 text-slate-300' },
  pro:        { label: 'Pro',        cls: 'bg-blue-800 text-blue-200' },
  enterprise: { label: 'Enterprise', cls: 'bg-yellow-400 text-slate-900' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function AdminPage() {
  await cookies() // 認証はlayout.tsxで保証済み
  const db = adminDb()

  const { data: tenants } = await db
    .from('tenants')
    .select('id, company_name, phone_number, plan, is_active, created_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">テナント一覧</h1>
        <a
          href="/admin/tenants/new"
          className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + テナント追加
        </a>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">会社名</th>
              <th className="text-left px-4 py-3">電話番号</th>
              <th className="text-left px-4 py-3">プラン</th>
              <th className="text-left px-4 py-3">状態</th>
              <th className="text-left px-4 py-3">登録日</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tenants?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  テナントがまだいません
                </td>
              </tr>
            )}
            {tenants?.map((t: Tenant) => {
              const pl = planLabel[t.plan] ?? planLabel.basic
              return (
                <tr key={t.id} className="hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3 font-medium">{t.company_name}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{t.phone_number}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pl.cls}`}>{pl.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.is_active
                      ? <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">有効</span>
                      : <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">停止</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <a href={`/admin/tenants/${t.id}`} className="text-xs text-yellow-400 hover:text-yellow-300 transition">
                      編集 →
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
