import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.email !== SUPER_ADMIN_EMAIL) redirect('/callbacks')

  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* Admin Sidebar */}
      <nav className="w-56 shrink-0 flex flex-col py-6 px-4 border-r border-slate-700">
        <div className="mb-8">
          <span className="text-white font-bold text-lg">Bellio</span>
          <span className="ml-2 text-xs bg-yellow-400 text-slate-900 font-semibold px-2 py-0.5 rounded-full">Admin</span>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <a href="/admin" className="text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg text-sm transition">
            🏢 テナント一覧
          </a>
          <a href="/admin/tenants/new" className="text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg text-sm transition">
            ➕ テナント追加
          </a>
        </div>
        <a href="/callbacks" className="text-slate-500 hover:text-slate-300 px-3 py-2 rounded-lg text-sm transition">
          ← テナント画面
        </a>
      </nav>

      <main className="flex-1 p-8 overflow-auto bg-slate-950 text-white">
        {children}
      </main>
    </div>
  )
}
