import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    .from('conversation_flows')
    .select('id, name, flow_json, updated_at')
    .eq('tenant_id', tenantId)
    .eq('name', 'メインフロー')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { flow_json: { nodes: [], edges: [] } })
}

export async function POST(req: NextRequest) {
  const { tenantId, flowJson } = await req.json()
  if (!tenantId || !flowJson) {
    return NextResponse.json({ error: 'tenantId / flowJson が必要です' }, { status: 400 })
  }

  const { error } = await db()
    .from('conversation_flows')
    .upsert(
      { tenant_id: tenantId, name: 'メインフロー', flow_json: flowJson, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,name' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
