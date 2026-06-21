import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { toCsv } from '@/lib/csv'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/faqs/export?tenantId=... → FAQ全件をCSVダウンロード
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'tenantId が必要です' }, { status: 400 })

  const sb = db()
  const [{ data: faqs }, { data: cats }] = await Promise.all([
    sb.from('faq_items')
      .select('question, answer, category_id, is_active')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    sb.from('faq_categories').select('id, name').eq('tenant_id', tenantId),
  ])

  const catName = new Map((cats ?? []).map(c => [c.id as string, c.name as string]))
  const rows: string[][] = [['カテゴリ', '質問', '回答', '有効']]
  for (const f of faqs ?? []) {
    rows.push([
      f.category_id ? (catName.get(f.category_id) ?? '') : '',
      f.question ?? '',
      f.answer ?? '',
      f.is_active ? '1' : '0',
    ])
  }

  const csv = toCsv(rows)
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bellio-faq-${date}.csv"`,
    },
  })
}
