'use client'

import { useMemo, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import type { Product, StoreCatalog, StoreMeta } from '@/lib/types'
import {
  fetcher,
  addProductReq,
  updateProductReq,
  deleteProductReq,
} from '@/lib/api-client'
import { scoreProduct, productHaystack } from '@/lib/format'
import { Masthead } from './masthead'
import { SearchBar } from './search-bar'
import { FilterBar, defaultFilters, type Filters } from './filter-bar'
import { ProductGrid } from './product-grid'
import { ProductEditor } from './product-editor'
import { ProductDetail } from './product-detail'
import { StoreManager } from './store-manager'
import { VoiceListener } from './voice-listener'
import { BarcodeScanner } from './barcode-scanner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Store, ScanBarcode, Mic } from 'lucide-react'
import { toast } from 'sonner'

type CatalogAppProps = {
  initialStores: StoreMeta[]
}

export function CatalogApp({ initialStores }: CatalogAppProps) {
  const { mutate } = useSWRConfig()
  const [stores, setStores] = useState<StoreMeta[]>(initialStores)
  const [activeStoreId, setActiveStoreId] = useState(initialStores[0]?.id ?? '')

  const { data, isLoading } = useSWR<{ catalog: StoreCatalog }>(
    activeStoreId ? `/api/stores/${activeStoreId}` : null,
    fetcher,
  )
  const catalog = data?.catalog

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(defaultFilters)

  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [editorState, setEditorState] = useState<{
    mode: 'create' | 'edit'
    product: Product | null
  } | null>(null)
  const [storeManagerOpen, setStoreManagerOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const products = catalog?.products ?? []
  const categories = catalog?.categories ?? []
  const taxCategories = catalog?.tax_categories ?? []

  // category descendants helper (so picking a parent shows children too)
  const categoryMatches = useMemo(() => {
    if (filters.category === 'all') return null
    const ids = new Set<string>([filters.category])
    for (const c of categories) {
      if (c.parentId === filters.category) ids.add(c.id)
    }
    return ids
  }, [filters.category, categories])

  const filtered = useMemo(() => {
    let list = products

    if (categoryMatches) {
      list = list.filter(
        (p) =>
          (p.category && categoryMatches.has(p.category)) ||
          (p.subcategory && categoryMatches.has(p.subcategory)),
      )
    }
    if (filters.packaging === 'single') {
      list = list.filter((p) => (p.packaging?.units_per_pack ?? 1) <= 1)
    } else if (filters.packaging === 'pack') {
      list = list.filter((p) => (p.packaging?.units_per_pack ?? 1) > 1)
    }
    if (filters.onlyMissingImage) {
      list = list.filter((p) => !p.image_url)
    }
    if (filters.onlyMissingPrice) {
      list = list.filter((p) => p.pricing?.unit_price_cents == null)
    }

    if (query.trim()) {
      list = list
        .map((p) => ({ p, s: scoreProduct(p, query, productHaystack(p)) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((r) => r.p)
    } else {
      list = [...list].sort((a, b) => {
        switch (filters.sort) {
          case 'price-asc':
            return (
              (a.pricing?.unit_price_cents ?? Infinity) -
              (b.pricing?.unit_price_cents ?? Infinity)
            )
          case 'price-desc':
            return (
              (b.pricing?.unit_price_cents ?? -Infinity) -
              (a.pricing?.unit_price_cents ?? -Infinity)
            )
          case 'recent':
            return (
              (b.metadata?.last_modified ?? '').localeCompare(
                a.metadata?.last_modified ?? '',
              )
            )
          default:
            return a.name.localeCompare(b.name)
        }
      })
    }
    return list
  }, [products, categoryMatches, filters, query])

  function refresh() {
    mutate(`/api/stores/${activeStoreId}`)
  }

  async function handleSave(product: Product) {
    if (!editorState) return
    try {
      if (editorState.mode === 'create') {
        await addProductReq(activeStoreId, product)
        toast.success('Product added to catalog')
        setStores((prev) =>
          prev.map((s) =>
            s.id === activeStoreId ? { ...s, productCount: s.productCount + 1 } : s,
          ),
        )
      } else {
        await updateProductReq(activeStoreId, product.id, product)
        toast.success('Changes saved')
      }
      refresh()
    } catch {
      toast.error('Save failed')
    }
  }

  async function handleDelete(product: Product) {
    try {
      await deleteProductReq(activeStoreId, product.id)
      toast.success('Product deleted')
      setStores((prev) =>
        prev.map((s) =>
          s.id === activeStoreId
            ? { ...s, productCount: Math.max(0, s.productCount - 1) }
            : s,
        ),
      )
      refresh()
    } catch {
      toast.error('Delete failed')
    }
  }

  function openCreate(prefill?: Partial<Product>) {
    const today = new Date().toISOString().slice(0, 10)
    const base: Product = {
      id: '',
      sku: '',
      barcode: prefill?.barcode ?? null,
      barcode_status: prefill?.barcode ? 'set' : 'pending',
      name: prefill?.name ?? '',
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
      metadata: { source: 'manual_entry', date_added: today, last_modified: today },
    }
    setEditorState({ mode: 'create', product: base })
  }

  function handleScanResult(code: string) {
    setScanOpen(false)
    const existing = products.find((p) => p.barcode && p.barcode === code)
    if (existing) {
      setDetailProduct(existing)
      toast.success(`Found: ${existing.name}`)
    } else {
      toast.message('No product with that barcode', {
        description: 'Search to link it to an existing item, or add a new product.',
      })
      setQuery('')
      openCreate({ barcode: code })
    }
  }

  function handleEditFromDetail(p: Product) {
    setDetailProduct(null)
    setEditorState({ mode: 'edit', product: p })
  }

  return (
    <div className="min-h-screen">
      <Masthead
        storeName={catalog?.store ?? stores.find((s) => s.id === activeStoreId)?.name ?? '—'}
        productCount={products.length}
      />

      {/* Toolbar */}
      <div className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none border-ink"
            onClick={() => setStoreManagerOpen(true)}
          >
            <Store className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Stores</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none border-ink"
            onClick={() => setScanOpen(true)}
          >
            <ScanBarcode className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Scan</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`rounded-none border-ink ${voiceOpen ? 'bg-ink text-paper' : ''}`}
            onClick={() => setVoiceOpen((v) => !v)}
          >
            <Mic className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Listen</span>
          </Button>
          <div className="ml-auto">
            <Button
              type="button"
              size="sm"
              className="rounded-none bg-red text-paper hover:bg-red/90"
              onClick={() => openCreate()}
            >
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Add product</span>
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:py-6">
        <div className="flex flex-col gap-4">
          <SearchBar
            products={products}
            value={query}
            onValueChange={setQuery}
            onSelect={(p) => setDetailProduct(p)}
          />

          {voiceOpen ? (
            <VoiceListener products={products} onPick={(p) => setDetailProduct(p)} />
          ) : null}

          <FilterBar
            categories={categories}
            filters={filters}
            onChange={setFilters}
            resultCount={filtered.length}
          />

          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="ed-kicker text-xs">Loading catalog…</p>
            </div>
          ) : (
            <ProductGrid
              products={filtered}
              onEdit={(p) => setEditorState({ mode: 'edit', product: p })}
            />
          )}
        </div>
      </main>

      <footer className="ed-double-rule mt-8 px-4 py-6 text-center">
        <p className="ed-kicker text-[10px] text-muted-foreground">
          The Price Ledger — Data stored in Vercel Blob — {products.length} items on file
        </p>
      </footer>

      {/* Detail / quick price view */}
      <ProductDetail
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onEdit={handleEditFromDetail}
      />

      {/* Editor */}
      {editorState ? (
        <ProductEditor
          open={!!editorState}
          mode={editorState.mode}
          storeId={activeStoreId}
          product={editorState.product}
          categories={categories}
          taxCategories={taxCategories}
          onClose={() => setEditorState(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}

      {/* Store manager */}
      <StoreManager
        open={storeManagerOpen}
        stores={stores}
        activeStoreId={activeStoreId}
        onClose={() => setStoreManagerOpen(false)}
        onSelect={(id) => {
          setActiveStoreId(id)
          setQuery('')
          setFilters(defaultFilters)
        }}
        onCreated={(store) => {
          setStores((prev) => [...prev, store])
          setActiveStoreId(store.id)
        }}
      />

      {/* Standalone scanner */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="rounded-none border-2 border-ink bg-paper p-0 sm:max-w-md">
          <DialogHeader className="border-b-2 border-ink bg-ink px-4 py-3 text-left">
            <DialogTitle className="font-heading text-paper">Scan Barcode</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {scanOpen ? (
              <BarcodeScanner
                onDetected={handleScanResult}
                onClose={() => setScanOpen(false)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
