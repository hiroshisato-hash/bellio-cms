'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/callbacks', label: '折り返しキュー', icon: '📞' },
  { href: '/staff',     label: '担当者管理',     icon: '👤' },
  { href: '/faqs',      label: 'FAQ管理',       icon: '💬' },
  { href: '/call-logs', label: '通話履歴',       icon: '📋' },
  { href: '/settings',  label: '設定',           icon: '⚙️' },
]

export default function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleBackToAdmin() {
    await fetch('/api/admin/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: null }),
    })
    router.push('/admin')
  }

  return (
    <aside className="w-56 min-h-screen bg-slate-800 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg tracking-wide">Bellio</span>
        {isAdmin && (
          <span className="text-purple-400 text-xs block">Admin viewing</span>
        )}
        {!isAdmin && (
          <span className="text-slate-400 text-xs block">管理画面</span>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? 'bg-yellow-400 text-slate-900 font-medium'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-yellow-400'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-slate-700 flex flex-col gap-1">
        {isAdmin && (
          <button
            onClick={handleBackToAdmin}
            className="w-full text-left px-3 py-2 text-sm text-yellow-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
          >
            ← Admin画面に戻る
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
        >
          🚪 ログアウト
        </button>
      </div>
    </aside>
  )
}
