import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const isAdmin = user.email === SUPER_ADMIN_EMAIL

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
