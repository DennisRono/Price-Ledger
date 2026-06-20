'use client'

import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Package,
  Grid2x2,
  List,
  ArrowLeft,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePOS } from '@/lib/pos/store'
import { money } from '@/lib/pos/format'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import type { Product, StoreCatalog, StoreIndex, StoreMeta } from '@/lib/types'
import { fetcher } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Memoized Sortable product card
// ---------------------------------------------------------------------------

interface SortableProductCardProps {
  product: Product
  index: number
}

const SortableProductCard = memo(function SortableProductCard({
  product,
  index,
}: SortableProductCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const price = product?.pricing?.unit_price_cents ?? 0
  const isPack = (product.packaging?.units_per_pack ?? 1) > 1

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <Card
        className={cn(
          'relative overflow-hidden transition-all hover:shadow-md',
          isDragging && 'shadow-lg ring-2 ring-primary',
        )}
      >
        <CardContent className="p-1 cursor-pointer">
          <div className="flex items-start gap-1">
            <div
              {...attributes}
              {...listeners}
              className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="size-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col items-start justify-between">
                <div className="truncate text-sm font-medium">
                  {product.name}
                </div>
                <div className="shrink-0 text-sm font-semibold tabular-nums">
                  {money(price)}
                </div>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {product.category && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {product.category}
                  </Badge>
                )}
                {isPack && (
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {product.packaging?.units_per_pack}‑pack
                  </Badge>
                )}
                {product.inventory?.quantity_on_hand !== undefined && (
                  <span className="tabular-nums">
                    Stock: {product.inventory.quantity_on_hand}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Memoized Category card
// ---------------------------------------------------------------------------

interface CategoryCardProps {
  name: string
  count: number
  onClick: () => void
}

const CategoryCard = memo(function CategoryCard({
  name,
  count,
  onClick,
}: CategoryCardProps) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-sm"
      onClick={onClick}
    >
      <CardContent className="p-2 text-center">
        <CardTitle className="text-xs leading-tight">
          {name}
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          {count}
        </p>
      </CardContent>
    </Card>
  )
})

// ---------------------------------------------------------------------------
// Main ProductsGrid – optimised with memoisation
// ---------------------------------------------------------------------------

type ViewMode = 'categories' | 'products' | 'category'

type ProductGridProps = {
  onSearch?: () => void
}

export function ProductGrid({ onSearch }: ProductGridProps) {
  const { state, actions } = usePOS()

  // 1. Fetch stores
  const {
    data: storeData,
    error: storesError,
    isLoading: storesLoading,
  } = useSWR<{ stores: StoreMeta[] }>('/api/stores', fetcher)

  const stores = storeData?.stores ?? []

  // 2. Derive active store ID – no need for an effect
  const [activeStoreId, setActiveStoreId] = useState<string>('')
  // When stores load, pick the first one if none selected
  if (stores.length > 0 && !activeStoreId) {
    setActiveStoreId(stores[0].id)
  }

  // 3. Fetch catalog only when activeStoreId is set
  const {
    data: catalogData,
    isLoading: catalogLoading,
    error: catalogError,
  } = useSWR<{ catalog: StoreCatalog }>(
    activeStoreId ? `/api/stores/${activeStoreId}` : null,
    fetcher,
  )

  // 4. Populate the POS store – only if data actually changed
  useEffect(() => {
    if (!catalogData?.catalog) return

    const { products: newProducts, categories: newCategories } =
      catalogData.catalog

    // Helper to compare arrays by IDs (or names for categories)
    const areEqual = <T extends { id: string }>(a: T[], b: T[]) =>
      a.length === b.length && a.every((item, i) => item.id === b[i].id)

    // Only update if products or categories differ
    if (
      !areEqual(state.products, newProducts) ||
      !areEqual(state.categories, newCategories)
    ) {
      actions.setProducts(newProducts)
      actions.setCategories(newCategories)
    }
  }, [catalogData, actions, state.products, state.categories])

  // State for view modes and filters
  const [viewMode, setViewMode] = useState<ViewMode>('categories')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'packs'>('all')

  // Sensors for drag‑and‑drop (stable across renders)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Memoised categories from products
  const categories = useMemo(() => {
    const catMap = new Map<string, number>()
    state.products.forEach((p) => {
      if (p.category) {
        catMap.set(p.category, (catMap.get(p.category) || 0) + 1)
      }
    })
    state.categories.forEach((c) => {
      if (!catMap.has(c.name)) {
        catMap.set(c.name, 0)
      }
    })
    return Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state.products, state.categories])

  // Memoised filtered products
  const filteredProducts = useMemo(() => {
    let list = state.products
    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory)
    }
    if (filter === 'packs') {
      list = list.filter((p) => (p.packaging?.units_per_pack ?? 1) > 1)
    }
    return list
  }, [state.products, selectedCategory, filter])

  // Stable navigation callbacks
  const goToCategory = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName)
    setViewMode('category')
    setFilter('all')
  }, [])

  const goToCategories = useCallback(() => {
    setSelectedCategory(null)
    setViewMode('categories')
    setFilter('all')
  }, [])

  const goToAllProducts = useCallback(() => {
    setSelectedCategory(null)
    setViewMode('products')
    setFilter('all')
  }, [])

  // Stable drag handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = filteredProducts.findIndex((p) => p.id === active.id)
      const newIndex = filteredProducts.findIndex((p) => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const newFilteredOrder = arrayMove(
        filteredProducts.map((p) => p.id),
        oldIndex,
        newIndex,
      )
      actions.reorderProducts(newFilteredOrder)
    },
    [filteredProducts, actions],
  )

  // Helpers
  const getTitle = useCallback(() => {
    if (viewMode === 'categories') return 'Product Categories'
    if (viewMode === 'category') return selectedCategory || 'Category'
    return 'All Products'
  }, [viewMode, selectedCategory])

  const showBack = viewMode === 'category' || viewMode === 'products'

  // Loading / error states
  if (storesLoading || catalogLoading) {
    return (
      <div className="flex h-60 flex-col items-center justify-center text-muted-foreground">
        <Package className="size-10 animate-pulse" />
        <p className="mt-2 text-sm">Loading catalog…</p>
      </div>
    )
  }

  if (storesError || catalogError) {
    return (
      <div className="flex h-60 flex-col items-center justify-center text-destructive">
        <p>Error loading data. Please try again.</p>
        {storesError && <p className="text-xs">{storesError.message}</p>}
        {catalogError && <p className="text-xs">{catalogError.message}</p>}
      </div>
    )
  }

  if (stores.length === 0) {
    return (
      <div className="flex h-60 flex-col items-center justify-center text-muted-foreground">
        <Package className="size-10" />
        <p className="mt-2 text-sm">No stores available</p>
      </div>
    )
  }

  if (state.products.length === 0) {
    return (
      <div className="flex h-60 flex-col items-center justify-center text-muted-foreground">
        <Package className="size-10" />
        <p className="mt-2 text-sm">No products loaded</p>
        <p className="text-xs">Add products via catalog or seed data</p>
      </div>
    )
  }

  // --- Render categories grid ---
  if (viewMode === 'categories') {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border bg-muted/20 px-4 py-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{getTitle()}</h2>
            <Button variant="ghost" size="sm" onClick={goToAllProducts}>
              <List className="mr-1 size-4" /> View All Products
            </Button>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {categories.length} categories
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.name}
                name={cat.name}
                count={cat.count}
                onClick={() => goToCategory(cat.name)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --- Render products grid ---
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-muted/20 px-4 py-2">
        <div className="flex items-center gap-2">
          {showBack && (
            <Button variant="ghost" size="sm" onClick={goToCategories}>
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <h2 className="text-sm font-semibold">{getTitle()}</h2>
          {viewMode === 'category' && (
            <Badge variant="secondary" className="ml-1">
              {filteredProducts.length} items
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {viewMode === 'products' && (
              <Button variant="ghost" size="sm" onClick={goToCategories}>
                <Grid2x2 className="mr-1 size-4" /> Categories
              </Button>
            )}
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as 'all' | 'packs')}
              className="w-auto"
            >
              <TabsList className="h-auto gap-0 bg-transparent p-0">
                <TabsTrigger value="all" className="px-3 py-1 text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="packs" className="px-3 py-1 text-xs">
                  <Package className="mr-1 size-3" /> Packs
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {filteredProducts.length} product
          {filteredProducts.length !== 1 ? 's' : ''}
          {selectedCategory && ` in ${selectedCategory}`}
        </div>
      </div>

      {/* Sortable grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredProducts.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product, idx) => (
                <SortableProductCard
                  key={product.id}
                  product={product}
                  index={idx}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
