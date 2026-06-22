import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHAT_MODEL = 'gpt-4o-mini'
const MAX_INPUT_CHARS = 12000

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// URLからテキストを取得（HTMLタグを除去・best-effort）
async function fetchUrlText(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error('URLは http(s) で始めてください')
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Bellio-FAQ-Bot/1.0' },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`URL取得失敗: ${res.status}`)
  const html = await res.text()
  // script/style除去 → タグ除去 → 空白圧縮
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, MAX_INPUT_CHARS)
}

async function chatJson(system: string, user: string): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`AI生成失敗: ${await res.text()}`)
  const json = await res.json() as { choices: { message: { content: string } }[] }
  return JSON.parse(json.choices[0].message.content) as Record<string, unknown>
}

const SYSTEM_PROMPT =
  'あなたは電話AI受付のFAQ作成アシスタントです。' +
  '会社・サービスの説明から、お客様が電話で実際に聞きそうな質問と、' +
  'それに対する簡潔で自然な「読み上げ用」の回答（日本語・丁寧語・1〜3文）を作ります。' +
  '回答は電話で聞いて分かりやすい話し言葉にし、URLや箇条書き記号は使いません。'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tenantId, mode } = body
  if (!tenantId) return NextResponse.json({ error: 'tenantId が必要です' }, { status: 400 })
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY が未設定です' }, { status: 500 })
  }

  // 既存カテゴリを取得（できるだけ流用させる）
  const { data: cats } = await db()
    .from('faq_categories').select('name').eq('tenant_id', tenantId)
  const catNames = (cats ?? []).map(c => c.name as string)
  const catHint = catNames.length
    ? `既存カテゴリ（できるだけこの中から選ぶ）: ${catNames.join('、')}。`
    : 'カテゴリは内容に合う短い名詞（例：営業時間、料金、アクセス）を付ける。'

  try {
    // --- 確認質問への回答から1件生成 ---
    if (mode === 'clarify') {
      const { context, question, answer } = body
      const out = await chatJson(
        SYSTEM_PROMPT,
        `次の説明と、確認質問への回答をもとに、FAQを1件だけ作ってください。\n` +
        `${catHint}\n` +
        `JSON形式: {"faq":{"question":"...","answer":"...","category":"..."}}\n\n` +
        `【説明】\n${String(context ?? '').slice(0, MAX_INPUT_CHARS)}\n\n` +
        `【確認質問】${question}\n【回答】${answer}`,
      )
      return NextResponse.json({ faq: out.faq ?? null })
    }

    // --- テキスト/URL からFAQ案＋確認質問を生成 ---
    let text: string = String(body.text ?? '')
    if (body.url) {
      const urlText = await fetchUrlText(String(body.url))
      text = (text ? text + '\n\n' : '') + urlText
    }
    text = text.slice(0, MAX_INPUT_CHARS)
    if (!text.trim()) {
      return NextResponse.json({ error: 'テキストかURLを入力してください' }, { status: 400 })
    }

    const out = await chatJson(
      SYSTEM_PROMPT,
      `次の説明文から、電話でよく聞かれそうなFAQを5〜10件作ってください。\n` +
      `さらに、説明文だけでは判断できない重要事項について、担当者に確認したい質問を` +
      `2〜4件挙げ、それぞれに2〜4個の回答選択肢を付けてください（担当者が選ぶだけでFAQ化できるように）。\n` +
      `${catHint}\n` +
      `JSON形式: {"faqs":[{"question":"...","answer":"...","category":"..."}],` +
      `"clarifications":[{"question":"確認したいこと","options":["選択肢1","選択肢2"]}]}\n\n` +
      `【説明文】\n${text}`,
    )
    return NextResponse.json({
      faqs: Array.isArray(out.faqs) ? out.faqs : [],
      clarifications: Array.isArray(out.clarifications) ? out.clarifications : [],
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
