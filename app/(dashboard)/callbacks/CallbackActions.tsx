'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CallbackActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function update(newStatus: string) {
    await supabase.from('callback_requests').update({ status: newStatus }).eq('id', id)
    router.refresh()
  }

  if (status === 'pending') {
    return (
      <div className="flex gap-2">
        <button onClick={() => update('in_progress')} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded transition">対応中</button>
        <button onClick={() => update('completed')}   className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded transition">完了</button>
      </div>
    )
  }
  if (status === 'in_progress') {
    return (
      <button onClick={() => update('completed')} className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded transition">完了</button>
    )
  }
  return null
}
