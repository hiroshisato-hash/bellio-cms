'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const TEMPLATE_CSV =
  '﻿カテゴリ,質問,回答,有効\r\n' +
  '営業時間,営業時間を教えてください,平日9時から18時まで営業しております。土日祝はお休みです。,1\r\n' +
  '料金,料金プランを教えてください,基本プランは月額9800円からご利用いただけます。,1\r\n' +
  'アクセス,駐車場はありますか,提携駐車場を3台分ご用意しております。,1\r\n'

export default function FaqImportExport({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string; warnings?: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function downloadTemplate() {
    triggerDownload(TEMPLATE_CSV, 'bellio-faq-template.csv')
  }

  function exportAll() {
    window.location.href = `/api/faqs/export?tenantId=${encodeURIComponent(tenantId)}`
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)
    try {
      const csv = await file.text()
      const res = await fetch('/api/faqs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, csv }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: json.error ?? 'インポートに失敗しました', warnings: json.details })
      } else {
        setResult({ ok: true, msg: `${json.imported}件を登録しました`, warnings: json.warnings })
        router.refresh()
      }
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="font-semibold text-slate-700 flex items-center gap-2">
          📄 CSV一括インポート / エクスポート
        </span>
        <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {/* インポート */}
          <div className="border border-slate-100 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-1">一括インポート</h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              CSVをアップロードすると、まとめてFAQを登録します（カテゴリも自動作成）。
              列の順番は <code className="bg-slate-100 px-1 rounded">カテゴリ, 質問, 回答, 有効</code>。1回最大500件。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadTemplate}
                className="text-sm border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
              >
                ⬇ テンプレートをダウンロード
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="text-sm bg-yellow-400 hover:bg-yellow-500 text-white font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {importing ? 'インポート中（embedding生成）...' : '⬆ CSVをアップロード'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
            </div>
            {result && (
              <div className={`mt-3 text-sm rounded-lg px-3 py-2 ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {result.ok ? '✓ ' : '✗ '}{result.msg}
                {result.warnings && result.warnings.length > 0 && (
                  <ul className="mt-1 text-xs list-disc list-inside text-amber-600">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* エクスポート */}
          <div className="border border-slate-100 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-1">エクスポート</h3>
            <p className="text-xs text-slate-500 mb-3">登録済みのFAQを全件CSVでダウンロードします。</p>
            <button
              onClick={exportAll}
              className="text-sm border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
            >
              ⬇ 全FAQをCSVでダウンロード
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
