import type { DomainState, Sale, SaleItem, Product } from './types'
import { priceCents, isTaxable } from './product-helpers'
import { uid } from '../format'
import { recalcSale } from '../calc'

export function makeSale(d: DomainState): Sale {
  return {
    id: uid('sale'),
    number: d.saleCounter + 1,
    items: [],
    payments: [],
    status: 'open',
    taxExempt: false,
    cashierId: d.currentCashierId,
    registerId: d.settings.registerId,
    shiftId: d.shift?.id,
    createdAt: Date.now(),
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 0,
    paidTotal: 0,
    balance: 0,
    changeDue: 0,
  }
}

export function ensureSale(d: DomainState): { d: DomainState; sale: Sale } {
  if (d.sale) return { d, sale: d.sale }
  const sale = makeSale(d)
  return { d: { ...d, sale, saleCounter: d.saleCounter + 1 }, sale }
}

export function setSale(d: DomainState, sale: Sale): DomainState {
  return { ...d, sale: recalcSale(sale) }
}

export function itemFromProduct(
  p: Product,
  qty: number,
  defaultTaxRate: number,
): SaleItem {
  const taxable = isTaxable(p)
  return {
    lineId: uid('ln'),
    productId: p.id,
    name: p.receipt_name || p.name,
    unitPrice: priceCents(p),
    quantity: qty,
    taxable,
    taxRate: taxable ? defaultTaxRate : 0,
    department: p.category || 'General',
    ebtEligible: !!p.flags?.ebt,
    ageRestriction: p.compliance?.minimum_age ?? 0,
    ageVerified: false,
    voided: false,
    refundedQty: 0,
    isCustom: false,
    gross: 0,
    discountAmount: 0,
    net: 0,
    tax: 0,
  }
}
