'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError('再設定に失敗しました。リンクの有効期限が切れている可能性があります。お手数ですが再度お試しください')
    } else {
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/bellio-logo.png"
            alt="Bellio"
            width={500}
            height={130}
            priority
            className="mx-auto h-12 w-auto"
          />
          <p className="text-slate-500 text-sm mt-3">新しいパスワードを設定</p>
        </div>
        {done ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-slate-700">パスワードを再設定しました。管理画面に移動します...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">新しいパスワード</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">新しいパスワード（確認）</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold py-2 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loading ? '設定中...' : 'パスワードを再設定'}
            </button>
            <Link
              href="/login"
              className="text-center text-sm text-slate-500 hover:text-slate-700 transition"
            >
              ログイン画面に戻る
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
