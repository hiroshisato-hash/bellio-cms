'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Draft = { question: string; answer: string; category: string; selected: boolean }
type Clarification = { question: string; options: string[]; answered?: boolean }

export default function FaqAiGenerate({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [clarifications, setClarifications] = useState<Clarification[]>([])
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState('')
  const router = useRouter()

  async function generate() {
    setLoading(true); setError(''); setDone('')
    try {
      const res = await fetch('/api/faqs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, text, url }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'AI生成に失敗しました'); return }
      setDrafts((json.faqs ?? []).map((f: { question: string; answer: string; category?: string }) => ({
        question: f.question, answer: f.answer, category: f.category ?? '', selected: true,
      })))
      setClarifications((json.clarifications ?? []).map((c: Clarification) => ({ ...c, answered: false })))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 確認質問の選択肢をポチる → AIが1件FAQ化して案に追加
  async function pickOption(idx: number, option: string) {
    const c = clarifications[idx]
    setClarifications(prev => prev.map((x, i) => i === idx ? { ...x, answered: true } : x))
    try {
      const res = await fetch('/api/faqs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, mode: 'clarify', context: text || url, question: c.question, answer: option }),
      })
      const json = await res.json()
      if (res.ok && json.faq) {
        setDrafts(prev => [
          { question: json.faq.question, answer: json.faq.answer, category: json.faq.category ?? '', selected: true },
          ...prev,
        ])
      }
    } catch { /* noop */ }
  }

  function updateDraft(i: number, patch: Partial<Draft>) {
    setDrafts(prev => prev.map((d, j) => j === i ? { ...d, ...patch } : d))
  }

  async function addSelected() {
    const chosen = drafts.filter(d => d.selected && d.question.trim() && d.answer.trim())
    if (chosen.length === 0) { setError('追加するFAQを選んでください'); return }
    setAdding(true); setError(''); setDone('')
    // CSV に変換して一括インポート（embedding生成＋登録を再利用）
    const esc = (v: string) => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    const csv = '﻿カテゴリ,質問,回答,有効\r\n' +
      chosen.map(d => [esc(d.category), esc(d.question), esc(d.answer), '1'].join(',')).join('\r\n')
    try {
      const res = await fetch('/api/faqs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, csv }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '登録に失敗しました'); return }
      setDone(`${json.imported}件をFAQに追加しました`)
      setDrafts([]); setClarifications([]); setText(''); setUrl('')
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  const selectedCount = drafts.filter(d => d.selected).length

  return (
    <div className="bg-white rounded-xl border border-violet-100 shadow-sm p-5 mb-6">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <span className="font-semibold text-slate-700 flex items-center gap-2">
          ✨ AIでFAQを作成
          <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">AI</span>
        </span>
        <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            会社やサービスの説明文を貼り付けるか、ページのURLを入力すると、AIがFAQ案を作ります。
            足りない情報はAIが質問するので、選択肢を選ぶだけでFAQを追加できます。
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder="例：当店は美容室で、平日10時〜20時、土日9時〜19時の営業。カット4000円〜。駅徒歩5分。予約優先制で当日予約も可能。"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="またはURL（会社HP・サービスページ）"
              className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              onClick={generate}
              disabled={loading || (!text.trim() && !url.trim())}
              className="bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'AIが考え中...' : '✨ FAQ案を作成'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {done && <p className="text-green-600 text-sm">✓ {done}</p>}

          {/* AIからの確認質問 */}
          {clarifications.length > 0 && (
            <div className="border border-violet-100 rounded-lg p-3 bg-violet-50/40">
              <h4 className="text-xs font-semibold text-violet-700 mb-2">🤔 AIからの確認（選ぶとFAQが1件増えます）</h4>
              <div className="flex flex-col gap-3">
                {clarifications.map((c, i) => (
                  <div key={i} className={c.answered ? 'opacity-40' : ''}>
                    <p className="text-sm text-slate-700 mb-1">{c.question}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.options.map((o, j) => (
                        <button
                          key={j}
                          disabled={c.answered}
                          onClick={() => pickOption(i, o)}
                          className="text-xs border border-violet-200 text-violet-700 px-2.5 py-1 rounded-full hover:bg-violet-100 transition disabled:cursor-default"
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ案 */}
          {drafts.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-600">FAQ案（{selectedCount}件選択中・編集できます）</h4>
                <button
                  onClick={addSelected}
                  disabled={adding || selectedCount === 0}
                  className="bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {adding ? '追加中...' : `選択した${selectedCount}件を追加`}
                </button>
              </div>
              {drafts.map((d, i) => (
                <div key={i} className={`border rounded-lg p-3 ${d.selected ? 'border-violet-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={d.selected}
                      onChange={e => updateDraft(i, { selected: e.target.checked })}
                      className="mt-1 accent-violet-500"
                    />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex gap-2">
                        <input
                          value={d.category}
                          onChange={e => updateDraft(i, { category: e.target.value })}
                          placeholder="カテゴリ"
                          className="w-28 border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                        <input
                          value={d.question}
                          onChange={e => updateDraft(i, { question: e.target.value })}
                          placeholder="質問"
                          className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs font-medium"
                        />
                      </div>
                      <textarea
                        value={d.answer}
                        onChange={e => updateDraft(i, { answer: e.target.value })}
                        rows={2}
                        placeholder="回答"
                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
