'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type Category = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

const MAX_CATEGORIES = 9

const COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
]

export default function CategoryManager({
  tenantId,
  categories,
}: {
  tenantId: string
  categories: Category[]
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/faqs/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, name: name.trim() }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'エラーが発生しました')
    } else {
      setName('')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete(id: string, catName: string) {
    if (!confirm(`「${catName}」を削除しますか？\n紐付いているFAQのカテゴリは未分類になります。`)) return
    await fetch(`/api/faqs/categories/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const remaining = MAX_CATEGORIES - categories.length

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-700">大カテゴリ管理</h2>
        <span className="text-xs text-slate-400">
          {categories.length} / {MAX_CATEGORIES}
        </span>
      </div>

      {/* カテゴリバッジ一覧 */}
      <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem]">
        {categories.length === 0 && (
          <span className="text-slate-400 text-sm">カテゴリがまだありません</span>
        )}
        {categories.map((cat, i) => (
          <span
            key={cat.id}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${COLORS[i % COLORS.length]}`}
          >
            {cat.name}
            <button
              onClick={() => handleDelete(cat.id, cat.name)}
              className="hover:opacity-70 transition text-base leading-none"
              aria-label={`${cat.name}を削除`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* 追加フォーム */}
      {remaining > 0 ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例：営業・料金・アクセス"
            maxLength={20}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? '...' : '+ 追加'}
          </button>
        </form>
      ) : (
        <p className="text-slate-400 text-xs">最大{MAX_CATEGORIES}個に達しました</p>
      )}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  )
}
