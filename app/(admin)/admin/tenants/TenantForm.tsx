'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TenantData = {
  id?: string
  company_name: string
  phone_number: string
  plan: string
  is_active: boolean
}

export default function TenantForm({ initialTenant }: { initialTenant?: TenantData }) {
  const isEdit = !!initialTenant?.id
  const router = useRouter()

  const [companyName, setCompanyName] = useState(initialTenant?.company_name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(initialTenant?.phone_number ?? '')
  const [plan, setPlan] = useState(initialTenant?.plan ?? 'basic')
  const [isActive, setIsActive] = useState(initialTenant?.is_active ?? true)

  const [userEmail, setUserEmail] = useState('')

  const [saving, setSaving] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleViewTenant() {
    await fetch('/api/admin/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: initialTenant?.id }),
    })
    window.location.href = '/callbacks'
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/admin/tenants', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: initialTenant?.id,
        company_name: companyName,
        phone_number: phoneNumber,
        plan,
        is_active: isActive,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'エラー')
    } else {
      setSuccess(isEdit ? '保存しました' : 'テナントを作成しました')
      if (!isEdit) router.push(`/admin/tenants/${json.id}`)
    }
    setSaving(false)
  }

  async function handleIssueUser(e: React.FormEvent) {
    e.preventDefault()
    setIssuing(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/admin/issue-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: initialTenant?.id,
        email: userEmail,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'エラー')
    } else {
      setSuccess(`招待メールを送信しました: ${userEmail}`)
      setUserEmail('')
    }
    setIssuing(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* テナント情報 */}
      <form onSubmit={handleSave} className="bg-slate-900 rounded-xl border border-slate-700 p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-200">基本情報</h2>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">会社名</label>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            required
            placeholder="例：株式会社○○"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">電話番号（E.164形式 例: +815012345678）</label>
          <input
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            required
            placeholder="+815012345678"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">プラン</label>
          <select
            value={plan}
            onChange={e => setPlan(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="accent-yellow-400"
          />
          有効（チェックを外すと通話受付停止）
        </label>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-medium px-5 py-2 rounded-lg transition disabled:opacity-50"
          >
            {saving ? '保存中...' : isEdit ? '保存' : 'テナント作成'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleViewTenant}
              className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
            >
              テナント画面を開く →
            </button>
          )}
        </div>
      </form>

      {/* ユーザー発行（編集時のみ） */}
      {isEdit && (
        <form onSubmit={handleIssueUser} className="bg-slate-900 rounded-xl border border-slate-700 p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-slate-200">ログインユーザー発行</h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              required
              placeholder="customer@example.com"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button
              type="submit"
              disabled={issuing}
              className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 whitespace-nowrap"
            >
              {issuing ? '送信中...' : '招待メール送信'}
            </button>
          </div>
          <p className="text-xs text-slate-500">Supabaseから招待メールが届きます。ユーザーはリンクをクリックしてパスワードを設定します。</p>
        </form>
      )}
    </div>
  )
}
