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
import { ImageOff, Pencil, Package, Tag, Coffee, AlertCircle } from 'lucide-react'

type ProductDetailProps = {
  product: Product | null
  onClose: () => void
  onEdit: (product: Product) => void
}

export function ProductDetail({ product, onClose, onEdit }: ProductDetailProps) {
  if (!product) return null

  const size = formatSize(product)
  const hasPromotions = product.promotions && product.promotions.length > 0
  const isAgeRestricted = product.compliance?.age_restricted ?? false

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none border-2 border-ink bg-paper p-0 sm:max-w-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="border-b-2 border-ink bg-ink px-4 py-3 text-left flex-shrink-0">
          <DialogTitle className="ed-kicker text-[10px] text-gold">
            Product Details
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Image column */}
            <div className="flex flex-col items-center md:w-1/3">
              <div className="flex h-36 w-36 items-center justify-center overflow-hidden border-2 border-ink bg-parchment flex-shrink-0">
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

              {/* Quick identifiers */}
              <div className="mt-3 w-full text-center space-y-1">
                {product.brand && (
                  <p className="ed-kicker text-[10px] text-red">{product.brand}</p>
                )}
                <h2 className="font-heading text-xl font-black leading-tight text-balance">
                  {product.name}
                </h2>
                {size && <p className="text-sm text-muted-foreground">{size}</p>}
                {product.sku && (
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                )}
                {product.barcode && (
                  <p className="text-xs text-muted-foreground">Barcode: {product.barcode}</p>
                )}
                {product.status && (
                  <p className="text-xs font-medium capitalize">
                    Status: <span className="text-ink">{product.status}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Details column */}
            <div className="flex-1 space-y-4">
              {/* Description */}
              {product.description && (
                <div>
                  <h4 className="ed-kicker text-[10px] text-muted-foreground">Description</h4>
                  <p className="text-sm">{product.description}</p>
                </div>
              )}

              {/* Grid of detail fields */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {product.receipt_name && product.receipt_name !== product.name && (
                  <>
                    <span className="text-muted-foreground">Receipt name</span>
                    <span className="font-mono text-xs">{product.receipt_name}</span>
                  </>
                )}
                {product.category && (
                  <>
                    <span className="text-muted-foreground">Category</span>
                    <span className="capitalize">{product.category}</span>
                  </>
                )}
                {product.subcategory && (
                  <>
                    <span className="text-muted-foreground">Subcategory</span>
                    <span className="capitalize">{product.subcategory}</span>
                  </>
                )}
                {product.container && (
                  <>
                    <span className="text-muted-foreground">Container</span>
                    <span className="capitalize">{product.container}</span>
                  </>
                )}
                {product.packaging?.type && (
                  <>
                    <span className="text-muted-foreground">Packaging</span>
                    <span className="capitalize">
                      {product.packaging.type}
                      {product.packaging.units_per_pack > 1 &&
                        ` (${product.packaging.units_per_pack} units)`}
                    </span>
                  </>
                )}
                {product.manufacturer && (
                  <>
                    <span className="text-muted-foreground">Manufacturer</span>
                    <span>{product.manufacturer}</span>
                  </>
                )}
              </div>

              <div className="ed-rule my-1" />

              {/* Pricing & Promotions */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-heading text-4xl font-black text-red">
                    {formatPrice(product.pricing?.unit_price_cents, product.pricing?.currency)}
                  </span>
                  {product.pricing?.price_status && (
                    <span className="text-xs text-muted-foreground">
                      {product.pricing.price_status.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {hasPromotions && (
                  <div className="mt-2 space-y-1">
                    <h4 className="ed-kicker text-[10px] text-muted-foreground">Promotions</h4>
                    {product.promotions?.map((promo: any, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {promo.label || `${promo.buy_qty} for ${formatPrice(promo.bundle_price_cents, product.pricing?.currency)}`}
                          {!promo.active && ' (inactive)'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ed-rule my-1" />

              {/* Tax & Compliance */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Taxable</span>
                <span>{product.tax?.taxable ? 'Yes' : 'No'}</span>
                {product.tax?.tax_category && (
                  <>
                    <span className="text-muted-foreground">Tax category</span>
                    <span className="capitalize">{product.tax.tax_category.replace('_', ' ')}</span>
                  </>
                )}
                <span className="text-muted-foreground">Age restricted</span>
                <span className="flex items-center gap-1">
                  {isAgeRestricted ? (
                    <>
                      <AlertCircle className="h-3 w-3 text-red" />
                      Yes {product.compliance?.minimum_age && `(${product.compliance.minimum_age}+)`}
                    </>
                  ) : (
                    'No'
                  )}
                </span>
              </div>

              <div className="ed-rule my-1" />

              {/* Inventory & Flags */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Track inventory</span>
                <span>{product.inventory?.track_inventory ? 'Yes' : 'No'}</span>
                {product.inventory?.quantity_on_hand !== null && product.inventory?.quantity_on_hand !== undefined && (
                  <>
                    <span className="text-muted-foreground">On hand</span>
                    <span>{product.inventory.quantity_on_hand}</span>
                  </>
                )}
                {product.inventory?.reorder_point !== null && product.inventory?.reorder_point !== undefined && (
                  <>
                    <span className="text-muted-foreground">Reorder point</span>
                    <span>{product.inventory.reorder_point}</span>
                  </>
                )}
                <span className="text-muted-foreground">Returnable</span>
                <span>{product.flags?.returnable ? 'Yes' : 'No'}</span>
                <span className="text-muted-foreground">Refundable</span>
                <span>{product.flags?.refundable ? 'Yes' : 'No'}</span>
                {product.flags?.seasonal && (
                  <>
                    <span className="text-muted-foreground">Seasonal</span>
                    <span>Yes</span>
                  </>
                )}
                {product.flags?.discontinued && (
                  <>
                    <span className="text-muted-foreground">Discontinued</span>
                    <span>Yes</span>
                  </>
                )}
              </div>

              <div className="ed-rule my-1" />

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {product.metadata?.date_added && (
                  <>
                    <span>Added</span>
                    <span>{new Date(product.metadata.date_added).toLocaleDateString()}</span>
                  </>
                )}
                {product.metadata?.last_modified && (
                  <>
                    <span>Last modified</span>
                    <span>{new Date(product.metadata.last_modified).toLocaleDateString()}</span>
                  </>
                )}
                {product.metadata?.needs_review && (
                  <>
                    <span className="text-red">Needs review</span>
                    <span className="text-red">{product.metadata.review_note || 'Yes'}</span>
                  </>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full rounded-none border-ink"
                onClick={() => onEdit(product)}
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Edit details
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}