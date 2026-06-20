"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CreditCard,
  Wallet,
  Gift,
  Landmark,
  Trash2,
  ShieldAlert,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePOS, ebtEligibleTotal } from "@/lib/pos/store"
import { money } from "@/lib/pos/format"
import { useToast } from "@/components/notify"
import { NumPad } from "@/components/pos/numpad"
import { keypadToCents } from "@/lib/pos/format"
import type { PaymentMethod, Sale } from "@/lib/pos/types"
import { Modal } from "@/components/modal"
import { Field } from "../ui/field"
import { Badge } from "../ui/badge"

const METHODS: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: "cash", label: "Cash", icon: Banknote },
  { key: "credit", label: "Credit", icon: CreditCard },
  { key: "debit", label: "Debit", icon: CreditCard },
  { key: "ebt_snap", label: "EBT SNAP", icon: Wallet },
  { key: "ebt_cash", label: "EBT Cash", icon: Wallet },
  { key: "gift", label: "Gift Card", icon: Gift },
  { key: "store_credit", label: "Store Credit", icon: Landmark },
  { key: "check", label: "Check", icon: Landmark },
]

export function PaymentDialog({
  open,
  onClose,
  onCompleted,
}: {
  open: boolean
  onClose: () => void
  onCompleted: (sale: Sale) => void
}) {
  const { state, actions } = usePOS()
  const { notify } = useToast()
  const sale = state.sale
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [digits, setDigits] = useState("")

  const balance = sale?.balance ?? 0
  const tender = keypadToCents(digits)
  const customer = sale?.customerId
    ? state.customers.find((c) => c.id === sale.customerId)
    : undefined

  // Default the keypad to the remaining balance whenever it changes.
  useEffect(() => {
    if (open) setDigits(balance > 0 ? String(balance) : "")
  }, [open, balance])

  const unverified = useMemo(
    () =>
      sale
        ? sale.items.filter((i) => !i.voided && i.ageRestriction > 0 && !i.ageVerified)
        : [],
    [sale],
  )

  const ebtCap = sale ? ebtEligibleTotal(sale) : 0

  if (!sale) return null

  const quickCash = (() => {
    const target = balance
    const bills = [target, ceilTo(target, 500), ceilTo(target, 1000), ceilTo(target, 2000), ceilTo(target, 5000)]
    return Array.from(new Set(bills)).filter((b) => b >= target).slice(0, 4)
  })()

  const applyPayment = () => {
    const amt = tender
    if (amt <= 0) {
      notify("Enter an amount", "warn")
      return
    }
    if (method === "ebt_snap" && amt > ebtCap) {
      notify(`EBT SNAP can only cover ${money(ebtCap)} of eligible items`, "error")
      return
    }
    if (method === "store_credit" && customer && amt > customer.storeCredit) {
      notify(`Customer only has ${money(customer.storeCredit)} store credit`, "error")
      return
    }
    const applied = method === "cash" ? Math.min(amt, balance) : Math.min(amt, balance)
    actions.addPayment(method, applied, method === "cash" ? amt : undefined)
    setDigits("")
  }

  const finalize = () => {
    if (unverified.length > 0) {
      notify("Verify age-restricted items before completing", "error")
      return
    }
    if (sale.balance > 0) {
      notify(`Still owe ${money(sale.balance)}`, "warn")
      return
    }
    const completed = actions.completeSale()
    if (completed) {
      onCompleted(completed)
      notify(`Sale #${completed.number} complete`, "success")
    }
  }

  const changeDue = sale.payments.reduce((s, p) => s + (p.change ?? 0), 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Payment · ${money(sale.total)}`}
      description="Take split tenders. Cash auto-calculates change."
      size="xl"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Back to Sale
          </Button>
          <Button
            onClick={finalize}
            disabled={sale.balance > 0 || unverified.length > 0}
            className="text-base"
          >
            <Check /> Complete {sale.balance > 0 ? `(owe ${money(sale.balance)})` : ""}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* Left: tender entry */}
        <div className="space-y-3">
          {unverified.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <ShieldAlert className="size-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Age verification required</p>
                <ul className="mt-1 space-y-1">
                  {unverified.map((i) => (
                    <li key={i.lineId} className="flex items-center justify-between gap-2">
                      <span>{i.name} ({i.ageRestriction}+)</span>
                      <Button size="xs" variant="secondary" onClick={() => actions.verifyAge(i.lineId)}>
                        Verify
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            {METHODS.map((m) => {
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition-colors ${
                    method === m.key
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="size-4" />
                  {m.label}
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Tender Amount
            </div>
            <div className="text-3xl font-bold tabular-nums">{money(tender)}</div>
            {method === "cash" && tender > balance && (
              <div className="text-sm text-emerald-600">Change {money(tender - balance)}</div>
            )}
          </div>

          {method === "cash" && (
            <div className="grid grid-cols-4 gap-1.5">
              {quickCash.map((c) => (
                <button
                  key={c}
                  onClick={() => setDigits(String(c))}
                  className="rounded-lg border border-border bg-background py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  {money(c)}
                </button>
              ))}
            </div>
          )}

          <NumPad value={digits} onChange={setDigits} />
          <Button variant="secondary" className="w-full" onClick={applyPayment}>
            Add {METHODS.find((m) => m.key === method)?.label} Payment
          </Button>
        </div>

        {/* Right: summary */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <SummaryRow label="Total Due" value={money(sale.total)} bold />
            <SummaryRow label="Paid" value={money(sale.paidTotal)} />
            <div className="my-2 border-t border-border" />
            <SummaryRow
              label={sale.balance > 0 ? "Balance" : changeDue > 0 ? "Change Due" : "Settled"}
              value={sale.balance > 0 ? money(sale.balance) : money(changeDue)}
              bold
              tone={sale.balance > 0 ? "destructive" : "success"}
            />
          </div>

          {ebtCap > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              EBT SNAP eligible total: <span className="font-semibold">{money(ebtCap)}</span>
            </div>
          )}
          {customer && customer.storeCredit > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              {customer.name} store credit:{" "}
              <span className="font-semibold">{money(customer.storeCredit)}</span>
            </div>
          )}

          <Field>
            <div className="space-y-1.5">
              {sale.payments.length === 0 && (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              )}
              {sale.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize">
                      {p.method.replace("_", " ")}
                    </Badge>
                    <span className="tabular-nums">{money(p.amount)}</span>
                    {p.change ? (
                      <span className="text-xs text-muted-foreground">
                        chg {money(p.change)}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => actions.removePayment(p.id)}
                    aria-label="Remove payment"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step
}

function SummaryRow({
  label,
  value,
  bold,
  tone,
}: {
  label: string
  value: string
  bold?: boolean
  tone?: "destructive" | "success"
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span
        className={`tabular-nums ${bold ? "font-bold" : ""} ${
          tone === "destructive" ? "text-destructive" : tone === "success" ? "text-emerald-600" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}
