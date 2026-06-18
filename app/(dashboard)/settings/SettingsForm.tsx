'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type TenantSettings = {
  greeting_text: string | null
  mode: string | null
  faq_threshold: number | null
  urgent_keywords: string[] | null
  [key: string]: unknown
}

export default function SettingsForm({
  tenantId,
  initialSettings,
}: {
  tenantId: string
  initialSettings: TenantSettings | null
}) {
  const router = useRouter()
  const supabase = createClient()

  const [greeting, setGreeting] = useState(initialSettings?.greeting_text ?? '')
  const [mode, setMode] = useState(initialSettings?.mode ?? 'hybrid')
  const [threshold, setThreshold] = useState(String(initialSettings?.faq_threshold ?? 0.75))
  const [keywords, setKeywords] = useState((initialSettings?.urgent_keywords ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const urgentKeywords = keywords
      .split('\n')
      .map(k => k.trim())
      .filter(Boolean)

    const { error: err } = await supabase
      .from('tenant_settings')
      .upsert(
        {
          tenant_id: tenantId,
          greeting_text: greeting,
          mode,
          faq_threshold: parseFloat(threshold),
          urgent_keywords: urgentKeywords,
        },
        { onConflict: 'tenant_id' },
      )

    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-5">
      <h2 className="font-semibold text-slate-700">AI設定</h2>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">挨拶文（AIが最初に読み上げるテキスト）</label>
        <textarea
          value={greeting}
          onChange={e => setGreeting(e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">動作モード</label>
        <select
          value={mode}
          onChange={e => setMode(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="hybrid">ハイブリッド（FAQ解決 + 折り返し）</option>
          <option value="faq_only">FAQのみ</option>
          <option value="callback_only">折り返しのみ</option>
        </select>
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">FAQ一致閾値（0.5〜1.0）</label>
        <input
          type="number"
          min="0.5"
          max="1.0"
          step="0.01"
          value={threshold}
          onChange={e => setThreshold(e.target.value)}
          className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="text-xs text-slate-400 mt-1">高いほど厳密にマッチしたときだけFAQを返す。低いと誤マッチしやすい。</p>
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">緊急キーワード（1行1ワード）</label>
        <textarea
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          rows={4}
          placeholder={'緊急\n事故\n火事\n大至急'}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
        />
        <p className="text-xs text-slate-400 mt-1">このワードが含まれると最優先の折り返し（priority=10）として登録します。</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">保存しました</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </form>
  )
}
