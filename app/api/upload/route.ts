import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const storeId = (formData.get('storeId') ?? 'misc').toString()
    const productId = (formData.get('productId') ?? Date.now().toString()).toString()
    const ext = file.type === 'image/webp' ? 'webp' : 'jpg'

    const blob = await put(
      `catalog/images/${storeId}/${productId}-${Date.now().toString(36)}.${ext}`,
      file,
      {
        access: 'public',
        contentType: file.type || 'image/jpeg',
        addRandomSuffix: false,
      },
    )

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('[v0] Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
