import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, saveCatalog } from '@/lib/store-db'
import { Category } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const catalog = await getCatalog(id)
  if (!catalog) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const body = await request.json()
  const { name, parentId } = body
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Category name required' }, { status: 400 })
  }

  const newCategory: Category = {
    id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    parentId: parentId || null,
  }

  catalog.categories.push(newCategory)
  await saveCatalog(id, catalog)

  return NextResponse.json({ category: newCategory }, { status: 201 })
}