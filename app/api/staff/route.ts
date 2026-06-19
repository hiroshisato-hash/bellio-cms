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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(user.email)
  if (!tenantId) return NextResponse.json([])

  const { data, error } = await db()
    .from('employees')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, name, name_kana, department, title, email, phone, is_active } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })

  const currentTenantId = await getCurrentTenantId(user.email)
  if (currentTenantId !== tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await db()
    .from('employees')
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      name_kana: name_kana?.trim() || null,
      department: department?.trim() || null,
      title: title?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      is_active: is_active ?? true,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
