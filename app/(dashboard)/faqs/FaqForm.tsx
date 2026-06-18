'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FaqForm({ tenantId }: { tenantId: string }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, question, answer }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'エラーが発生しました')
    } else {
      setQuestion('')
      setAnswer('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
      <h2 className="font-semibold text-slate-700">新規FAQ追加</h2>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">質問（電話で言われる言葉）</label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          required
          placeholder="例：営業時間を教えてください"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">回答（AIが読み上げるテキスト）</label>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          required
          rows={3}
          placeholder="例：営業時間は月曜から金曜の9時から18時です。"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-start bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
      >
        {loading ? '登録中（embedding生成）...' : '+ 追加'}
      </button>
    </form>
  )
}
