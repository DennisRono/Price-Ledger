'use client'

import { useEffect, useRef, useState } from 'react'
import type { Category, Product, TaxCategory } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ImageCropper } from './image-cropper'
import { BarcodeScanner } from './barcode-scanner'
import { uploadImageReq } from '@/lib/api-client'
import { formatPrice } from '@/lib/format'
import { toast } from 'sonner'
import {
  Camera,
  ImagePlus,
  Trash2,
  ScanBarcode,
  Plus,
  X,
  GripVertical,
} from 'lucide-react'

type Mode = 'create' | 'edit'

type ProductEditorProps = {
  open: boolean
  mode: Mode
  storeId: string
  product: Product | null
  categories: Category[]
  taxCategories: TaxCategory[]
  onClose: () => void
  onSave: (product: Product) => Promise<void>
  onDelete?: (product: Product) => Promise<void>
}

// Helper to build a default product for create mode
function defaultProduct(): Product {
  return {
    id: '',
    sku: '',
    barcode: null,
    barcode_status: 'pending',
    group_key: '',
    name: '',
    receipt_name: '',
    description: '',
    brand: '',
    manufacturer: '',
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
      last_updated: new Date().toISOString().slice(0, 10),
    },
    promotions: [],
    tax: { taxable: true, tax_category: '' },
    compliance: {
      age_restricted: false,
      minimum_age: null,
      requires_id_verification: false,
    },
    inventory: {
      track_inventory: true,
      quantity_on_hand: null,
      reorder_point: null,
      unit_of_measure: 'each',
    },
    flags: {
      sold_by_volume: false,
      weighted: false,
      returnable: true,
      refundable: true,
      eligible_for_coupons: true,
      eligible_for_loyalty_points: true,
      seasonal: false,
      discontinued: false,
    },
    status: 'active',
    metadata: {
      source: 'manual_entry',
      date_added: new Date().toISOString().slice(0, 10),
      last_modified: new Date().toISOString().slice(0, 10),
      needs_review: false,
      review_note: null,
    },
  }
}

export function ProductEditor({
  open,
  mode,
  storeId,
  product,
  categories,
  taxCategories,
  onClose,
  onSave,
  onDelete,
}: ProductEditorProps) {
  // Build initial draft
  const initialDraft = mode === 'create' ? defaultProduct() : product
  const [draft, setDraft] = useState<Product>(initialDraft!)
  const [priceText, setPriceText] = useState('')
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (mode === 'create') {
      const def = defaultProduct()
      setDraft(def)
      setPriceText('')
    } else if (product) {
      setDraft(product)
      const cents = product.pricing?.unit_price_cents
      setPriceText(cents != null ? (cents / 100).toFixed(2) : '')
    }
  }, [product, mode])

  function update(patch: Partial<Product>) {
    setDraft((d) => {
      const next = { ...d, ...patch }
      // Auto-fill receipt_name if not explicitly set
      if (patch.name !== undefined && !next.receipt_name) {
        next.receipt_name = next.name
      }
      return next
    })
  }

  function updateNested<K extends keyof Product>(
    key: K,
    value: Product[K] extends object ? any : any,
  ) {
    setDraft((d) => ({
      ...d,
      [key]:
        typeof d[key] === 'object' && d[key] !== null
          ? { ...d[key], ...value }
          : value,
    }))
  }

  // Promotions helpers
  function addPromotion() {
    const newPromo = {
      type: 'MULTI_BUY',
      buy_qty: 2,
      bundle_price_cents: 0,
      label: '',
      active: true,
    }
    setDraft((d) => ({
      ...d,
      promotions: [...(d.promotions || []), newPromo],
    }))
  }

  function removePromotion(index: number) {
    setDraft((d) => ({
      ...d,
      promotions: d.promotions?.filter((_, i) => i !== index) || [],
    }))
  }

  function updatePromotion(index: number, patch: any) {
    setDraft((d) => ({
      ...d,
      promotions:
        d.promotions?.map((p: any, i) =>
          i === index ? { ...p, ...patch } : p,
        ) || [],
    }))
  }

  // Image handling
  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleCropped(blob: Blob, previewUrl: string) {
    setCropSrc(null)
    setUploadingImage(true)
    update({ image_url: previewUrl })
    try {
      const url = await uploadImageReq(blob, storeId, draft!.id)
      update({ image_url: url })
      toast.success(`Image uploaded (${Math.round(blob.size / 1024)} KB)`)
    } catch {
      toast.error('Image upload failed')
      update({ image_url: product?.image_url ?? null })
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSave() {
    const current = draft
    if (!current) return
    if (!current.name.trim()) {
      toast.error('Product name is required')
      return
    }

    // Parse price
    const parsed =
      priceText.trim() === '' ? null : Math.round(Number(priceText) * 100)
    if (priceText.trim() !== '' && (parsed === null || Number.isNaN(parsed))) {
      toast.error('Enter a valid price')
      return
    }

    // Finalize product object
    const finalProduct: Product = {
      ...current,
      pricing: {
        ...current.pricing,
        unit_price_cents: parsed,
        price_status: parsed != null ? 'set' : 'pending',
        last_updated: new Date().toISOString().slice(0, 10),
      },
      metadata: {
        ...current.metadata,
        last_modified: new Date().toISOString().slice(0, 10),
      },
    }

    setSaving(true)
    try {
      await onSave(finalProduct)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const topLevel = categories.filter((c) => c.parentId === null)
  const subs = categories.filter((c) => c.parentId === draft.category)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[96vh] max-w-7xl md:min-w-max gap-0 overflow-y-auto overflow-x-hidden rounded-none border-2 border-ink bg-paper p-0 sm:rounded-lg mt-14 sm:mt-0">
        <DialogHeader className="relative border-b-2 border-ink border-t-2 bg-ink px-4 py-3 text-left">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-paper transition-opacity hover:opacity-70 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>

          <DialogTitle className="font-heading text-paper">
            {mode === 'create' ? 'Add New Product' : 'Edit Product'}
          </DialogTitle>

          <DialogDescription className="ed-kicker text-[10px] text-gold">
            {draft.id || 'New product'}
          </DialogDescription>
        </DialogHeader>

        {cropSrc ? (
          <div className="p-4">
            <ImageCropper
              src={cropSrc}
              onCropped={handleCropped}
              onCancel={() => setCropSrc(null)}
            />
          </div>
        ) : scanning ? (
          <div className="p-4">
            <BarcodeScanner
              onDetected={(code) => {
                update({ barcode: code, barcode_status: 'set' })
                setScanning(false)
                toast.success(`Barcode linked: ${code}`)
              }}
              onClose={() => setScanning(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6 p-4 md:p-6 overflow-x-hidden">
            {/* ─── Image & Basic Info ─── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col items-center gap-2 md:col-span-1">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden border-2 border-ink bg-parchment">
                  {draft.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.image_url}
                      alt={draft.name || 'Product image'}
                      className="h-full w-full object-contain mix-blend-multiply"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex w-full flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePickFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-none border-ink"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    <ImagePlus className="mr-1.5 h-4 w-4" />
                    {uploadingImage ? 'Uploading…' : 'Photo'}
                  </Button>
                  {draft.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-none px-2 text-red hover:text-red"
                      onClick={() => update({ image_url: null })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Product name" required>
                    <Input
                      value={draft.name}
                      onChange={(e) => update({ name: e.target.value })}
                      className="rounded-none border-ink bg-card"
                      placeholder="e.g. Coca-Cola 20oz"
                    />
                  </Field>
                  <Field label="Receipt name (auto‑filled)">
                    <Input
                      value={draft.receipt_name || draft.name}
                      onChange={(e) => update({ receipt_name: e.target.value })}
                      className="rounded-none border-ink bg-card"
                      placeholder="Defaults to product name"
                    />
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Brand">
                    <Input
                      value={draft.brand ?? ''}
                      onChange={(e) => update({ brand: e.target.value })}
                      className="rounded-none border-ink bg-card"
                    />
                  </Field>
                  <Field label="Manufacturer">
                    <Input
                      value={draft.manufacturer ?? ''}
                      onChange={(e) => update({ manufacturer: e.target.value })}
                      className="rounded-none border-ink bg-card"
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* ─── Category & Subcategory ─── */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Category">
                <Select
                  value={draft.category || ''}
                  onValueChange={(v) => update({ category: v ?? '' })}
                >
                  <SelectTrigger className="rounded-none border-ink bg-card">
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    {topLevel.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subcategory">
                <Select
                  value={draft.subcategory || ''}
                  onValueChange={(v) => update({ subcategory: v ?? '' })}
                  disabled={subs.length === 0}
                >
                  <SelectTrigger className="rounded-none border-ink bg-card">
                    <SelectValue
                      placeholder={subs.length ? 'Choose subcategory' : '—'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* ─── Size & Packaging ─── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Size (value)">
                <Input
                  value={draft.size?.value ?? ''}
                  onChange={(e) =>
                    update({
                      size: {
                        value:
                          e.target.value === '' ? null : Number(e.target.value),
                        unit: draft.size?.unit ?? null,
                      },
                    })
                  }
                  inputMode="decimal"
                  className="rounded-none border-ink bg-card"
                />
              </Field>
              <Field label="Unit">
                <Input
                  value={draft.size?.unit ?? ''}
                  onChange={(e) =>
                    update({
                      size: {
                        value: draft.size?.value ?? null,
                        unit: e.target.value || null,
                      },
                    })
                  }
                  placeholder="fl_oz, ml, g, etc."
                  className="rounded-none border-ink bg-card"
                />
              </Field>
              <Field label="Container">
                <Input
                  value={draft.container ?? ''}
                  onChange={(e) => update({ container: e.target.value })}
                  placeholder="bottle, can, box"
                  className="rounded-none border-ink bg-card"
                />
              </Field>
              <Field label="Pack quantity">
                <Input
                  value={draft.packaging?.units_per_pack ?? 1}
                  onChange={(e) =>
                    update({
                      packaging: {
                        type:
                          Number(e.target.value) > 1 ? 'multipack' : 'single',
                        units_per_pack: Math.max(
                          1,
                          Number(e.target.value) || 1,
                        ),
                      },
                    })
                  }
                  inputMode="numeric"
                  className="rounded-none border-ink bg-card"
                />
              </Field>
            </div>

            {/* ─── Pricing ─── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Price">
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-none border-2 border-r-0 border-ink bg-parchment px-3 text-sm">
                    $
                  </span>
                  <Input
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="rounded-none border-ink bg-card font-mono"
                  />
                </div>
              </Field>
              <Field label="Currency">
                <Select
                  value={draft.pricing?.currency || 'USD'}
                  onValueChange={(v) =>
                    updateNested('pricing', { currency: v })
                  }
                >
                  <SelectTrigger className="rounded-none border-ink bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={draft.status || 'active'}
                  onValueChange={(v) => update({ status: v as any })}
                >
                  <SelectTrigger className="rounded-none border-ink bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* ─── Barcode ─── */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <Field label="Barcode">
                  <Input
                    value={draft.barcode ?? ''}
                    onChange={(e) =>
                      update({
                        barcode: e.target.value || null,
                        barcode_status: e.target.value ? 'set' : 'pending',
                      })
                    }
                    placeholder="Scan or type"
                    className="rounded-none border-ink bg-card font-mono"
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-none border-ink"
                onClick={() => setScanning(true)}
              >
                <ScanBarcode className="mr-1.5 h-4 w-4" />
                Scan
              </Button>
            </div>

            {/* ─── Tax ─── */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Tax category">
                <Select
                  value={draft.tax?.tax_category || ''}
                  onValueChange={(v) =>
                    updateNested('tax', { tax_category: v })
                  }
                >
                  <SelectTrigger className="rounded-none border-ink bg-card">
                    <SelectValue placeholder="Select tax category" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxCategories.map((tc) => (
                      <SelectItem key={tc.id} value={tc.id}>
                        {tc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="taxable"
                    checked={draft.tax?.taxable !== false}
                    onCheckedChange={(c) =>
                      updateNested('tax', { taxable: !!c })
                    }
                  />
                  <Label htmlFor="taxable" className="text-sm font-normal">
                    Taxable
                  </Label>
                </div>
              </div>
            </div>

            {/* ─── Promotions ─── */}
            <div className="border-t-2 border-ink pt-2">
              <div className="mb-2 flex items-center justify-between">
                <Label className="font-heading text-base">Promotions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none border-ink"
                  onClick={addPromotion}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add
                </Button>
              </div>
              {draft.promotions && draft.promotions.length > 0 ? (
                <div className="space-y-3">
                  {draft.promotions.map((promo: any, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-end gap-2 rounded-none border-2 border-ink bg-parchment p-3"
                    >
                      <div className="flex-1 min-w-25">
                        <Label className="text-[10px]">Type</Label>
                        <Select
                          value={promo.type}
                          onValueChange={(v) =>
                            updatePromotion(idx, { type: v })
                          }
                        >
                          <SelectTrigger className="rounded-none border-ink bg-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MULTI_BUY">Multi‑buy</SelectItem>
                            <SelectItem value="BOGO">BOGO</SelectItem>
                            <SelectItem value="DISCOUNT">Discount</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-20">
                        <Label className="text-[10px]">Buy qty</Label>
                        <Input
                          type="number"
                          value={promo.buy_qty}
                          onChange={(e) =>
                            updatePromotion(idx, {
                              buy_qty: Number(e.target.value) || 1,
                            })
                          }
                          className="rounded-none border-ink bg-card"
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-[10px]">Bundle price</Label>
                        <div className="flex">
                          <span className="inline-flex items-center rounded-l-none border-2 border-r-0 border-ink bg-parchment px-2 text-sm">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={promo.bundle_price_cents / 100}
                            onChange={(e) =>
                              updatePromotion(idx, {
                                bundle_price_cents: Math.round(
                                  Number(e.target.value) * 100,
                                ),
                              })
                            }
                            className="rounded-none border-ink bg-card font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-30">
                        <Label className="text-[10px]">Label</Label>
                        <Input
                          value={promo.label}
                          onChange={(e) =>
                            updatePromotion(idx, { label: e.target.value })
                          }
                          placeholder="e.g. 2 for $5"
                          className="rounded-none border-ink bg-card"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={promo.active !== false}
                          onCheckedChange={(c) =>
                            updatePromotion(idx, { active: !!c })
                          }
                        />
                        <Label className="text-[10px]">Active</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-none p-0 text-red hover:text-red"
                        onClick={() => removePromotion(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No promotions added.
                </div>
              )}
            </div>

            {/* ─── Compliance ─── */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="age_restricted"
                  checked={draft.compliance?.age_restricted || false}
                  onCheckedChange={(c) =>
                    updateNested('compliance', { age_restricted: !!c })
                  }
                />
                <Label htmlFor="age_restricted" className="text-sm font-normal">
                  Age restricted
                </Label>
              </div>
              <Field label="Minimum age">
                <Input
                  type="number"
                  value={draft.compliance?.minimum_age ?? ''}
                  onChange={(e) =>
                    updateNested('compliance', {
                      minimum_age: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="rounded-none border-ink bg-card"
                  disabled={!draft.compliance?.age_restricted}
                />
              </Field>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="id_required"
                  checked={draft.compliance?.requires_id_verification || false}
                  onCheckedChange={(c) =>
                    updateNested('compliance', {
                      requires_id_verification: !!c,
                    })
                  }
                  disabled={!draft.compliance?.age_restricted}
                />
                <Label htmlFor="id_required" className="text-sm font-normal">
                  Require ID verification
                </Label>
              </div>
            </div>

            {/* ─── Inventory ─── */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="track_inventory"
                  checked={draft.inventory?.track_inventory !== false}
                  onCheckedChange={(c) =>
                    updateNested('inventory', { track_inventory: !!c })
                  }
                />
                <Label
                  htmlFor="track_inventory"
                  className="text-sm font-normal"
                >
                  Track inventory
                </Label>
              </div>
              <Field label="Quantity on hand">
                <Input
                  type="number"
                  value={draft.inventory?.quantity_on_hand ?? ''}
                  onChange={(e) =>
                    updateNested('inventory', {
                      quantity_on_hand: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="rounded-none border-ink bg-card"
                  disabled={!draft.inventory?.track_inventory}
                />
              </Field>
              <Field label="Reorder point">
                <Input
                  type="number"
                  value={draft.inventory?.reorder_point ?? ''}
                  onChange={(e) =>
                    updateNested('inventory', {
                      reorder_point: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="rounded-none border-ink bg-card"
                  disabled={!draft.inventory?.track_inventory}
                />
              </Field>
              <Field label="Unit of measure">
                <Input
                  value={draft.inventory?.unit_of_measure || 'each'}
                  onChange={(e) =>
                    updateNested('inventory', {
                      unit_of_measure: e.target.value,
                    })
                  }
                  className="rounded-none border-ink bg-card"
                />
              </Field>
            </div>

            {/* ─── Flags ─── */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                { key: 'sold_by_volume', label: 'Sold by volume' },
                { key: 'weighted', label: 'Weighted' },
                { key: 'returnable', label: 'Returnable' },
                { key: 'refundable', label: 'Refundable' },
                { key: 'eligible_for_coupons', label: 'Coupons' },
                { key: 'eligible_for_loyalty_points', label: 'Loyalty points' },
                { key: 'seasonal', label: 'Seasonal' },
                { key: 'discontinued', label: 'Discontinued' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`flag_${key}`}
                    checked={(draft.flags as any)?.[key] || false}
                    onCheckedChange={(c) =>
                      updateNested('flags', { [key]: !!c })
                    }
                  />
                  <Label
                    htmlFor={`flag_${key}`}
                    className="text-sm font-normal"
                  >
                    {label}
                  </Label>
                </div>
              ))}
            </div>

            {/* ─── Description ─── */}
            <Field label="Description">
              <Textarea
                value={draft.description ?? ''}
                onChange={(e) => update({ description: e.target.value })}
                rows={3}
                className="rounded-none border-ink bg-card"
                placeholder="Product description (optional)"
              />
            </Field>

            {/* ─── Tags ─── */}
            <Field label="Tags (comma-separated)">
              <Input
                value={draft.tags?.join(', ') || ''}
                onChange={(e) =>
                  update({
                    tags: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g. coca_cola, soda, bottled"
                className="rounded-none border-ink bg-card"
              />
            </Field>

            {/* ─── Hidden: SKU, group_key, etc. ─── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="SKU">
                <Input
                  value={draft.sku || ''}
                  onChange={(e) => update({ sku: e.target.value })}
                  className="rounded-none border-ink bg-card font-mono"
                />
              </Field>
              <Field label="Group key">
                <Input
                  value={draft.group_key || ''}
                  onChange={(e) => update({ group_key: e.target.value })}
                  className="rounded-none border-ink bg-card"
                />
              </Field>
              <Field label="Container (original)">
                <Input
                  value={draft.container || ''}
                  onChange={(e) => update({ container: e.target.value })}
                  className="rounded-none border-ink bg-card"
                />
              </Field>
            </div>

            {/* ─── Save / Delete ─── */}
            <div className="ed-double-rule flex flex-col gap-2 pt-2 md:flex-row-reverse mb-10 sm:mb-2">
              <Button
                type="button"
                className="flex-1 rounded-none bg-red text-paper hover:bg-red/90 p-3"
                onClick={handleSave}
                disabled={saving || uploadingImage}
              >
                {saving
                  ? 'Saving…'
                  : mode === 'create'
                    ? 'Add to catalog'
                    : `Save changes (${formatPrice(
                        priceText.trim() === ''
                          ? null
                          : Math.round(Number(priceText) * 100),
                        draft.pricing?.currency,
                      )})`}
              </Button>
              {mode === 'edit' && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 rounded-none text-red hover:bg-red-light hover:text-red"
                  onClick={async () => {
                    if (
                      confirm(`Delete "${draft.name}"? This cannot be undone.`)
                    ) {
                      await onDelete(draft)
                      onClose()
                    }
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="ed-kicker text-[10px] text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-red">*</span>}
      </Label>
      {children}
    </div>
  )
}
