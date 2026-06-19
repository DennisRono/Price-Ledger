import type { Product, StoreCatalog, StoreMeta } from './types'

export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

export async function createStoreReq(
  name: string,
  copyFromId?: string,
): Promise<StoreMeta> {
  const res = await fetch('/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, copyFromId }),
  })
  if (!res.ok) throw new Error('Failed to create store')
  const data = await res.json()
  return data.store
}

export async function addProductReq(
  storeId: string,
  product: Product,
): Promise<Product> {
  const res = await fetch(`/api/stores/${storeId}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  })
  if (!res.ok) throw new Error('Failed to add product')
  const data = await res.json()
  return data.product
}

export async function updateProductReq(
  storeId: string,
  productId: string,
  updates: Partial<Product>,
): Promise<Product> {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update product')
  const data = await res.json()
  return data.product
}

export async function deleteProductReq(
  storeId: string,
  productId: string,
): Promise<void> {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete product')
}

export async function uploadImageReq(
  blob: Blob,
  storeId: string,
  productId: string,
): Promise<string> {
  const form = new FormData()
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  form.append('file', blob, `${productId}.${ext}`)
  form.append('storeId', storeId)
  form.append('productId', productId)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.url as string
}

export type { Product, StoreCatalog, StoreMeta }
