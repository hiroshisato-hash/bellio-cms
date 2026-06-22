'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError('送信に失敗しました。時間をおいて再度お試しください')
    } else {
      // メールアドレスの存在有無を漏らさないため、常に成功表示にする
      setSent(true)
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
          <p className="text-slate-500 text-sm mt-3">パスワードの再設定</p>
        </div>
        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-slate-700">
              ご登録のメールアドレス宛に再設定用のリンクを送信しました。メールをご確認ください。
            </p>
            <Link
              href="/login"
              className="text-sm text-slate-500 hover:text-slate-700 transition"
            >
              ログイン画面に戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-slate-500">
              ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold py-2 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loading ? '送信中...' : '再設定リンクを送信'}
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
