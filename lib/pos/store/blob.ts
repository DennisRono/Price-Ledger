import type { StoreCatalog, StoreIndex } from './types'

const BLOB_BASE = process.env.NEXT_PUBLIC_BLOB_BASE_URL || ''

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchIndex(): Promise<StoreIndex | null> {
  if (!BLOB_BASE) {
    console.warn('NEXT_PUBLIC_BLOB_BASE_URL is not set – catalog will not load')
    return null
  }
  return fetchJson<StoreIndex>(`${BLOB_BASE}/catalog/index.json`)
}

export async function fetchCatalog(storeId: string): Promise<StoreCatalog | null> {
  if (!BLOB_BASE) return null
  return fetchJson<StoreCatalog>(`${BLOB_BASE}/catalog/stores/${storeId}.json`)
}
