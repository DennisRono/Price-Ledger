import type { Discount, Sale, SaleItem } from "./types"

export function applyDiscount(base: number, discount?: Discount): number {
  if (!discount) return 0
  if (discount.type === "percent") {
    const v = Math.max(0, Math.min(100, discount.value))
    return Math.round((base * v) / 100)
  }
  return Math.max(0, Math.min(base, Math.round(discount.value)))
}

// Recompute a single line item's cached money fields.
export function recalcItem(item: SaleItem): SaleItem {
  if (item.voided) {
    return { ...item, gross: 0, discountAmount: 0, net: 0, tax: 0 }
  }
  const effectiveQty = Math.max(0, item.quantity - item.refundedQty)
  const gross = Math.round(item.unitPrice * effectiveQty)
  const discountAmount = applyDiscount(gross, item.discount)
  const net = Math.max(0, gross - discountAmount)
  return { ...item, gross, discountAmount, net, tax: 0 }
}

// Recompute the whole sale: line totals, order discount, tax, balance, change.
export function recalcSale(sale: Sale): Sale {
  const items = sale.items.map(recalcItem)

  const lineNetTotal = items.reduce((s, i) => s + i.net, 0)
  const orderDiscount = applyDiscount(lineNetTotal, sale.orderDiscount)

  // Distribute the order discount proportionally so per-line tax stays correct.
  let taxTotal = 0
  const taxedItems = items.map((i) => {
    if (i.voided || i.net <= 0) return { ...i, tax: 0 }
    const share = lineNetTotal > 0 ? i.net / lineNetTotal : 0
    const lineAfterOrderDisc = i.net - Math.round(orderDiscount * share)
    const taxable = sale.taxExempt ? false : i.taxable
    const tax = taxable ? Math.round(lineAfterOrderDisc * (i.taxRate || 0)) : 0
    taxTotal += tax
    return { ...i, tax }
  })

  const subtotal = lineNetTotal
  const discountTotal =
    items.reduce((s, i) => s + i.discountAmount, 0) + orderDiscount
  const total = Math.max(0, subtotal - orderDiscount + taxTotal)

  const paidTotal = sale.payments
    .filter((p) => !p.refunded)
    .reduce((s, p) => s + p.amount, 0)
  const balance = total - paidTotal
  const changeDue = balance < 0 ? -balance : 0

  return {
    ...sale,
    items: taxedItems,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    paidTotal,
    balance: balance < 0 ? 0 : balance,
    changeDue,
  }
}

export function ebtEligibleTotal(sale: Sale): number {
  // EBT SNAP can only cover eligible, non-taxable food items (simplified rule).
  return sale.items
    .filter((i) => !i.voided && i.ebtEligible)
    .reduce((s, i) => s + i.net, 0)
}

export function itemCount(sale: Sale | null): number {
  if (!sale) return 0
  return sale.items
    .filter((i) => !i.voided)
    .reduce((s, i) => s + (i.quantity - i.refundedQty), 0)
}

export function loyaltyEarned(total: number): number {
  // 1 point per dollar spent.
  return Math.floor(total / 100)
}
