import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'hiroshi.sato@8zero.co.jp'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.email === SUPER_ADMIN_EMAIL) {
    redirect('/admin')
  }

  redirect('/callbacks')
}
