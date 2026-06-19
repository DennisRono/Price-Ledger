import { type NextRequest, NextResponse } from 'next/server'
import { getStores, createStore } from '@/lib/store-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stores = await getStores()
    return NextResponse.json({ stores })
  } catch (error) {
    console.error('[v0] GET /api/stores failed:', error)
    return NextResponse.json({ error: 'Failed to load stores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = (body?.name ?? '').toString().trim()
    if (!name) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
    }
    const copyFromId = body?.copyFromId ? body.copyFromId.toString() : undefined
    const meta = await createStore(name, copyFromId)
    return NextResponse.json({ store: meta })
  } catch (error) {
    console.error('[v0] POST /api/stores failed:', error)
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 })
  }
}
