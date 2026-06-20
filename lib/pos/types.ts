
import type { Category, Product, TaxCategory } from "@/lib/types"

export type { Category, Product, TaxCategory }

export type PaymentMethod =
  | "cash"
  | "credit"
  | "debit"
  | "ebt_snap"
  | "ebt_cash"
  | "gift"
  | "store_credit"
  | "check"

export type Discount = {
  type: "percent" | "amount"
  value: number // percent (0-100) OR amount in cents
  reason?: string
}

export type SaleItem = {
  lineId: string
  productId: string
  name: string
  unitPrice: number // cents
  quantity: number
  taxable: boolean
  taxRate: number // decimal
  department: string
  ebtEligible: boolean
  ageRestriction: number
  ageVerified: boolean
  discount?: Discount
  voided: boolean
  refundedQty: number
  isCustom: boolean
  // computed cache
  gross: number // unitPrice * quantity
  discountAmount: number
  net: number // gross - discountAmount
  tax: number
}

export type Payment = {
  id: string
  method: PaymentMethod
  amount: number // cents applied to balance
  tendered?: number // cents handed over (cash)
  change?: number // cents change returned
  reference?: string
  at: number
  refunded?: boolean
}

export type SaleStatus =
  | "open"
  | "completed"
  | "void"
  | "suspended"
  | "refunded"
  | "partial_refund"

export type Sale = {
  id: string
  number: number
  items: SaleItem[]
  payments: Payment[]
  status: SaleStatus
  customerId?: string
  orderDiscount?: Discount
  taxExempt: boolean
  note?: string
  cashierId: string
  registerId: string
  shiftId?: string
  fuelPumpId?: string
  createdAt: number
  completedAt?: number
  refundOfSaleId?: string
  // computed cache
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  paidTotal: number
  balance: number
  changeDue: number
}

export type DrawerTxnType =
  | "open"
  | "sale"
  | "refund"
  | "paid_in"
  | "paid_out"
  | "safe_drop"
  | "no_sale"
  | "close"

export type DrawerTransaction = {
  id: string
  type: DrawerTxnType
  amount: number // cents, signed (in = positive, out = negative)
  note?: string
  by: string
  at: number
}

export type Shift = {
  id: string
  cashierId: string
  registerId: string
  openingFloat: number // cents
  countedClose?: number // cents counted at close
  status: "open" | "closed"
  openedAt: number
  closedAt?: number
  drawer: DrawerTransaction[]
}

export type FuelGrade = {
  name: string
  pricePerGallon: number // cents per gallon
}

export type FuelPumpStatus =
  | "idle"
  | "authorized"
  | "pumping"
  | "paused"
  | "completed"
  | "locked"

export type FuelPump = {
  id: string
  label: string
  status: FuelPumpStatus
  grades: FuelGrade[]
  selectedGrade: number // index
  mode: "prepay" | "postpay"
  prepayAmount?: number // cents
  gallons: number
  amount: number // cents pumped
  saleId?: string
  claimed: boolean
  authorizedAt?: number
  completedAt?: number
}

export type Customer = {
  id: string
  name: string
  phone?: string
  email?: string
  loyaltyPoints: number
  storeCredit: number // cents
  chargeBalance: number // cents owed on house account
  taxExempt: boolean
  createdAt: number
}

export type Employee = {
  id: string
  name: string
  pin: string
  role: "cashier" | "manager" | "admin"
}

export type AuditEntry = {
  id: string
  at: number
  by: string
  action: string
  detail: string
}

export type ButtonKey =
  | "search"
  | "discount"
  | "suspend"
  | "recall"
  | "void"
  | "noSale"
  | "paidIn"
  | "paidOut"
  | "safeDrop"
  | "priceCheck"
  | "customer"
  | "taxExempt"

export type Settings = {
  storeName: string
  storeAddress: string
  storePhone: string
  registerId: string
  defaultTaxRate: number // decimal
  currency: string
  theme: "light" | "dark"
  requireAgePrompt: boolean
  buttonOrder: ButtonKey[]
  lowStockAlerts: boolean
}

// The undoable domain. Everything here is JSON-serializable.
// `products` is exactly `Product[]` from lib/types — same shape that's
// stored in Blob, no mapping/projection step required.
export type DomainState = {
  sale: Sale | null
  sales: Sale[]
  suspended: Sale[]
  shift: Shift | null
  shiftHistory: Shift[]
  dayOpen: boolean
  dayStartedAt: number | null
  dayClosedHistory: { openedAt: number; closedAt: number; total: number }[]
  pumps: FuelPump[]
  products: Product[]
  customers: Customer[]
  employees: Employee[]
  audit: AuditEntry[]
  saleCounter: number
  settings: Settings
  currentCashierId: string
  // carried over from the loaded catalog, for grouping/filtering UI
  categories: Category[]
  taxCategories: TaxCategory[]
}

export type FuelTxnType =
  | "stop"        // normal stop & total
  | "rest_in_gas" // grocery change applied as prepay
  | "transfer_in"
  | "transfer_out"
  | "refund"
  | "manual_adjust"
  | "drive_off"

export type FuelPumpTransaction = {
  timestamp: number
  type: FuelTxnType
  gallons: number
  amount: number // cents, signed where relevant (refund/transfer_out are negative)
  note?: string
}


