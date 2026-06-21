'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '@/lib/types'
import {
  formatPrice,
  formatSize,
  productHaystack,
  scoreProduct,
} from '@/lib/format'
import { Search, X, ImageOff } from 'lucide-react'

type SearchBarProps = {
  products: Product[]
  value: string
  onValueChange: (v: string) => void
  onSelect: (product: Product) => void
  className?: string
  posMode?: boolean
}

export function SearchBar({
  products,
  value,
  onValueChange,
  onSelect,
  className,
  posMode = false
}: SearchBarProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // precompute haystacks once per products change
  const haystacks = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) map.set(p.id, productHaystack(p))
    return map
  }, [products])

  const results = useMemo(() => {
    if (!value.trim()) return []
    return products
      .map((p) => ({ p, score: scoreProduct(p, value, haystacks.get(p.id)) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((r) => r.p)
  }, [value, products, haystacks])

  useEffect(() => {
    setActiveIndex(0)
  }, [value])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = results[activeIndex]
      if (picked) {
        onSelect(picked)
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={`"relative w-full " ${className}`}>
      <div className="flex items-center gap-2 border-2 border-ink bg-card px-3 py-2.5 shadow-[3px_3px_0_0_var(--ink)]">
        <Search className="h-5 w-5 shrink-0 text-ink" />
        <input
          type="search"
          inputMode="search"
          value={value}
          placeholder="Search products by name, brand, barcode…"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            onValueChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search products"
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onValueChange('')
              setOpen(false)
            }}
            aria-label="Clear search"
            className="shrink-0 text-muted-foreground hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {!posMode && open && value.trim() && results.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-[60vh] w-full overflow-auto border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--ink)]">
          {results.map((p, i) => {
            const activePromotions =
              p.promotions?.filter((pr: any) => pr.active) ?? []
            const promotionLabels = activePromotions
              .map((pr: any) => pr.label)
              .join(', ')

            return (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    onSelect(p)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 border-b border-ink/10 px-3 py-2 text-left ${
                    i === activeIndex ? 'bg-parchment' : 'bg-card'
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-parchment">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url || '/placeholder.svg'}
                        alt=""
                        className="h-full w-full object-contain mix-blend-multiply"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <ImageOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>

                  {/* Product info */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[p.brand, formatSize(p)].filter(Boolean).join(' · ')}
                    </span>
                  </span>

                  {/* Price + Promotion */}
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-heading text-base font-black text-red">
                      {formatPrice(
                        p.pricing?.unit_price_cents,
                        p.pricing?.currency,
                      )}
                    </span>
                    {promotionLabels && (
                      <span className="text-xs font-medium text-green-600">
                        {promotionLabels}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {!posMode && open && value.trim() && results.length === 0 ? (
        <div className="absolute z-50 mt-1 w-full border-2 border-ink bg-card px-3 py-4 text-center text-sm text-muted-foreground shadow-[4px_4px_0_0_var(--ink)]">
          No products match “{value}”.
        </div>
      ) : null}
    </div>
  )
}
