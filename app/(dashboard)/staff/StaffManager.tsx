'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

type Employee = {
  id: string
  name: string
  name_kana: string | null
  department: string | null
  title: string | null
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

type FormData = {
  name: string
  name_kana: string
  department: string
  title: string
  email: string
  phone: string
  is_active: boolean
}

const emptyForm: FormData = {
  name: '', name_kana: '', department: '', title: '', email: '', phone: '', is_active: true,
}

function toFormData(e: Employee): FormData {
  return {
    name: e.name,
    name_kana: e.name_kana ?? '',
    department: e.department ?? '',
    title: e.title ?? '',
    email: e.email ?? '',
    phone: e.phone ?? '',
    is_active: e.is_active,
  }
}

function EmployeeForm({
  tenantId,
  initial,
  employeeId,
  onDone,
  onCancel,
}: {
  tenantId: string
  initial: FormData
  employeeId?: string
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('名前は必須です'); return }
    setSaving(true)
    setError('')
    const res = await fetch(employeeId ? `/api/staff/${employeeId}` : '/api/staff', {
      method: employeeId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tenantId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'エラー')
    } else {
      onDone()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">名前 *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            placeholder="山田 太郎"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">よみがな</label>
          <input
            value={form.name_kana}
            onChange={e => set('name_kana', e.target.value)}
            placeholder="やまだ たろう"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">部署</label>
          <input
            value={form.department}
            onChange={e => set('department', e.target.value)}
            placeholder="営業部"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">役職</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="マネージャー"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">内線 / 携帯</label>
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="090-xxxx-xxxx"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">メールアドレス</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="taro@example.com"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={e => set('is_active', e.target.checked)}
          className="accent-yellow-400"
        />
        有効（折り返し割当の対象にする）
      </label>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {saving ? '保存中...' : employeeId ? '更新' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 text-sm px-4 py-2 rounded-lg transition"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}

export default function StaffManager({
  tenantId,
  initialEmployees,
}: {
  tenantId: string
  initialEmployees: Employee[]
}) {
  const router = useRouter()
  const [employees, setEmployees] = useState(initialEmployees)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('この担当者を削除しますか？\n既に割り当て済みの折り返しからは外れます。')) return
    setDeletingId(id)
    await fetch(`/api/staff/${id}`, { method: 'DELETE' })
    setEmployees(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="self-start bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + 担当者を追加
        </button>
      ) : (
        <EmployeeForm
          tenantId={tenantId}
          initial={emptyForm}
          onDone={() => { setShowAdd(false); router.refresh() }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">名前</th>
              <th className="text-left px-4 py-3">部署 / 役職</th>
              <th className="text-left px-4 py-3">電話</th>
              <th className="text-left px-4 py-3">メール</th>
              <th className="text-left px-4 py-3">状態</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  担当者がまだ登録されていません
                </td>
              </tr>
            )}
            {employees.map(emp => (
              <React.Fragment key={emp.id}>
                <tr className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{emp.name}</div>
                    {emp.name_kana && <div className="text-xs text-slate-400">{emp.name_kana}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[emp.department, emp.title].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{emp.phone || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{emp.email || '-'}</td>
                  <td className="px-4 py-3">
                    {emp.is_active
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">有効</span>
                      : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">無効</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setEditingId(editingId === emp.id ? null : emp.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 transition"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        disabled={deletingId === emp.id}
                        className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-50"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === emp.id && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 bg-slate-50">
                      <EmployeeForm
                        tenantId={tenantId}
                        initial={toFormData(emp)}
                        employeeId={emp.id}
                        onDone={() => { setEditingId(null); router.refresh() }}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
