import type { Product } from './types'

export function priceCents(p: Product): number {
  return p.pricing.unit_price_cents ?? 0
}

export function isTaxable(p: Product): boolean {
  return p.tax?.taxable ?? true
}

export function stockOf(p: Product): number {
  return p.inventory?.quantity_on_hand ?? 0
}

export function withStockDelta(p: Product, delta: number): Product {
  if (delta === 0) return p
  return {
    ...p,
    inventory: {
      ...p.inventory,
      quantity_on_hand: stockOf(p) + delta,
    },
  }
}