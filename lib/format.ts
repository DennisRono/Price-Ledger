import type { Product } from './types'

export function formatPrice(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export function formatSize(product: Product): string {
  const v = product.size?.value
  const u = product.size?.unit
  const parts: string[] = []
  if (v != null && u) {
    parts.push(`${v} ${u.replace(/_/g, ' ')}`)
  }
  const pack = product.packaging
  if (pack && pack.units_per_pack > 1) {
    parts.push(`${pack.units_per_pack}-pack`)
  }
  return parts.join(' · ')
}

/** Normalize text for fuzzy-ish search */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build a searchable haystack string for a product */
export function productHaystack(p: Product): string {
  return normalize(
    [
      p.name,
      p.brand,
      p.description,
      p.receipt_name,
      p.barcode,
      p.sku,
      p.category,
      p.subcategory,
      ...(p.tags ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

/** Score a product against a query; higher is better, 0 = no match */
export function scoreProduct(p: Product, query: string, haystack?: string): number {
  const q = normalize(query)
  if (!q) return 0
  const hay = haystack ?? productHaystack(p)
  const name = normalize(p.name)

  let score = 0
  // exact-ish name boosts
  if (name === q) score += 1000
  if (name.startsWith(q)) score += 200
  if (name.includes(q)) score += 120

  // barcode exact
  if (p.barcode && normalize(p.barcode) === q) score += 800

  // all tokens present
  const tokens = q.split(' ').filter(Boolean)
  const allPresent = tokens.every((t) => hay.includes(t))
  if (allPresent) score += 60
  // partial token matches
  for (const t of tokens) {
    if (hay.includes(t)) score += 10
  }
  return score
}
