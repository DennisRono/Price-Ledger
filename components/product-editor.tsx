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
import { ImageCropper } from './image-cropper'
import { BarcodeScanner } from './barcode-scanner'
import { uploadImageReq } from '@/lib/api-client'
import { formatPrice } from '@/lib/format'
import { toast } from 'sonner'
import { Camera, ImagePlus, Trash2, ScanBarcode } from 'lucide-react'

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

export function ProductEditor({
  open,
  mode,
  storeId,
  product,
  categories,
  onClose,
  onSave,
  onDelete,
}: ProductEditorProps) {
  const [draft, setDraft] = useState<Product | null>(product)
  const [priceText, setPriceText] = useState('')
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraft(product)
    const cents = product?.pricing?.unit_price_cents
    setPriceText(cents != null ? (cents / 100).toFixed(2) : '')
  }, [product])

  if (!draft) return null

  function update(patch: Partial<Product>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleCropped(blob: Blob, previewUrl: string) {
    setCropSrc(null)
    setUploadingImage(true)
    // optimistic local preview
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
    const parsed = priceText.trim() === '' ? null : Math.round(Number(priceText) * 100)
    if (priceText.trim() !== '' && (parsed === null || Number.isNaN(parsed))) {
      toast.error('Enter a valid price')
      return
    }
    setSaving(true)
    try {
      const next: Product = {
        ...current,
        pricing: {
          ...current.pricing,
          unit_price_cents: parsed,
          price_status: parsed != null ? 'set' : 'pending',
          last_updated: new Date().toISOString().slice(0, 10),
        },
      }
      await onSave(next)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const topLevel = categories.filter((c) => c.parentId === null)
  const subs = categories.filter((c) => c.parentId === draft.category)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-none border-2 border-ink bg-paper p-0 sm:max-w-lg">
        <DialogHeader className="border-b-2 border-ink bg-ink px-4 py-3 text-left">
          <DialogTitle className="font-heading text-paper">
            {mode === 'create' ? 'Add New Product' : 'Edit Product'}
          </DialogTitle>
          <DialogDescription className="ed-kicker text-[10px] text-gold">
            {draft.id}
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
          <div className="flex flex-col gap-4 p-4">
            {/* Image */}
            <div className="flex gap-3">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-2 border-ink bg-parchment">
                {draft.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.image_url || '/placeholder.svg'}
                    alt={draft.name}
                    className="h-full w-full object-contain mix-blend-multiply"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <ImagePlus className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center gap-2">
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
                  className="rounded-none border-ink"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingImage}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" />
                  {uploadingImage
                    ? 'Uploading…'
                    : draft.image_url
                      ? 'Replace photo'
                      : 'Add photo'}
                </Button>
                {draft.image_url ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto justify-start rounded-none px-0 text-xs text-red hover:text-red"
                    onClick={() => update({ image_url: null })}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                ) : null}
              </div>
            </div>

            <Field label="Product name">
              <Input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                className="rounded-none border-ink bg-card"
                placeholder="e.g. Coca-Cola 20oz Bottle"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand">
                <Input
                  value={draft.brand ?? ''}
                  onChange={(e) => update({ brand: e.target.value })}
                  className="rounded-none border-ink bg-card"
                />
              </Field>
              <Field label={`Price (${draft.pricing?.currency ?? 'USD'})`}>
                <Input
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="rounded-none border-ink bg-card font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select
                  value={draft.category || ''}
                  onValueChange={(v) => update({ category: v ?? '' })}
                >
                  <SelectTrigger className="rounded-none border-ink bg-card">
                    <SelectValue placeholder="Choose" />
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
                    <SelectValue placeholder={subs.length ? 'Choose' : '—'} />
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

            <div className="grid grid-cols-3 gap-3">
              <Field label="Size">
                <Input
                  value={draft.size?.value ?? ''}
                  onChange={(e) =>
                    update({
                      size: {
                        value: e.target.value === '' ? null : Number(e.target.value),
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
                  placeholder="fl_oz"
                  className="rounded-none border-ink bg-card"
                />
              </Field>
              <Field label="Pack qty">
                <Input
                  value={draft.packaging?.units_per_pack ?? 1}
                  onChange={(e) =>
                    update({
                      packaging: {
                        type:
                          Number(e.target.value) > 1 ? 'multipack' : 'single',
                        units_per_pack: Math.max(1, Number(e.target.value) || 1),
                      },
                    })
                  }
                  inputMode="numeric"
                  className="rounded-none border-ink bg-card"
                />
              </Field>
            </div>

            {/* Barcode */}
            <Field label="Barcode">
              <div className="flex gap-2">
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
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-none border-ink"
                  onClick={() => setScanning(true)}
                >
                  <ScanBarcode className="h-4 w-4" />
                </Button>
              </div>
            </Field>

            <Field label="Description">
              <Textarea
                value={draft.description ?? ''}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
                className="rounded-none border-ink bg-card"
              />
            </Field>

            <div className="ed-double-rule flex flex-col gap-2 pt-3">
              <Button
                type="button"
                className="rounded-none bg-red text-paper hover:bg-red/90"
                onClick={handleSave}
                disabled={saving || uploadingImage}
              >
                {saving
                  ? 'Saving…'
                  : mode === 'create'
                    ? 'Add to catalog'
                    : `Save changes (${formatPrice(
                        priceText.trim() === '' ? null : Math.round(Number(priceText) * 100),
                        draft.pricing?.currency,
                      )})`}
              </Button>
              {mode === 'edit' && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-none text-red hover:bg-red-light hover:text-red"
                  onClick={async () => {
                    if (confirm(`Delete "${draft.name}"? This cannot be undone.`)) {
                      await onDelete(draft)
                      onClose()
                    }
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete product
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="ed-kicker text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
