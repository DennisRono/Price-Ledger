import { type NextRequest, NextResponse } from 'next/server'
import { getCatalog } from '@/lib/store-db'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const catalog = await getCatalog(id)
    if (!catalog) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }
    return NextResponse.json({ catalog })
  } catch (error) {
    console.error('[v0] GET /api/stores/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })
  }
}
