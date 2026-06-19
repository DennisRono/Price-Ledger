'use client'

import type { Category } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type Filters = {
  category: string
  packaging: string
  sort: string
  onlyMissingImage: boolean
  onlyMissingPrice: boolean
}

export const defaultFilters: Filters = {
  category: 'all',
  packaging: 'all',
  sort: 'name',
  onlyMissingImage: false,
  onlyMissingPrice: false,
}

type FilterBarProps = {
  categories: Category[]
  filters: Filters
  onChange: (f: Filters) => void
  resultCount: number
}

export function FilterBar({ categories, filters, onChange, resultCount }: FilterBarProps) {
  const topLevel = categories.filter((c) => c.parentId === null)
  const subByParent = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId)

  function toggle(key: 'onlyMissingImage' | 'onlyMissingPrice') {
    onChange({ ...filters, [key]: !filters[key] })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Select
          value={filters.category}
          onValueChange={(v) => onChange({ ...filters, category: v ?? 'all' })}
        >
          <SelectTrigger className="rounded-none border-ink bg-card font-medium">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {topLevel.map((cat) => (
              <SelectGroupItems key={cat.id} cat={cat} subs={subByParent(cat.id)} />
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.packaging}
          onValueChange={(v) => onChange({ ...filters, packaging: v ?? 'all' })}
        >
          <SelectTrigger className="rounded-none border-ink bg-card font-medium">
            <SelectValue placeholder="Pack size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pack sizes</SelectItem>
            <SelectItem value="single">Singles</SelectItem>
            <SelectItem value="pack">Multi-packs</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.sort}
          onValueChange={(v) => onChange({ ...filters, sort: v ?? 'name' })}
        >
          <SelectTrigger className="rounded-none border-ink bg-card font-medium">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="recent">Recently modified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={filters.onlyMissingPrice}
            onClick={() => toggle('onlyMissingPrice')}
          >
            Needs price
          </FilterChip>
          <FilterChip
            active={filters.onlyMissingImage}
            onClick={() => toggle('onlyMissingImage')}
          >
            Needs photo
          </FilterChip>
        </div>
        <span className="ed-kicker text-[10px] text-muted-foreground">
          {resultCount} {resultCount === 1 ? 'item' : 'items'}
        </span>
      </div>
    </div>
  )
}

function SelectGroupItems({ cat, subs }: { cat: Category; subs: Category[] }) {
  return (
    <>
      <SelectItem value={cat.id} className="font-semibold">
        {cat.name}
      </SelectItem>
      {subs.map((s) => (
        <SelectItem key={s.id} value={s.id} className="pl-6 text-sm">
          {s.name}
        </SelectItem>
      ))}
    </>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`ed-kicker border px-3 py-1.5 text-[10px] transition-colors ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-ink/30 bg-card text-ink hover:border-ink'
      }`}
    >
      {children}
    </button>
  )
}
