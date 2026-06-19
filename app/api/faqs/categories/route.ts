import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MAX_CATEGORIES = 9

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'tenantId が必要です' }, { status: 400 })

  const { data, error } = await db()
    .from('faq_categories')
    .select('id, name, display_order, is_active')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { tenantId, name } = await req.json()
  if (!tenantId || !name?.trim()) {
    return NextResponse.json({ error: 'tenantId / name が必要です' }, { status: 400 })
  }

  // 最大9個チェック
  const { count } = await db()
    .from('faq_categories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if ((count ?? 0) >= MAX_CATEGORIES) {
    return NextResponse.json({ error: `カテゴリは最大${MAX_CATEGORIES}個までです` }, { status: 400 })
  }

  const { data: maxOrder } = await db()
    .from('faq_categories')
    .select('display_order')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxOrder?.display_order ?? -1) + 1

  const { data, error } = await db()
    .from('faq_categories')
    .insert({ tenant_id: tenantId, name: name.trim(), display_order: nextOrder })
    .select('id, name, display_order, is_active')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '同じ名前のカテゴリが既に存在します' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
