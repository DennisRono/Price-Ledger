"use client"

import { useState } from "react"
import {
  Plus,
  Minus,
  Trash2,
  Ban,
  ShoppingCart,
  Tag,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Modal } from "../modal"
import { usePOS } from "@/lib/pos/store"
import { money } from "@/lib/pos/format"
import { keypadToCents } from "@/lib/pos/format"
import { itemCount } from "@/lib/pos/calc"
import { NumPad } from "@/components/pos/numpad"
import type { SaleItem } from "@/lib/pos/types"
import { cn } from "@/lib/utils"

export function CartPanel({
  onPay,
  onSelectCustomer,
}: {
  onPay: () => void
  onSelectCustomer: () => void
}) {
  const { state, actions } = usePOS()
  const sale = state.sale
  const [editLine, setEditLine] = useState<SaleItem | null>(null)
  const [priceDigits, setPriceDigits] = useState("")
  const [discMode, setDiscMode] = useState<"percent" | "amount">("percent")
  const [discValue, setDiscValue] = useState("")

  const items = sale ? sale.items : []
  const customer = sale?.customerId
    ? state.customers.find((c) => c.id === sale.customerId)
    : undefined

  const openEdit = (item: SaleItem) => {
    setEditLine(item)
    setPriceDigits(String(item.unitPrice))
    setDiscMode(item.discount?.type ?? "percent")
    setDiscValue(
      item.discount
        ? item.discount.type === "percent"
          ? String(item.discount.value)
          : String(item.discount.value)
        : "",
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Current Sale {sale ? `#${sale.number}` : ""}
          </h2>
          {sale && <Badge variant="secondary">{itemCount(sale)} items</Badge>}
          {sale?.taxExempt && (
            <Badge variant="outline" className="border-amber-500 text-amber-500">
              Tax Exempt
            </Badge>
          )}
        </div>
        <button
          onClick={onSelectCustomer}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
        >
          <UserRound className="size-3.5" />
          {customer ? customer.name : "Add Customer"}
        </button>
      </div>

      {/* Items */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <ShoppingCart className="size-10 opacity-40" />
            <p className="text-sm">Scan, search, or tap a product to begin a sale.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.lineId}
                className={cn("px-3 py-2.5", item.voided && "opacity-50")}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-sm font-medium",
                          item.voided && "line-through",
                        )}
                      >
                        {item.name}
                      </span>
                      {item.ageRestriction > 0 &&
                        (item.ageVerified ? (
                          <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="size-3.5 shrink-0 text-amber-600" />
                        ))}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{money(item.unitPrice)} ea</span>
                      {item.discount && (
                        <Badge variant="outline" className="border-green-500 text-green-500 px-1.5 py-0">
                          <Tag className="size-2.5" />
                          {item.discount.type === "percent"
                            ? `${item.discount.value}%`
                            : money(item.discount.value)}
                        </Badge>
                      )}
                      {!item.taxable && <span>· no tax</span>}
                      {item.ebtEligible && <span>· EBT</span>}
                    </div>
                  </div>

                  {!item.voided && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => actions.decQty(item.lineId)}
                        aria-label="Decrease quantity"
                      >
                        <Minus />
                      </Button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => actions.incQty(item.lineId)}
                        aria-label="Increase quantity"
                      >
                        <Plus />
                      </Button>
                    </div>
                  )}

                  <div className="w-20 text-right text-sm font-semibold tabular-nums">
                    {money(item.net)}
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(item)}
                      aria-label="Edit line"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => actions.removeLine(item.lineId)}
                      aria-label="Remove line"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-border px-4 py-3">
        <div className="space-y-1 text-sm">
          <Row label="Subtotal" value={money(sale?.subtotal ?? 0)} />
          {(sale?.discountTotal ?? 0) > 0 && (
            <Row label="Discounts" value={`-${money(sale?.discountTotal ?? 0)}`} muted />
          )}
          <Row label="Tax" value={money(sale?.taxTotal ?? 0)} muted />
          <div className="flex items-center justify-between border-t border-border pt-2 text-lg font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(sale?.total ?? 0)}</span>
          </div>
          {sale && sale.paidTotal > 0 && (
            <>
              <Row label="Paid" value={money(sale.paidTotal)} muted />
              <Row
                label="Balance Due"
                value={money(sale.balance)}
                className="font-semibold text-destructive"
              />
            </>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => sale && actions.toggleTaxExempt()}
            disabled={!sale}
          >
            {sale?.taxExempt ? "Taxable" : "Tax Exempt"}
          </Button>
          <Button
            onClick={onPay}
            disabled={!sale || itemCount(sale) === 0}
            className="text-base"
          >
            <CreditCard /> Pay {money(sale?.balance ?? 0)}
          </Button>
        </div>
      </div>

      {/* Line edit modal */}
      <Modal
        open={!!editLine}
        onClose={() => setEditLine(null)}
        title={editLine?.name}
        description="Override price, apply a discount, or void this line."
        size="md"
        footer={
          <>
            <Button
              variant="destructive"
              onClick={() => {
                if (editLine) actions.voidLine(editLine.lineId)
                setEditLine(null)
              }}
            >
              <Ban /> Void Line
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (editLine) actions.lineDiscount(editLine.lineId, undefined)
                setEditLine(null)
              }}
            >
              Clear Discount
            </Button>
            <Button
              onClick={() => {
                if (!editLine) return
                const newPrice = keypadToCents(priceDigits)
                if (newPrice > 0 && newPrice !== editLine.unitPrice) {
                  actions.priceOverride(editLine.lineId, newPrice)
                }
                const v = Number.parseFloat(discValue)
                if (Number.isFinite(v) && v > 0) {
                  actions.lineDiscount(editLine.lineId, {
                    type: discMode,
                    value: discMode === "percent" ? v : Math.round(v * 100),
                  })
                }
                setEditLine(null)
              }}
            >
              Apply
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Field>
              <FieldLabel>Unit Price</FieldLabel>
              <div className="rounded-lg border border-border bg-muted/40 p-2 text-center text-xl font-bold tabular-nums">
                {money(keypadToCents(priceDigits))}
              </div>
            </Field>
            <NumPad value={priceDigits} onChange={setPriceDigits} />
          </div>
          <div className="space-y-3">
            <Field>
              <FieldLabel>Discount Type</FieldLabel>
              <div className="flex gap-2">
                <Button
                  variant={discMode === "percent" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setDiscMode("percent")}
                >
                  Percent %
                </Button>
                <Button
                  variant={discMode === "amount" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setDiscMode("amount")}
                >
                  Amount $
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel>{discMode === "percent" ? "Percent off" : "Dollar amount off"}</FieldLabel>
              <Input
                inputMode="decimal"
                value={discValue}
                onChange={(e) => setDiscValue(e.target.value)}
                placeholder={discMode === "percent" ? "10" : "1.00"}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Discounts and price overrides are fully undoable from the header.
            </p>
          </div>
        </div>
      </Modal>
    </section>
  )
}

function Row({
  label,
  value,
  muted,
  className,
}: {
  label: string
  value: string
  muted?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className={cn(muted && "text-muted-foreground")}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}