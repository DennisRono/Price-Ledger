"use client"

import { useEffect, useState } from "react"
import { PackagePlus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Modal } from "../modal"
import { usePOS } from "@/lib/pos/store"
import { money, dollarsToCents } from "@/lib/pos/format"
import { useToast } from "@/components/notify"

export function AddProductDialog({
  open,
  initialBarcode,
  onClose,
}: {
  open: boolean
  initialBarcode: string
  onClose: () => void
}) {
  const { state, actions } = usePOS()
  const { notify } = useToast()
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)

  // new product form
  const [name, setName] = useState("")
  const [barcode, setBarcode] = useState("")
  const [price, setPrice] = useState("")
  const [taxable, setTaxable] = useState(true)
  const [ebt, setEbt] = useState(false)
  const [age, setAge] = useState("0")
  const [stock, setStock] = useState("0")
  const [addToSale, setAddToSale] = useState(true)

  useEffect(() => {
    if (open) {
      setQuery(initialBarcode)
      setBarcode(initialBarcode)
      setCreating(!!initialBarcode)
      setName("")
      setPrice("")
    }
  }, [open, initialBarcode])

  const matches = state.products.filter((p) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p?.barcode?.includes(q)
  })

  const create = () => {
    const cents = dollarsToCents(price)
    if (!name.trim() || cents <= 0) {
      notify("Enter a name and price", "warn")
      return
    }
    const product = actions.createProduct({
      name: name.trim(),
      barcode: barcode.trim() || null,
      image_url: null,
      pricing: { currency: "USD", unit_price_cents: cents },
    })
    if (addToSale) actions.addProduct(product.id)
    notify(`Created ${product.name}`, "success")
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={creating ? "New Product" : "Find Product"}
      description={
        creating
          ? "Create a product and optionally add it to the current sale."
          : "Search the catalog and tap to add to the sale."
      }
      size="md"
      footer={
        <Button variant={creating ? "ghost" : "secondary"} onClick={() => setCreating((v) => !v)}>
          <PackagePlus /> {creating ? "Back to Search" : "New Product"}
        </Button>
      }
    >
      {creating ? (
        <div className="space-y-3">
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Barcode</FieldLabel>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type"
              />
            </Field>
            <Field>
              <FieldLabel>Price ($)</FieldLabel>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1.99"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Age Restriction</FieldLabel>
              <Select
                value={age}
                onValueChange={(val) => val && setAge(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="18">18+</SelectItem>
                  <SelectItem value="21">21+</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Initial Stock</FieldLabel>
              <Input
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </Field>
            <div className="flex items-end gap-3 pb-2">
              <Field orientation="horizontal" className="items-center gap-1.5">
                <Checkbox
                  id="taxable"
                  checked={taxable}
                  onCheckedChange={(checked) => setTaxable(!!checked)}
                />
                <FieldLabel htmlFor="taxable" className="font-normal text-sm">
                  Taxable
                </FieldLabel>
              </Field>
              <Field orientation="horizontal" className="items-center gap-1.5">
                <Checkbox
                  id="ebt"
                  checked={ebt}
                  onCheckedChange={(checked) => setEbt(!!checked)}
                />
                <FieldLabel htmlFor="ebt" className="font-normal text-sm">
                  EBT
                </FieldLabel>
              </Field>
            </div>
          </div>
          <Field orientation="horizontal" className="items-center gap-2">
            <Checkbox
              id="addToSale"
              checked={addToSale}
              onCheckedChange={(checked) => setAddToSale(!!checked)}
            />
            <FieldLabel htmlFor="addToSale" className="font-normal text-sm">
              Add to current sale after creating
            </FieldLabel>
          </Field>
          <Button className="w-full" onClick={create}>
            Create Product
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or barcode"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {matches.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  actions.addProduct(p.id)
                  notify(`Added ${p.name}`, "success")
                  onClose()
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
              >
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                 
                </div>
                <div className="flex items-center gap-2">
             
                  <span className="font-semibold tabular-nums">{money(p?.pricing?.unit_price_cents||0)}</span>
                </div>
              </button>
            ))}
            {matches.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No products found. Create a new one.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}