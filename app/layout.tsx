import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bellio CMS',
  description: 'AI電話受付管理システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
