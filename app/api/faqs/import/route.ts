import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCsv } from '@/lib/csv'

const MAX_CATEGORIES = 9
const MAX_ROWS = 500

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// OpenAI embedding をバッチ生成（input配列で1回のAPI呼び出し）
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  })
  if (!res.ok) throw new Error(`Embedding 生成失敗: ${await res.text()}`)
  const json = await res.json() as { data: { embedding: number[]; index: number }[] }
  // index順に整列
  return json.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

// POST /api/faqs/import  body: { tenantId, csv }
export async function POST(req: NextRequest) {
  const { tenantId, csv } = await req.json()
  if (!tenantId || typeof csv !== 'string') {
    return NextResponse.json({ error: 'tenantId / csv が必要です' }, { status: 400 })
  }

  const rows = parseCsv(csv)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSVが空です' }, { status: 400 })
  }

  // ヘッダー検出（「質問」「回答」を含む行ならスキップ）
  const header = rows[0].map(c => c.trim())
  const hasHeader = header.some(c => c.includes('質問')) && header.some(c => c.includes('回答'))
  const dataRows = hasHeader ? rows.slice(1) : rows

  if (dataRows.length > MAX_ROWS) {
    return NextResponse.json({ error: `一度にインポートできるのは${MAX_ROWS}件までです（${dataRows.length}件）` }, { status: 400 })
  }

  // 列順: カテゴリ, 質問, 回答, (有効)
  type Row = { category: string; question: string; answer: string; active: boolean }
  const parsed: Row[] = []
  const errors: string[] = []
  dataRows.forEach((r, i) => {
    const category = (r[0] ?? '').trim()
    const question = (r[1] ?? '').trim()
    const answer = (r[2] ?? '').trim()
    const activeRaw = (r[3] ?? '').trim()
    if (!question || !answer) {
      errors.push(`${i + 1}行目: 質問または回答が空です`)
      return
    }
    parsed.push({ category, question, answer, active: activeRaw !== '0' && activeRaw !== 'false' })
  })

  if (parsed.length === 0) {
    return NextResponse.json({ error: '登録できる行がありません', details: errors }, { status: 400 })
  }

  const sb = db()

  // 1. カテゴリ解決（既存＋必要なら新規作成、最大9個）
  const { data: existingCats } = await sb
    .from('faq_categories')
    .select('id, name, display_order')
    .eq('tenant_id', tenantId)
  const catMap = new Map<string, string>((existingCats ?? []).map(c => [c.name as string, c.id as string]))
  let catCount = existingCats?.length ?? 0
  let nextOrder = Math.max(-1, ...(existingCats ?? []).map(c => c.display_order as number)) + 1

  const neededCats = [...new Set(parsed.map(p => p.category).filter(Boolean))]
  for (const name of neededCats) {
    if (catMap.has(name)) continue
    if (catCount >= MAX_CATEGORIES) {
      errors.push(`カテゴリ「${name}」は上限${MAX_CATEGORIES}個超過のため未分類で登録`)
      continue
    }
    const { data, error } = await sb
      .from('faq_categories')
      .insert({ tenant_id: tenantId, name, display_order: nextOrder++ })
      .select('id')
      .single()
    if (!error && data) { catMap.set(name, data.id); catCount++ }
  }

  // 2. embedding をバッチ生成
  let embeddings: number[][]
  try {
    embeddings = await embedBatch(parsed.map(p => p.question))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }

  // 3. 一括 insert
  const records = parsed.map((p, i) => ({
    tenant_id: tenantId,
    question: p.question,
    answer: p.answer,
    embedding: embeddings[i],
    category_id: p.category ? (catMap.get(p.category) ?? null) : null,
    is_active: p.active,
    hit_count: 0,
  }))

  const { error } = await sb.from('faq_items').insert(records)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, imported: records.length, warnings: errors })
}
