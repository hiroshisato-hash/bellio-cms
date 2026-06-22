import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getCurrentTenantId } from '@/lib/get-current-tenant'

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const ALLOWED = ['pending', 'in_progress', 'completed', 'cancelled'] as const

// 折り返し依頼の消し込み（ステータス更新）。
// 完了/対応不要にしたときは completed_at と resolved_by を記録し、
// 未対応/対応中に戻したときはクリアする。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(user.email)
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const { callbackId, status } = await req.json()
  if (!callbackId) return NextResponse.json({ error: 'callbackId required' }, { status: 400 })
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }

  const resolved = status === 'completed' || status === 'cancelled'
  const patch = {
    status,
    completed_at: resolved ? new Date().toISOString() : null,
    resolved_by:  resolved ? (user.email ?? null) : null,
  }

  // tenant スコープを必ず付与して他テナントの行を更新できないようにする
  const { error } = await db()
    .from('callback_requests')
    .update(patch)
    .eq('id', callbackId)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
