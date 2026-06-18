'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function FaqDelete({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    if (!confirm('このFAQを削除しますか？')) return
    await supabase.from('faq_items').delete().eq('id', id)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      className="shrink-0 text-xs text-slate-400 hover:text-red-500 transition px-2 py-1 rounded hover:bg-red-50"
    >
      削除
    </button>
  )
}
