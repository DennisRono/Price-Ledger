'use client'

import type { Product } from '@/lib/types'
import { formatPrice, formatSize } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { ImageOff, Pencil, AlertTriangle } from 'lucide-react'

type ProductCardProps = {
  product: Product
  onEdit: (product: Product) => void
}

export function ProductCard({ product, onEdit }: ProductCardProps) {
  const size = formatSize(product)
  const needsImage = !product.image_url
  const needsPrice =
    product.pricing?.unit_price_cents === null ||
    product.pricing?.unit_price_cents === undefined

  return (
    <article className="group relative flex flex-col border border-border bg-card transition-colors hover:border-foreground/20">
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center border border-border bg-background text-foreground opacity-0 transition-opacity hover:bg-foreground hover:text-background group-hover:opacity-100 focus:opacity-100"
        aria-label={`Edit ${product.name}`}
      >
        <Pencil className="h-4 w-4" />
      </button>

      <div className="flex aspect-square items-center justify-center overflow-hidden border-b border-border bg-muted/30">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url || '/placeholder.svg'}
            alt={product.name}
            className="h-full w-full object-contain mix-blend-multiply"
            loading="lazy"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageOff className="h-7 w-7" />
            <span className="ed-kicker text-[9px]">No Image</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand ? (
          <p className="ed-kicker text-[9px] text-red-600 dark:text-red-400">
            {product.brand}
          </p>
        ) : null}
        <h3 className="font-heading text-sm font-bold leading-tight text-pretty text-foreground">
          {product.name}
        </h3>
        {size ? <p className="text-xs text-muted-foreground">{size}</p> : null}

        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="font-heading text-xl font-black text-foreground">
            {formatPrice(
              product.pricing?.unit_price_cents,
              product.pricing?.currency,
            )}
          </span>
          <div className="flex flex-col items-end gap-1">
            {needsPrice ? (
              <Badge className="bg-red-600 text-white text-[9px] uppercase">
                Set price
              </Badge>
            ) : null}
            {needsImage ? (
              <span className="ed-kicker flex items-center gap-1 text-[8px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Add photo
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
