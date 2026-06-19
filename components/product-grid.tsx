'use client'

import type { Product } from '@/lib/types'
import { ProductCard } from './product-card'

type ProductGridProps = {
  products: Product[]
  onEdit: (product: Product) => void
}

export function ProductGrid({ products, onEdit }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="border-2 border-dashed border-ink/30 bg-card px-6 py-16 text-center">
        <p className="font-heading text-lg font-bold">No items found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try a different search or clear your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onEdit={onEdit} />
      ))}
    </div>
  )
}
