import { type NextRequest, NextResponse } from 'next/server'
import { getCatalog, saveCatalog } from '@/lib/store-db'
import type { Product } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Update an existing product (full replace of provided fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  try {
    const { id, productId } = await params
    const catalog = await getCatalog(id)
    if (!catalog) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const updates = (await request.json()) as Partial<Product>
    const index = catalog.products.findIndex((p) => p.id === productId)
    if (index === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const merged: Product = {
      ...catalog.products[index],
      ...updates,
      id: productId,
      pricing: {
        ...catalog.products[index].pricing,
        ...updates.pricing,
      },
      metadata: {
        ...catalog.products[index].metadata,
        ...updates.metadata,
        last_modified: today,
      },
    }

    catalog.products[index] = merged
    await saveCatalog(id, catalog)
    return NextResponse.json({ product: merged })
  } catch (error) {
    console.error('[v0] PATCH product failed:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  try {
    const { id, productId } = await params
    const catalog = await getCatalog(id)
    if (!catalog) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }
    const before = catalog.products.length
    catalog.products = catalog.products.filter((p) => p.id !== productId)
    if (catalog.products.length === before) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    await saveCatalog(id, catalog)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] DELETE product failed:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
