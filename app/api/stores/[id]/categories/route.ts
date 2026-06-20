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

  // Validate name
  const trimmedName = name?.trim()
  if (!trimmedName) {
    return NextResponse.json(
      { error: 'Category name is required' },
      { status: 400 }
    )
  }

  // Normalise parentId: null for top‑level
  const normalisedParentId = parentId || null

  // --- Duplicate check ---
  // Case‑insensitive check within the same parent
  const exists = catalog.categories.some(
    (c) =>
      c.name.toLowerCase() === trimmedName.toLowerCase() &&
      c.parentId === normalisedParentId
  )

  if (exists) {
    return NextResponse.json(
      { error: 'A category with this name already exists under the same parent' },
      { status: 409 } // Conflict
    )
  }

  // Create and save the new category
  const newCategory: Category = {
    id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmedName,
    parentId: normalisedParentId,
  }

  catalog.categories.push(newCategory)
  await saveCatalog(id, catalog)

  return NextResponse.json({ category: newCategory }, { status: 201 })
}