'use client'

import { useState, useEffect } from 'react'

type BlockedNumber = {
  id: string
  phone_number: string
  memo: string | null
  created_at: string
}

export default function BlockedNumbers() {
  const [numbers, setNumbers] = useState<BlockedNumber[]>([])
  const [phone, setPhone] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/blocked-numbers')
      .then(r => r.json())
      .then(data => { setNumbers(Array.isArray(data) ? data : []); setLoaded(true) })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/blocked-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone.trim(), memo }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'エラー')
    } else {
      setNumbers(prev => [
        { id: json.id, phone_number: phone.trim(), memo: memo.trim() || null, created_at: new Date().toISOString() },
        ...prev,
      ])
      setPhone('')
      setMemo('')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/blocked-numbers/${id}`, { method: 'DELETE' })
    setNumbers(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-slate-700">スパム番号ブロック</h2>
      <p className="text-xs text-slate-400">登録した番号からの着信は即座に切断します</p>

      <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="例：0120123456"
          className="flex-1 min-w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <input
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="メモ（任意）"
          className="w-40 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <button
          type="submit"
          disabled={saving || !phone.trim()}
          className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? '追加中...' : '+ ブロック'}
        </button>
      </form>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loaded ? (
        <p className="text-slate-400 text-sm">読み込み中...</p>
      ) : numbers.length === 0 ? (
        <p className="text-slate-400 text-sm">ブロック中の番号はありません</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {numbers.map(n => (
            <li key={n.id} className="flex items-center justify-between py-2 gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-800">{n.phone_number}</span>
                {n.memo && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{n.memo}</span>}
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                className="text-xs text-red-400 hover:text-red-600 transition shrink-0"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
