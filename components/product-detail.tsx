'use client'

import type { Product } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPrice, formatSize } from '@/lib/format'
import { ImageOff, Pencil } from 'lucide-react'

type ProductDetailProps = {
  product: Product | null
  onClose: () => void
  onEdit: (product: Product) => void
}

export function ProductDetail({ product, onClose, onEdit }: ProductDetailProps) {
  if (!product) return null
  const size = formatSize(product)

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none border-2 border-ink bg-paper p-0 sm:max-w-sm">
        <DialogHeader className="border-b-2 border-ink bg-ink px-4 py-3 text-left">
          <DialogTitle className="ed-kicker text-[10px] text-gold">
            Price Lookup
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 p-5 text-center">
          <div className="flex h-36 w-36 items-center justify-center overflow-hidden border-2 border-ink bg-parchment">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url || '/placeholder.svg'}
                alt={product.name}
                className="h-full w-full object-contain mix-blend-multiply"
                crossOrigin="anonymous"
              />
            ) : (
              <ImageOff className="h-9 w-9 text-muted-foreground" />
            )}
          </div>

          {product.brand ? (
            <p className="ed-kicker text-[10px] text-red">{product.brand}</p>
          ) : null}
          <h2 className="font-heading text-xl font-black leading-tight text-balance">
            {product.name}
          </h2>
          {size ? <p className="text-sm text-muted-foreground">{size}</p> : null}

          <div className="ed-rule my-1 w-24" />

          <p className="font-heading text-5xl font-black text-red">
            {formatPrice(product.pricing?.unit_price_cents, product.pricing?.currency)}
          </p>

          {product.barcode ? (
            <p className="ed-kicker text-[10px] text-muted-foreground">
              Barcode: {product.barcode}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full rounded-none border-ink"
            onClick={() => onEdit(product)}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Edit details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
