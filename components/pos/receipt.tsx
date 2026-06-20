"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePOS } from "@/lib/pos/store"
import { money, dateTime } from "@/lib/pos/format"
import type { Sale } from "@/lib/pos/types"
import { Modal } from "@/components/modal"

export function ReceiptModal({
  sale,
  open,
  onClose,
}: {
  sale: Sale | null
  open: boolean
  onClose: () => void
}) {
  const { state } = usePOS()
  if (!sale) return null

  const cashier = state.employees.find((e) => e.id === sale.cashierId)
  const customer = sale.customerId
    ? state.customers.find((c) => c.id === sale.customerId)
    : undefined
  const liveItems = sale.items.filter((i) => !i.voided)
  const changeDue = sale.payments.reduce((s, p) => s + (p.change ?? 0), 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receipt"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="mx-auto max-w-xs font-mono text-xs leading-relaxed">
        <div className="text-center">
          <div className="text-sm font-bold">{state.settings.storeName}</div>
          <div className="text-muted-foreground">{state.settings.storeAddress}</div>
          <div className="text-muted-foreground">{state.settings.storePhone}</div>
        </div>
        <Divider />
        <div className="flex justify-between">
          <span>Sale #{sale.number}</span>
          <span className="capitalize">{sale.status.replace("_", " ")}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{dateTime(sale.completedAt ?? sale.createdAt)}</span>
          <span>{sale.registerId}</span>
        </div>
        <div className="text-muted-foreground">Cashier: {cashier?.name ?? "—"}</div>
        {customer && <div className="text-muted-foreground">Customer: {customer.name}</div>}
        <Divider />
        {liveItems.map((i) => (
          <div key={i.lineId} className="mb-1">
            <div className="flex justify-between">
              <span className="truncate pr-2">{i.name}</span>
              <span className="tabular-nums">{money(i.net)}</span>
            </div>
            <div className="text-muted-foreground">
              {i.quantity} @ {money(i.unitPrice)}
              {i.discount ? "  (disc)" : ""}
              {i.taxable ? "" : "  *no tax"}
            </div>
          </div>
        ))}
        <Divider />
        <Line label="Subtotal" value={money(sale.subtotal)} />
        {sale.discountTotal > 0 && <Line label="Discounts" value={`-${money(sale.discountTotal)}`} />}
        <Line label="Tax" value={money(sale.taxTotal)} />
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span className="tabular-nums">{money(sale.total)}</span>
        </div>
        <Divider />
        {sale.payments.map((p) => (
          <Line
            key={p.id}
            label={`${labelForMethod(p.method)}${p.tendered ? ` (tendered ${money(p.tendered)})` : ""}`}
            value={money(p.amount)}
          />
        ))}
        {changeDue > 0 && <Line label="Change" value={money(changeDue)} />}
        <Divider />
        <div className="text-center text-muted-foreground">
          {customer ? `Loyalty points balance updated` : "Thank you for your visit!"}
        </div>
      </div>
    </Modal>
  )
}

function labelForMethod(m: string): string {
  const map: Record<string, string> = {
    cash: "Cash",
    credit: "Credit",
    debit: "Debit",
    ebt_snap: "EBT SNAP",
    ebt_cash: "EBT Cash",
    gift: "Gift Card",
    store_credit: "Store Credit",
    check: "Check",
  }
  return map[m] ?? m
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-border" />
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="truncate pr-2 text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
