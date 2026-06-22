'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CallbackActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function update(newStatus: string) {
    setBusy(true)
    await fetch('/api/callbacks/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callbackId: id, status: newStatus }),
    })
    setBusy(false)
    router.refresh()
  }

  const base = 'text-xs px-2 py-1 rounded transition disabled:opacity-50'

  if (status === 'pending' || status === 'in_progress') {
    return (
      <div className="flex gap-2">
        {status === 'pending' && (
          <button disabled={busy} onClick={() => update('in_progress')} className={`${base} bg-blue-50 text-blue-600 hover:bg-blue-100`}>対応中</button>
        )}
        <button disabled={busy} onClick={() => update('completed')} className={`${base} bg-green-50 text-green-600 hover:bg-green-100`}>対応済み</button>
        <button disabled={busy} onClick={() => update('cancelled')} className={`${base} bg-slate-100 text-slate-500 hover:bg-slate-200`}>対応不要</button>
      </div>
    )
  }

  // 完了 / 対応不要 済み → 未対応に戻せる（誤操作の救済）
  return (
    <button disabled={busy} onClick={() => update('pending')} className={`${base} text-slate-400 hover:text-slate-600 hover:bg-slate-100`}>未対応に戻す</button>
  )
}
