import { put, list } from '@vercel/blob'
import type { StoreCatalog, StoreIndex, StoreMeta, Product } from './types'
import seed from '@/data/seed-store.json'

const INDEX_PATH = 'catalog/index.json'
const storePath = (id: string) => `catalog/stores/${id}.json`

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'store'
  )
}

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function findBlobUrl(pathname: string): Promise<string | null> {
  const { blobs } = await list({ prefix: pathname })
  const match = blobs.find((b) => b.pathname === pathname)
  return match?.url ?? null
}

async function writeJson(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })
}

async function readIndex(): Promise<StoreIndex | null> {
  const url = await findBlobUrl(INDEX_PATH)
  if (!url) return null
  return readJson<StoreIndex>(url)
}

async function writeIndex(index: StoreIndex): Promise<void> {
  await writeJson(INDEX_PATH, index)
}

/** Ensure the seed store exists on first run. Returns the store index. */
export async function ensureSeeded(): Promise<StoreIndex> {
  const existing = await readIndex()
  if (existing && existing.stores.length > 0) return existing

  const seedCatalog = seed as unknown as StoreCatalog
  const id = slugify(seedCatalog.store)
  await writeJson(storePath(id), seedCatalog)

  const index: StoreIndex = {
    stores: [
      {
        id,
        name: seedCatalog.store,
        createdAt: new Date().toISOString(),
        productCount: seedCatalog.products.length,
      },
      {
        id: 'pitt-quick-stop-at-ensley',
        name: 'Pitt Quick Stop at Ensley',
        createdAt: '2026-06-21T20:32:12.237Z',
        productCount: 295,
      },
    ],
  }
  await writeIndex(index)
  return index
}

export async function getStores(): Promise<StoreMeta[]> {
  const index = await ensureSeeded()
  return index.stores
}

export async function getCatalog(id: string): Promise<StoreCatalog | null> {
  await ensureSeeded()
  const url = await findBlobUrl(storePath(id))
  if (!url) return null
  return readJson<StoreCatalog>(url)
}

export async function saveCatalog(
  id: string,
  catalog: StoreCatalog,
): Promise<void> {
  await writeJson(storePath(id), catalog)
  // keep index product counts/name in sync
  const index = (await readIndex()) ?? { stores: [] }
  const meta = index.stores.find((s) => s.id === id)
  if (meta) {
    meta.productCount = catalog.products.length
    meta.name = catalog.store
    await writeIndex(index)
  }
}

export async function createStore(
  name: string,
  copyFromId?: string,
): Promise<StoreMeta> {
  const index = await ensureSeeded()
  let id = slugify(name)
  // ensure unique id
  if (index.stores.some((s) => s.id === id)) {
    id = `${id}-${Date.now().toString(36).slice(-4)}`
  }

  let catalog: StoreCatalog
  if (copyFromId) {
    const source = await getCatalog(copyFromId)
    catalog = {
      store: name,
      generated: new Date().toISOString().slice(0, 10),
      schema_version: source?.schema_version ?? '1.0.0',
      categories: source?.categories ?? [],
      tax_categories: source?.tax_categories ?? [],
      products: (source?.products ?? []).map((p) => ({ ...p })),
    }
  } else {
    catalog = {
      store: name,
      generated: new Date().toISOString().slice(0, 10),
      schema_version: '1.0.0',
      categories: [],
      tax_categories: [],
      products: [],
    }
  }

  await writeJson(storePath(id), catalog)
  const meta: StoreMeta = {
    id,
    name,
    createdAt: new Date().toISOString(),
    productCount: catalog.products.length,
  }
  index.stores.push(meta)
  await writeIndex(index)
  return meta
}

/** Generate the next product id for a store, e.g. PQS-0085 style or generic. */
export function nextProductId(catalog: StoreCatalog): string {
  const prefixes = catalog.products
    .map((p) => /^([A-Z]+)-(\d+)$/.exec(p.id))
    .filter(Boolean) as RegExpExecArray[]

  if (prefixes.length > 0) {
    const prefix = prefixes[0][1]
    const maxNum = prefixes.reduce((max, m) => {
      if (m[1] !== prefix) return max
      return Math.max(max, Number.parseInt(m[2], 10))
    }, 0)
    const next = (maxNum + 1).toString().padStart(4, '0')
    return `${prefix}-${next}`
  }
  return `P-${(catalog.products.length + 1).toString().padStart(4, '0')}`
}

export function emptyProduct(catalog: StoreCatalog): Product {
  const id = nextProductId(catalog)
  const today = new Date().toISOString().slice(0, 10)
  return {
    id,
    sku: id,
    barcode: null,
    barcode_status: 'pending',
    name: '',
    description: '',
    brand: '',
    category: '',
    subcategory: '',
    tags: [],
    size: { value: null, unit: null },
    container: '',
    packaging: { type: 'single', units_per_pack: 1 },
    image_url: null,
    pricing: {
      currency: 'USD',
      unit_price_cents: null,
      price_status: 'pending',
      last_updated: today,
    },
    status: 'active',
    metadata: {
      source: 'manual_entry',
      date_added: today,
      last_modified: today,
      needs_review: false,
    },
  }
}
