import { type NextRequest, NextResponse } from 'next/server'
import { getCatalog, saveCatalog, nextProductId } from '@/lib/store-db'
import type { Product } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Create a new product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const catalog = await getCatalog(id)
    if (!catalog) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const product = (await request.json()) as Product
    if (!product?.name?.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const newProduct: Product = {
      ...product,
      id: product.id || nextProductId(catalog),
      metadata: {
        ...product.metadata,
        date_added: product.metadata?.date_added ?? today,
        last_modified: today,
      },
    }

    catalog.products.push(newProduct)
    await saveCatalog(id, catalog)
    return NextResponse.json({ product: newProduct })
  } catch (error) {
    console.error('[v0] POST products failed:', error)
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 })
  }
}
