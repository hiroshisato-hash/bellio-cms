import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { tenantId, question, answer, categoryId } = await req.json()
  if (!tenantId || !question || !answer) {
    return NextResponse.json({ error: 'tenantId / question / answer が必要です' }, { status: 400 })
  }

  // Generate embedding via OpenAI
  const openaiRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: question }),
  })
  if (!openaiRes.ok) {
    const err = await openaiRes.text()
    return NextResponse.json({ error: `Embedding 生成失敗: ${err}` }, { status: 502 })
  }
  const { data } = await openaiRes.json()
  const embedding = data[0].embedding

  // Insert FAQ with embedding (service role to bypass RLS)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: async () => (await cookies()).getAll() } },
  )

  const { error } = await supabase.from('faq_items').insert({
    tenant_id: tenantId,
    question,
    answer,
    embedding,
    category_id: categoryId ?? null,
    is_active: true,
    hit_count: 0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
