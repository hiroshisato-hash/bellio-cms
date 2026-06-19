'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type TenantSettings = {
  greeting_text: string | null
  mode: string | null
  faq_threshold: number | null
  urgent_keywords: string[] | null
  business_hours: unknown
  transfer_number: string | null
  transfer_keywords: string[] | null
  [key: string]: unknown
}

function TimeRange({
  start, end, onStart, onEnd,
}: {
  start: string; end: string
  onStart: (v: string) => void
  onEnd: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        value={start}
        onChange={e => onStart(e.target.value)}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
      />
      <span className="text-slate-400 text-sm">〜</span>
      <input
        type="time"
        value={end}
        onChange={e => onEnd(e.target.value)}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
      />
    </div>
  )
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

  const bh = (initialSettings?.business_hours as Record<string, unknown>) ?? {}
  const bhWd = (bh?.weekdays as { start?: string; end?: string }) ?? {}
  const bhSat = bh?.saturday as { start?: string; end?: string } | null
  const bhSun = bh?.sunday as { start?: string; end?: string } | null

  const [greeting, setGreeting] = useState(initialSettings?.greeting_text ?? '')
  const [mode, setMode] = useState(initialSettings?.mode ?? 'hybrid')
  const [threshold, setThreshold] = useState(String(initialSettings?.faq_threshold ?? 0.75))
  const [keywords, setKeywords] = useState((initialSettings?.urgent_keywords ?? []).join('\n'))

  const [bhWeekdayStart, setBhWeekdayStart] = useState(bhWd?.start ?? '09:00')
  const [bhWeekdayEnd, setBhWeekdayEnd] = useState(bhWd?.end ?? '18:00')
  const [bhSatEnabled, setBhSatEnabled] = useState(bhSat != null)
  const [bhSatStart, setBhSatStart] = useState(bhSat?.start ?? '09:00')
  const [bhSatEnd, setBhSatEnd] = useState(bhSat?.end ?? '17:00')
  const [bhSunEnabled, setBhSunEnabled] = useState(bhSun != null)
  const [bhSunStart, setBhSunStart] = useState(bhSun?.start ?? '10:00')
  const [bhSunEnd, setBhSunEnd] = useState(bhSun?.end ?? '17:00')

  const [transferNumber, setTransferNumber] = useState(initialSettings?.transfer_number ?? '')
  const [transferKeywords, setTransferKeywords] = useState(
    ((initialSettings?.transfer_keywords ?? []) as string[]).join('\n'),
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const urgentKeywords = keywords.split('\n').map(k => k.trim()).filter(Boolean)
    const transferKws = transferKeywords.split('\n').map(k => k.trim()).filter(Boolean)
    const business_hours = {
      weekdays: { start: bhWeekdayStart, end: bhWeekdayEnd },
      saturday: bhSatEnabled ? { start: bhSatStart, end: bhSatEnd } : null,
      sunday: bhSunEnabled ? { start: bhSunStart, end: bhSunEnd } : null,
    }

    const { error: err } = await supabase
      .from('tenant_settings')
      .upsert(
        {
          tenant_id: tenantId,
          greeting_text: greeting,
          mode,
          faq_threshold: parseFloat(threshold),
          urgent_keywords: urgentKeywords,
          business_hours,
          transfer_number: transferNumber.trim() || null,
          transfer_keywords: transferKws,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* AI設定 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-700">AI設定</h2>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">挨拶文（AIが最初に読み上げるテキスト）</label>
          <textarea
            value={greeting}
            onChange={e => setGreeting(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">動作モード</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
            className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <p className="text-xs text-slate-400 mt-1">高いほど厳密マッチのみFAQを返す（推奨: 0.75）</p>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">緊急キーワード（1行1ワード）</label>
          <textarea
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            rows={4}
            placeholder={'緊急\n事故\n火事\n大至急'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none font-mono"
          />
          <p className="text-xs text-slate-400 mt-1">このワードが含まれると最優先の折り返し（priority=10）として登録します</p>
        </div>
      </div>

      {/* 営業時間 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-700">営業時間</h2>
        <p className="text-xs text-slate-400">時間外の着信は「本日の受付は終了しました」と案内して切断します</p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 w-16">平日</span>
            <TimeRange
              start={bhWeekdayStart} end={bhWeekdayEnd}
              onStart={setBhWeekdayStart} onEnd={setBhWeekdayEnd}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 w-16 cursor-pointer">
              <input
                type="checkbox"
                checked={bhSatEnabled}
                onChange={e => setBhSatEnabled(e.target.checked)}
                className="accent-yellow-400"
              />
              <span className="text-sm text-slate-600">土曜</span>
            </label>
            {bhSatEnabled && (
              <TimeRange
                start={bhSatStart} end={bhSatEnd}
                onStart={setBhSatStart} onEnd={setBhSatEnd}
              />
            )}
            {!bhSatEnabled && <span className="text-sm text-slate-400">休業</span>}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 w-16 cursor-pointer">
              <input
                type="checkbox"
                checked={bhSunEnabled}
                onChange={e => setBhSunEnabled(e.target.checked)}
                className="accent-yellow-400"
              />
              <span className="text-sm text-slate-600">日祝</span>
            </label>
            {bhSunEnabled && (
              <TimeRange
                start={bhSunStart} end={bhSunEnd}
                onStart={setBhSunStart} onEnd={setBhSunEnd}
              />
            )}
            {!bhSunEnabled && <span className="text-sm text-slate-400">休業</span>}
          </div>
        </div>
      </div>

      {/* 転送設定 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-700">転送設定</h2>
        <p className="text-xs text-slate-400">指定キーワードが含まれた場合、AIが担当者に電話を転送します</p>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">転送先電話番号（E.164形式 例: +815012345678）</label>
          <input
            value={transferNumber}
            onChange={e => setTransferNumber(e.target.value)}
            placeholder="+815012345678"
            className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">転送トリガーキーワード（1行1ワード）</label>
          <textarea
            value={transferKeywords}
            onChange={e => setTransferKeywords(e.target.value)}
            rows={4}
            placeholder={'担当者\n人間\nオペレーター\n直接話したい'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none font-mono"
          />
          <p className="text-xs text-slate-400 mt-1">転送先が未設定の場合はこのキーワードは無視されます</p>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">保存しました</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-medium px-5 py-2 rounded-lg transition disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </form>
  )
}
