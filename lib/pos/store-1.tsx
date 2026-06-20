'use client'

// ---------------------------------------------------------------------------
// Types – moved to top so they can be used without importing from "./types"
// ---------------------------------------------------------------------------

import type {
  Category,
  Product,
  StoreCatalog,
  StoreIndex,
  TaxCategory,
} from '@/lib/types'

export type PaymentMethod =
  | 'cash'
  | 'credit'
  | 'debit'
  | 'ebt_snap'
  | 'ebt_cash'
  | 'gift'
  | 'store_credit'
  | 'check'

export type Discount = {
  type: 'percent' | 'amount'
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
  | 'open'
  | 'completed'
  | 'void'
  | 'suspended'
  | 'refunded'
  | 'partial_refund'

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
  | 'open'
  | 'sale'
  | 'refund'
  | 'paid_in'
  | 'paid_out'
  | 'safe_drop'
  | 'no_sale'
  | 'close'

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
  status: 'open' | 'closed'
  openedAt: number
  closedAt?: number
  drawer: DrawerTransaction[]
}

export type FuelGrade = {
  name: string
  pricePerGallon: number // cents per gallon
}

export type FuelPumpStatus =
  | 'idle'
  | 'authorized'
  | 'pumping'
  | 'paused'
  | 'completed'
  | 'locked'

export type FuelTxnType =
  | 'stop' // normal stop & total
  | 'rest_in_gas' // grocery change applied as prepay
  | 'transfer_in'
  | 'transfer_out'
  | 'refund'
  | 'manual_adjust'
  | 'drive_off'

export type FuelPumpTransaction = {
  timestamp: number
  type: FuelTxnType
  gallons: number
  amount: number // cents, signed where relevant (refund/transfer_out are negative)
  note?: string
}

export type FuelPump = {
  id: string
  label: string
  status: FuelPumpStatus
  grades: FuelGrade[]
  selectedGrade: number // index
  mode: 'prepay' | 'postpay'
  prepayAmount?: number // cents
  gallons: number
  amount: number // cents pumped
  saleId?: string
  claimed: boolean
  authorizedAt?: number
  completedAt?: number
  transactions: FuelPumpTransaction[] // <-- FIXED: added missing property
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
  role: 'cashier' | 'manager' | 'admin'
}

export type AuditEntry = {
  id: string
  at: number
  by: string
  action: string
  detail: string
}

export type ButtonKey =
  | 'search'
  | 'discount'
  | 'suspend'
  | 'recall'
  | 'void'
  | 'noSale'
  | 'paidIn'
  | 'paidOut'
  | 'safeDrop'
  | 'priceCheck'
  | 'customer'
  | 'taxExempt'

export type Settings = {
  storeName: string
  storeAddress: string
  storePhone: string
  registerId: string
  defaultTaxRate: number // decimal
  currency: string
  theme: 'light' | 'dark'
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
  categories: Category[]
  taxCategories: TaxCategory[]
}

// Re-export these from the local definitions (they are also used in the provider)
export type { Category, Product, TaxCategory }

// ===========================================================================
// Imports for helpers (blob, calc, format)
// ===========================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ebtEligibleTotal, loyaltyEarned, recalcSale } from './calc'
import { uid } from './format'

// ---------------------------------------------------------------------------
// Blob fetch helpers (client-side, using public URLs)
// ---------------------------------------------------------------------------

// Set NEXT_PUBLIC_BLOB_BASE_URL in your .env to the public URL of your blob container,
// e.g. https://your-account.blob.vercel-storage.com
const BLOB_BASE = process.env.NEXT_PUBLIC_BLOB_BASE_URL || ''

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function fetchIndex(): Promise<StoreIndex | null> {
  if (!BLOB_BASE) {
    console.warn('NEXT_PUBLIC_BLOB_BASE_URL is not set – catalog will not load')
    return null
  }
  return fetchJson<StoreIndex>(`${BLOB_BASE}/catalog/index.json`)
}

async function fetchCatalog(storeId: string): Promise<StoreCatalog | null> {
  if (!BLOB_BASE) return null
  return fetchJson<StoreCatalog>(`${BLOB_BASE}/catalog/stores/${storeId}.json`)
}

// ---------------------------------------------------------------------------
// Small Product helpers. Product's interesting fields are optional/nested
// (pricing.unit_price_cents, tax?.taxable, inventory?.quantity_on_hand,
// compliance?.minimum_age, flags?.ebt) so reads go through these instead of
// being repeated inline everywhere.
// ---------------------------------------------------------------------------

function priceCents(p: Product): number {
  return p.pricing.unit_price_cents ?? 0
}

function isTaxable(p: Product): boolean {
  return p.tax?.taxable ?? true
}

function stockOf(p: Product): number {
  return p.inventory?.quantity_on_hand ?? 0
}

function withStockDelta(p: Product, delta: number): Product {
  if (delta === 0) return p
  return {
    ...p,
    inventory: {
      ...p.inventory,
      quantity_on_hand: stockOf(p) + delta,
    },
  }
}

// ---------------------------------------------------------------------------
// Persistence & reducer
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'v0_pos_state_v1'
const MAX_HISTORY = 80

type HistEntry = { state: DomainState; label: string }

type FullState = {
  past: HistEntry[]
  present: DomainState
  future: HistEntry[]
  lastLabel: string
}

type Action =
  | {
      type: 'COMMIT'
      label: string
      mutate: (d: DomainState) => DomainState
      audit?: string
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'HYDRATE'; present: DomainState }
  | { type: 'RESET' }

function pushAudit(
  d: DomainState,
  action: string,
  detail: string,
): DomainState {
  const entry = {
    id: uid('aud'),
    at: Date.now(),
    by: d.currentCashierId,
    action,
    detail,
  }
  return { ...d, audit: [entry, ...d.audit].slice(0, 500) }
}

function reducer(state: FullState, action: Action): FullState {
  switch (action.type) {
    case 'COMMIT': {
      let next = action.mutate(state.present)
      if (action.audit) next = pushAudit(next, action.label, action.audit)
      const past = [
        ...state.past,
        { state: state.present, label: state.lastLabel },
      ].slice(-MAX_HISTORY)
      return { past, present: next, future: [], lastLabel: action.label }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: prev.state,
        future: [
          { state: state.present, label: state.lastLabel },
          ...state.future,
        ],
        lastLabel: prev.label,
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        past: [
          ...state.past,
          { state: state.present, label: state.lastLabel },
        ].slice(-MAX_HISTORY),
        present: next.state,
        future: state.future.slice(1),
        lastLabel: next.label,
      }
    }
    case 'HYDRATE':
      return {
        past: [],
        present: action.present,
        future: [],
        lastLabel: 'Loaded',
      }
    case 'RESET':
      return {
        past: [],
        present: fallbackDomain(),
        future: [],
        lastLabel: 'Reset',
      }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Domain mutators (pure). Each is wrapped by the store's commit().
// ---------------------------------------------------------------------------

function makeSale(d: DomainState): Sale {
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

function ensureSale(d: DomainState): { d: DomainState; sale: Sale } {
  if (d.sale) return { d, sale: d.sale }
  const sale = makeSale(d)
  return { d: { ...d, sale, saleCounter: d.saleCounter + 1 }, sale }
}

function setSale(d: DomainState, sale: Sale): DomainState {
  return { ...d, sale: recalcSale(sale) }
}

function itemFromProduct(
  p: Product,
  qty: number,
  defaultTaxRate: number,
): SaleItem {
  const taxable = isTaxable(p)
  return {
    lineId: uid('ln'),
    productId: p.id,
    name: p.receipt_name || p.name,
    unitPrice: priceCents(p), // cents — matches product?.pricing?.unit_price_cents directly
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

// ---------------------------------------------------------------------------
// Fallback domain
// ---------------------------------------------------------------------------

function defaultSettings(): Settings {
  return {
    storeName: '',
    storeAddress: '',
    storePhone: '',
    registerId: 'reg-1',
    defaultTaxRate: 0.07,
    currency: 'USD',
    theme: 'light',
    requireAgePrompt: true,
    buttonOrder: [
      'search',
      'discount',
      'suspend',
      'recall',
      'void',
      'noSale',
      'paidIn',
      'paidOut',
      'safeDrop',
      'priceCheck',
      'customer',
      'taxExempt',
    ],
    lowStockAlerts: true,
  }
}

function fallbackDomain(): DomainState {
  return {
    sale: null,
    sales: [],
    suspended: [],
    customers: [],
    employees: [],
    products: [],
    pumps: [],
    shift: null,
    shiftHistory: [],
    dayOpen: false,
    dayStartedAt: null,
    dayClosedHistory: [],
    audit: [],
    saleCounter: 0,
    currentCashierId: 'default',
    settings: defaultSettings(),
    categories: [],
    taxCategories: [],
  }
}

// ---------------------------------------------------------------------------
// POS Provider
// ---------------------------------------------------------------------------

export type POSActions = {
  newSale: () => void
  addProduct: (productId: string, qty?: number) => void
  addCustom: (
    price: number,
    department: string,
    opts?: { name?: string; taxable?: boolean; ebtEligible?: boolean },
  ) => void
  scan: (barcode: string) => Product | null
  setQty: (lineId: string, qty: number) => void
  incQty: (lineId: string) => void
  decQty: (lineId: string) => void
  voidLine: (lineId: string) => void
  removeLine: (lineId: string) => void
  verifyAge: (lineId: string) => void
  priceOverride: (lineId: string, price: number) => void
  lineDiscount: (lineId: string, discount: Discount | undefined) => void
  orderDiscount: (discount: Discount | undefined) => void
  setCustomer: (customerId: string | undefined) => void
  toggleTaxExempt: () => void
  setNote: (note: string) => void
  addPayment: (
    method: PaymentMethod,
    amount: number,
    tendered?: number,
    reference?: string,
  ) => void
  removePayment: (paymentId: string) => void
  completeSale: () => Sale | null
  voidSale: () => void
  reorderProducts: (productIds: string[]) => void
  nextDollar: () => void
  suspendSale: () => void
  resumeSale: (saleId: string) => void
  refundSale: (
    originalId: string,
    lines: { lineId: string; qty: number }[],
    method: PaymentMethod,
  ) => Sale | null
  // inventory
  createProduct: (p: Omit<Product, 'id'> & { id?: string }) => Product
  updateProduct: (p: Product) => void
  adjustStock: (productId: string, delta: number, reason: string) => void
  // shift / drawer / day
  openShift: (openingFloat: number, cashierId?: string) => void
  closeShift: (countedClose: number) => void
  drawerTxn: (type: DrawerTxnType, amount: number, note?: string) => void
  openDay: () => void
  closeDay: () => void
  // fuel
  fuelAuthorize: (
    pumpId: string,
    mode: 'prepay' | 'postpay',
    grade: number,
    prepayAmount?: number,
  ) => void
  fuelStart: (pumpId: string) => void
  fuelPause: (pumpId: string) => void
  fuelResume: (pumpId: string) => void
  fuelStop: (pumpId: string, gallons: number, amount: number) => void
  fuelLock: (pumpId: string, locked: boolean) => void
  fuelSetPrice: (pumpId: string, gradeIndex: number, price: number) => void
  fuelClaim: (pumpId: string) => void
  fuelDriveOff: (pumpId: string) => void
  addPump: () => void
  fuelAddRest: (pumpId: string, amountCents: number) => void
  fuelTransfer: (pumpId: string, targetPumpId: string) => void
  fuelRefund: (pumpId: string, amountCents: number, reason: string) => void
  fuelAdjust: (pumpId: string, gallons: number, amountCents: number) => void
  // customers
  createCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => Customer
  // settings / misc
  updateSettings: (partial: Partial<Settings>) => void
  setCashier: (cashierId: string) => void
  setProducts: (products: Product[]) => void
  setCategories: (categories: Category[]) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

type POSContextValue = {
  state: DomainState
  canUndo: boolean
  canRedo: boolean
  lastLabel: string
  actions: POSActions
  ready: boolean
}

const POSContext = createContext<POSContextValue | null>(null)

export function POSProvider({ children }: { children: ReactNode }) {
  const [full, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: fallbackDomain(),
    future: [],
    lastLabel: 'Start',
  }))

  const [hydrated, setHydrated] = useState(false)
  const catalogLoadedRef = useRef(false)

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DomainState>
        if (parsed && typeof parsed === 'object') {
          // Merge with fresh defaults so new fields (categories, taxCategories,
          // etc.) never come back undefined for older saved state.
          const merged: DomainState = { ...fallbackDomain(), ...parsed }
          dispatch({ type: 'HYDRATE', present: merged })
        }
      }
    } catch {
      /* ignore corrupt storage */
    } finally {
      setHydrated(true)
    }
  }, [])

  // Load catalog from Blob — once, after hydration completes. Since Product
  // is the same type in the catalog and in DomainState, this is a straight
  // assignment, no mapping step.
  useEffect(() => {
    if (!hydrated || catalogLoadedRef.current) return
    catalogLoadedRef.current = true // claim immediately to avoid double-fetch in StrictMode

    let cancelled = false
    ;(async () => {
      try {
        const index = await fetchIndex()
        if (!index || index.stores.length === 0) {
          console.warn('No stores found in catalog index')
          return
        }
        const firstStore = index.stores[0]
        const catalog = await fetchCatalog(firstStore.id)
        if (!catalog || cancelled) return

        dispatch({
          type: 'COMMIT',
          label: 'Catalog loaded',
          mutate: (d) => ({
            ...d,
            products: catalog.products,
            categories: catalog.categories ?? [],
            taxCategories: catalog.tax_categories ?? [],
            settings: d.settings.storeName.trim()
              ? d.settings
              : { ...d.settings, storeName: catalog.store },
          }),
          audit: `Loaded ${catalog.products.length} products from ${catalog.store}`,
        })
      } catch (err) {
        console.warn('Failed to load catalog from Blob', err)
        catalogLoadedRef.current = false // allow retry on next hydrate cycle
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hydrated])

  // Persist on every change.
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(full.present))
    } catch {
      /* ignore quota errors */
    }
  }, [hydrated, full.present])

  // Apply theme class.
  useEffect(() => {
    const root = document.documentElement
    if (full.present.settings.theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [full.present.settings.theme])

  const actions = useMemo<POSActions>(() => {
    const commit = (
      label: string,
      mutate: (d: DomainState) => DomainState,
      audit?: string,
    ) => dispatch({ type: 'COMMIT', label, mutate, audit })

    return {
      newSale: () =>
        commit('New Sale', (d) => {
          const sale = makeSale(d)
          return { ...d, sale, saleCounter: d.saleCounter + 1 }
        }),

      addProduct: (productId, qty = 1) =>
        commit(
          'Add Item',
          (d0) => {
            const product = d0.products.find((p) => p.id === productId)
            if (!product) return d0
            const { d, sale } = ensureSale(d0)
            const existing = sale.items.find(
              (i) => i.productId === productId && !i.voided && !i.isCustom,
            )
            let items: SaleItem[]
            if (existing) {
              items = sale.items.map((i) =>
                i.lineId === existing.lineId
                  ? { ...i, quantity: i.quantity + qty }
                  : i,
              )
            } else {
              items = [
                ...sale.items,
                itemFromProduct(product, qty, d.settings.defaultTaxRate),
              ]
            }
            return setSale(d, { ...sale, items })
          },
          `Product ${productId}`,
        ),

      addCustom: (price, department, opts) =>
        commit(
          'Custom Item',
          (d0) => {
            if (price <= 0) return d0
            const { d, sale } = ensureSale(d0)
            const item: SaleItem = {
              lineId: uid('ln'),
              productId: `custom_${uid('c')}`,
              name: opts?.name || `${department} Item`,
              unitPrice: price, // cents
              quantity: 1,
              taxable: opts?.taxable ?? true,
              taxRate: (opts?.taxable ?? true) ? d.settings.defaultTaxRate : 0,
              department,
              ebtEligible: opts?.ebtEligible ?? false,
              ageRestriction: 0,
              ageVerified: false,
              voided: false,
              refundedQty: 0,
              isCustom: true,
              gross: 0,
              discountAmount: 0,
              net: 0,
              tax: 0,
            }
            return setSale(d, { ...sale, items: [...sale.items, item] })
          },
          'Custom item',
        ),

      scan: (barcode) => {
        const trimmed = barcode.trim()
        const product =
          full.present.products.find(
            (p) => p.barcode !== null && p.barcode === trimmed,
          ) || null
        if (product) {
          commit(
            'Scan Item',
            (d0) => {
              const { d, sale } = ensureSale(d0)
              const existing = sale.items.find(
                (i) => i.productId === product.id && !i.voided && !i.isCustom,
              )
              let items: SaleItem[]
              if (existing) {
                items = sale.items.map((i) =>
                  i.lineId === existing.lineId
                    ? { ...i, quantity: i.quantity + 1 }
                    : i,
                )
              } else {
                items = [
                  ...sale.items,
                  itemFromProduct(product, 1, d.settings.defaultTaxRate),
                ]
              }
              return setSale(d, { ...sale, items })
            },
            `Scan ${barcode}`,
          )
        }
        return product
      },

      setQty: (lineId, qty) =>
        commit('Change Qty', (d) => {
          if (!d.sale) return d
          const items = d.sale.items.map((i) =>
            i.lineId === lineId
              ? { ...i, quantity: Math.max(1, Math.round(qty)) }
              : i,
          )
          return setSale(d, { ...d.sale, items })
        }),

      incQty: (lineId) =>
        commit('Increase Qty', (d) => {
          if (!d.sale) return d
          const items = d.sale.items.map((i) =>
            i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
          )
          return setSale(d, { ...d.sale, items })
        }),

      decQty: (lineId) =>
        commit('Decrease Qty', (d) => {
          if (!d.sale) return d
          const items = d.sale.items.map((i) =>
            i.lineId === lineId
              ? { ...i, quantity: Math.max(1, i.quantity - 1) }
              : i,
          )
          return setSale(d, { ...d.sale, items })
        }),

      voidLine: (lineId) =>
        commit(
          'Void Line',
          (d) => {
            if (!d.sale) return d
            const items = d.sale.items.map((i) =>
              i.lineId === lineId ? { ...i, voided: true } : i,
            )
            return setSale(d, { ...d.sale, items })
          },
          'Voided line',
        ),

      removeLine: (lineId) =>
        commit('Remove Line', (d) => {
          if (!d.sale) return d
          const items = d.sale.items.filter((i) => i.lineId !== lineId)
          return setSale(d, { ...d.sale, items })
        }),

      verifyAge: (lineId) =>
        commit(
          'Verify Age',
          (d) => {
            if (!d.sale) return d
            const items = d.sale.items.map((i) =>
              i.lineId === lineId ? { ...i, ageVerified: true } : i,
            )
            return setSale(d, { ...d.sale, items })
          },
          'Age verified',
        ),

      priceOverride: (lineId, price) =>
        commit(
          'Price Override',
          (d) => {
            if (!d.sale) return d
            const items = d.sale.items.map((i) =>
              i.lineId === lineId
                ? { ...i, unitPrice: Math.max(0, Math.round(price)) }
                : i,
            )
            return setSale(d, { ...d.sale, items })
          },
          'Price override',
        ),

      lineDiscount: (lineId, discount) =>
        commit(
          'Line Discount',
          (d) => {
            if (!d.sale) return d
            const items = d.sale.items.map((i) =>
              i.lineId === lineId ? { ...i, discount } : i,
            )
            return setSale(d, { ...d.sale, items })
          },
          'Line discount',
        ),

      orderDiscount: (discount) =>
        commit(
          'Order Discount',
          (d) => {
            if (!d.sale) return d
            return setSale(d, { ...d.sale, orderDiscount: discount })
          },
          'Order discount',
        ),

      setCustomer: (customerId) =>
        commit('Set Customer', (d) => {
          if (!d.sale) return d
          const cust = customerId
            ? d.customers.find((c) => c.id === customerId)
            : undefined
          return setSale(d, {
            ...d.sale,
            customerId,
            taxExempt: cust?.taxExempt ?? d.sale.taxExempt,
          })
        }),

      toggleTaxExempt: () =>
        commit('Toggle Tax Exempt', (d) => {
          if (!d.sale) return d
          return setSale(d, { ...d.sale, taxExempt: !d.sale.taxExempt })
        }),

      setNote: (note) =>
        commit('Set Note', (d) => {
          if (!d.sale) return d
          return setSale(d, { ...d.sale, note })
        }),

      addPayment: (method, amount, tendered, reference) =>
        commit(
          'Payment',
          (d) => {
            if (!d.sale) return d
            const change =
              method === 'cash' && typeof tendered === 'number'
                ? Math.max(0, tendered - amount)
                : 0
            const payment: Payment = {
              id: uid('pay'),
              method,
              amount,
              tendered,
              change,
              reference,
              at: Date.now(),
            }
            return setSale(d, {
              ...d.sale,
              payments: [...d.sale.payments, payment],
            })
          },
          'Payment added',
        ),

      removePayment: (paymentId) =>
        commit('Remove Payment', (d) => {
          if (!d.sale) return d
          return setSale(d, {
            ...d.sale,
            payments: d.sale.payments.filter((p) => p.id !== paymentId),
          })
        }),

      completeSale: () => {
        let result: Sale | null = null
        commit(
          'Complete Sale',
          (d) => {
            if (!d.sale) return d
            const sale = recalcSale(d.sale)
            if (sale.items.filter((i) => !i.voided).length === 0) return d
            if (sale.balance > 0) return d
            const completed: Sale = {
              ...sale,
              status: 'completed',
              completedAt: Date.now(),
            }
            result = completed

            // Decrement stock.
            const products = d.products.map((p) => {
              const sold = completed.items
                .filter((i) => !i.voided && i.productId === p.id)
                .reduce((s, i) => s + (i.quantity - i.refundedQty), 0)
              return sold > 0 ? withStockDelta(p, -sold) : p
            })

            // Customer loyalty + store credit / charge handling.
            let customers = d.customers
            if (completed.customerId) {
              customers = d.customers.map((c) => {
                if (c.id !== completed.customerId) return c
                let storeCredit = c.storeCredit
                completed.payments.forEach((p) => {
                  if (p.method === 'store_credit') storeCredit -= p.amount
                })
                return {
                  ...c,
                  loyaltyPoints:
                    c.loyaltyPoints + loyaltyEarned(completed.total),
                  storeCredit: Math.max(0, storeCredit),
                }
              })
            }

            // Cash drawer impact.
            let shift = d.shift
            if (shift) {
              const cashIn = completed.payments
                .filter((p) => p.method === 'cash')
                .reduce((s, p) => s + p.amount, 0)
              const drawer = [
                ...shift.drawer,
                {
                  id: uid('dt'),
                  type: 'sale' as DrawerTxnType,
                  amount: cashIn,
                  note: `Sale #${completed.number}`,
                  by: d.currentCashierId,
                  at: Date.now(),
                },
              ]
              shift = { ...shift, drawer }
            }

            // Release any fuel pump tied to this sale.
            const pumps = d.pumps.map((pp) =>
              pp.saleId === completed.id
                ? {
                    ...pp,
                    status: 'idle' as const,
                    claimed: true,
                    saleId: undefined,
                    gallons: 0,
                    amount: 0,
                    prepayAmount: undefined,
                  }
                : pp,
            )

            return {
              ...d,
              sale: null,
              sales: [completed, ...d.sales],
              products,
              customers,
              shift,
              pumps,
            }
          },
          'Sale completed',
        )
        return result
      },

      voidSale: () =>
        commit(
          'Void Sale',
          (d) => {
            if (!d.sale) return d
            const voided: Sale = {
              ...recalcSale(d.sale),
              status: 'void',
              completedAt: Date.now(),
            }
            const pumps = d.pumps.map((pp) =>
              pp.saleId === d.sale!.id
                ? { ...pp, status: 'idle' as const, saleId: undefined }
                : pp,
            )
            return { ...d, sale: null, sales: [voided, ...d.sales], pumps }
          },
          'Sale voided',
        ),

      reorderProducts: (productIds) =>
        commit(
          'Reorder Products',
          (d) => {
            const currentProducts = d.products
            const idSet = new Set(productIds)
            // Ensure all ids exist
            const validIds = productIds.filter((id) =>
              currentProducts.some((p) => p.id === id),
            )
            if (validIds.length === 0) return d

            // Find first index where a reordered item appears to preserve order of non-reordered items
            const firstIdx = currentProducts.findIndex((p) => idSet.has(p.id))
            const remaining = currentProducts.filter((p) => !idSet.has(p.id))
            const before = remaining.slice(0, firstIdx)
            const after = remaining.slice(firstIdx)
            const reorderedItems = validIds.map(
              (id) => currentProducts.find((p) => p.id === id)!,
            )
            const newProducts = [...before, ...reorderedItems, ...after]
            return { ...d, products: newProducts }
          },
          'Products reordered',
        ),

      nextDollar: () =>
        commit(
          'Next Dollar',
          (d) => {
            if (!d.sale) return d
            const sale = recalcSale(d.sale)
            if (sale.balance <= 0) return d // already paid
            const rounded = Math.ceil(sale.balance)
            const amount = sale.balance
            const tendered = rounded
            const change = tendered - amount
            const payment: Payment = {
              id: uid('pay'),
              method: 'cash',
              amount,
              tendered,
              change,
              at: Date.now(),
            }
            const updatedSale = {
              ...sale,
              payments: [...sale.payments, payment],
            }
            return setSale(d, updatedSale)
          },
          'Next dollar payment',
        ),

      suspendSale: () =>
        commit(
          'Suspend Sale',
          (d) => {
            if (!d.sale) return d
            const suspended: Sale = {
              ...recalcSale(d.sale),
              status: 'suspended',
            }
            return { ...d, sale: null, suspended: [suspended, ...d.suspended] }
          },
          'Sale suspended',
        ),

      resumeSale: (saleId) =>
        commit(
          'Recall Sale',
          (d) => {
            const found = d.suspended.find((s) => s.id === saleId)
            if (!found) return d
            let suspended = d.suspended.filter((s) => s.id !== saleId)
            if (d.sale) {
              suspended = [
                { ...recalcSale(d.sale), status: 'suspended' },
                ...suspended,
              ]
            }
            return {
              ...d,
              sale: recalcSale({ ...found, status: 'open' }),
              suspended,
            }
          },
          'Sale recalled',
        ),

      refundSale: (originalId, lines, method) => {
        let result: Sale | null = null
        commit(
          'Refund',
          (d) => {
            const original = d.sales.find((s) => s.id === originalId)
            if (!original) return d
            const refundItems: SaleItem[] = []
            const updatedOriginalItems = original.items.map((i) => {
              const req = lines.find((l) => l.lineId === i.lineId)
              if (!req || req.qty <= 0) return i
              const available = i.quantity - i.refundedQty
              const qty = Math.min(req.qty, available)
              if (qty <= 0) return i
              refundItems.push({
                ...i,
                lineId: uid('ln'),
                quantity: qty,
                refundedQty: 0,
                voided: false,
              })
              return { ...i, refundedQty: i.refundedQty + qty }
            })
            if (refundItems.length === 0) return d

            let refund: Sale = {
              ...makeSale(d),
              items: refundItems,
              taxExempt: original.taxExempt,
              customerId: original.customerId,
              status: 'refunded',
              refundOfSaleId: original.id,
              completedAt: Date.now(),
            }
            refund = recalcSale(refund)
            refund.payments = [
              {
                id: uid('pay'),
                method,
                amount: -refund.total,
                at: Date.now(),
                refunded: true,
              },
            ]
            result = refund

            // Restock refunded units.
            const products = d.products.map((p) => {
              const back = refundItems
                .filter((i) => i.productId === p.id)
                .reduce((s, i) => s + i.quantity, 0)
              return back > 0 ? withStockDelta(p, back) : p
            })

            const fullyRefunded = updatedOriginalItems.every(
              (i) => i.voided || i.refundedQty >= i.quantity,
            )
            const sales = d.sales.map((s) =>
              s.id === original.id
                ? {
                    ...s,
                    items: updatedOriginalItems,
                    status: fullyRefunded
                      ? ('refunded' as const)
                      : ('partial_refund' as const),
                  }
                : s,
            )

            let shift = d.shift
            if (shift && method === 'cash') {
              shift = {
                ...shift,
                drawer: [
                  ...shift.drawer,
                  {
                    id: uid('dt'),
                    type: 'refund' as DrawerTxnType,
                    amount: -refund.total,
                    note: `Refund of #${original.number}`,
                    by: d.currentCashierId,
                    at: Date.now(),
                  },
                ],
              }
            }

            let customers = d.customers
            if (method === 'store_credit' && refund.customerId) {
              customers = d.customers.map((c) =>
                c.id === refund.customerId
                  ? { ...c, storeCredit: c.storeCredit + refund.total }
                  : c,
              )
            }

            return {
              ...d,
              sales: [refund, ...sales],
              products,
              shift,
              customers,
            }
          },
          `Refund of ${originalId}`,
        )
        return result
      },

      createProduct: (p) => {
        const product: Product = {
          ...p,
          status: 'active',
          barcode: null,
          image_url: null,
          pricing: {
            currency: full.present.settings.currency,
            unit_price_cents: null,
          },
          id: p.id || uid('p'),
        }
        commit(
          'Add Product',
          (d) => ({ ...d, products: [product, ...d.products] }),
          `Created ${product.name}`,
        )
        return product
      },

      updateProduct: (p) =>
        commit(
          'Update Product',
          (d) => ({
            ...d,
            products: d.products.map((x) => (x.id === p.id ? p : x)),
          }),
          `Updated ${p.name}`,
        ),

      adjustStock: (productId, delta, reason) =>
        commit(
          'Adjust Stock',
          (d) => ({
            ...d,
            products: d.products.map((p) =>
              p.id === productId ? withStockDelta(p, delta) : p,
            ),
          }),
          `Stock ${delta} (${reason})`,
        ),

      openShift: (openingFloat, cashierId) =>
        commit(
          'Open Shift',
          (d) => {
            if (d.shift) return d
            const shift = {
              id: uid('shift'),
              cashierId: cashierId || d.currentCashierId,
              registerId: d.settings.registerId,
              openingFloat,
              status: 'open' as const,
              openedAt: Date.now(),
              drawer: [
                {
                  id: uid('dt'),
                  type: 'open' as DrawerTxnType,
                  amount: openingFloat,
                  note: 'Opening float',
                  by: cashierId || d.currentCashierId,
                  at: Date.now(),
                },
              ],
            }
            return {
              ...d,
              shift,
              currentCashierId: cashierId || d.currentCashierId,
            }
          },
          'Shift opened',
        ),

      closeShift: (countedClose) =>
        commit(
          'Close Shift',
          (d) => {
            if (!d.shift) return d
            const closed = {
              ...d.shift,
              countedClose,
              status: 'closed' as const,
              closedAt: Date.now(),
              drawer: [
                ...d.shift.drawer,
                {
                  id: uid('dt'),
                  type: 'close' as DrawerTxnType,
                  amount: 0,
                  note: 'Shift closed',
                  by: d.currentCashierId,
                  at: Date.now(),
                },
              ],
            }
            return {
              ...d,
              shift: null,
              shiftHistory: [closed, ...d.shiftHistory],
            }
          },
          'Shift closed',
        ),

      drawerTxn: (type, amount, note) =>
        commit(
          'Drawer Txn',
          (d) => {
            if (!d.shift) return d
            const signed =
              type === 'paid_out' || type === 'safe_drop'
                ? -Math.abs(amount)
                : Math.abs(amount)
            const drawer = [
              ...d.shift.drawer,
              {
                id: uid('dt'),
                type,
                amount: type === 'no_sale' ? 0 : signed,
                note,
                by: d.currentCashierId,
                at: Date.now(),
              },
            ]
            return { ...d, shift: { ...d.shift, drawer } }
          },
          'Drawer transaction',
        ),

      openDay: () =>
        commit(
          'Open Day',
          (d) => ({ ...d, dayOpen: true, dayStartedAt: Date.now() }),
          'Day opened',
        ),

      closeDay: () =>
        commit(
          'Close Day',
          (d) => {
            if (!d.dayOpen) return d
            const total = d.sales
              .filter((s) => s.status === 'completed')
              .reduce((s, x) => s + x.total, 0)
            return {
              ...d,
              dayOpen: false,
              dayClosedHistory: [
                {
                  openedAt: d.dayStartedAt || Date.now(),
                  closedAt: Date.now(),
                  total,
                },
                ...d.dayClosedHistory,
              ],
              dayStartedAt: null,
            }
          },
          'Day closed',
        ),

      fuelAuthorize: (pumpId, mode, grade, prepayAmount) =>
        commit(
          'Authorize Pump',
          (d) => {
            const pumps = d.pumps.map((p) =>
              p.id === pumpId
                ? {
                    ...p,
                    status: 'authorized' as const,
                    mode,
                    selectedGrade: grade,
                    prepayAmount,
                    authorizedAt: Date.now(),
                    claimed: false,
                  }
                : p,
            )
            return { ...d, pumps }
          },
          `Pump ${pumpId} authorized`,
        ),

      fuelStart: (pumpId) =>
        commit('Start Pump', (d) => ({
          ...d,
          pumps: d.pumps.map((p) =>
            p.id === pumpId ? { ...p, status: 'pumping' as const } : p,
          ),
        })),

      fuelPause: (pumpId) =>
        commit('Pause Pump', (d) => ({
          ...d,
          pumps: d.pumps.map((p) =>
            p.id === pumpId ? { ...p, status: 'paused' as const } : p,
          ),
        })),

      fuelResume: (pumpId) =>
        commit('Resume Pump', (d) => ({
          ...d,
          pumps: d.pumps.map((p) =>
            p.id === pumpId ? { ...p, status: 'pumping' as const } : p,
          ),
        })),

      fuelStop: (pumpId, gallons, amount) =>
        commit(
          'Stop Pump',
          (d) => ({
            ...d,
            pumps: d.pumps.map((p) =>
              p.id === pumpId
                ? {
                    ...p,
                    status: 'completed' as const,
                    gallons,
                    amount,
                    completedAt: Date.now(),
                  }
                : p,
            ),
          }),
          `Pump ${pumpId} stopped`,
        ),

      fuelLock: (pumpId, locked) =>
        commit(locked ? 'Lock Pump' : 'Unlock Pump', (d) => ({
          ...d,
          pumps: d.pumps.map((p) =>
            p.id === pumpId
              ? {
                  ...p,
                  status: locked ? ('locked' as const) : ('idle' as const),
                }
              : p,
          ),
        })),

      fuelSetPrice: (pumpId, gradeIndex, price) =>
        commit(
          'Set Fuel Price',
          (d) => ({
            ...d,
            pumps: d.pumps.map((p) =>
              p.id === pumpId
                ? {
                    ...p,
                    grades: p.grades.map((g, idx) =>
                      idx === gradeIndex ? { ...g, pricePerGallon: price } : g,
                    ),
                  }
                : p,
            ),
          }),
          'Fuel price changed',
        ),

      fuelClaim: (pumpId) =>
        commit(
          'Claim Fuel',
          (d0) => {
            const pump = d0.pumps.find((p) => p.id === pumpId)
            if (!pump || pump.amount <= 0) return d0
            const { d, sale } = ensureSale(d0)
            const grade = pump.grades[pump.selectedGrade]
            const item: SaleItem = {
              lineId: uid('ln'),
              productId: `fuel_${pumpId}`,
              name: `${pump.label} - ${grade?.name || 'Fuel'} (${pump.gallons.toFixed(3)} gal)`,
              unitPrice: pump.amount,
              quantity: 1,
              taxable: true,
              taxRate: d.settings.defaultTaxRate,
              department: 'Fuel',
              ebtEligible: false,
              ageRestriction: 0,
              ageVerified: false,
              voided: false,
              refundedQty: 0,
              isCustom: true,
              gross: 0,
              discountAmount: 0,
              net: 0,
              tax: 0,
            }
            const withItem = setSale(d, {
              ...sale,
              items: [...sale.items, item],
              fuelPumpId: pumpId,
            })
            const pumps = withItem.pumps.map((p) =>
              p.id === pumpId
                ? { ...p, saleId: withItem.sale!.id, claimed: false }
                : p,
            )
            return { ...withItem, pumps }
          },
          `Fuel from ${pumpId} claimed`,
        ),

      fuelDriveOff: (pumpId) =>
        commit(
          'Drive-Off',
          (d) => ({
            ...d,
            pumps: d.pumps.map((p) =>
              p.id === pumpId
                ? {
                    ...p,
                    status: 'idle' as const,
                    gallons: 0,
                    amount: 0,
                    saleId: undefined,
                    prepayAmount: undefined,
                  }
                : p,
            ),
          }),
          `Drive-off recorded on ${pumpId}`,
        ),

      fuelAddRest: (pumpId, amountCents) =>
        commit(
          'Rest In Gas',
          (d) => {
            const pump = d.pumps.find((p) => p.id === pumpId)
            if (!pump || amountCents <= 0) return d
            const price = pump.grades[pump.selectedGrade]?.pricePerGallon ?? 0
            const addedGallons = price > 0 ? amountCents / price : 0
            return {
              ...d,
              pumps: d.pumps.map((p) =>
                p.id === pumpId
                  ? {
                      ...p,
                      status:
                        p.status === 'idle'
                          ? ('authorized' as const)
                          : p.status,
                      mode: 'prepay' as const,
                      amount: p.amount + amountCents,
                      gallons: p.gallons + addedGallons,
                      prepayAmount: (p.prepayAmount ?? 0) + amountCents,
                      transactions: [
                        ...p.transactions,
                        {
                          timestamp: Date.now(),
                          type: 'rest_in_gas',
                          gallons: addedGallons,
                          amount: amountCents,
                        },
                      ],
                    }
                  : p,
              ),
            }
          },
          `Rest in gas added to ${pumpId}`,
        ),

      fuelTransfer: (pumpId, targetPumpId) =>
        commit(
          'Transfer Payment',
          (d) => {
            const source = d.pumps.find((p) => p.id === pumpId)
            const target = d.pumps.find((p) => p.id === targetPumpId)
            if (
              !source ||
              !target ||
              source.id === target.id ||
              source.amount <= 0
            )
              return d
            const movedAmount = source.amount
            const movedGallons = source.gallons
            const now = Date.now()
            return {
              ...d,
              pumps: d.pumps.map((p) => {
                if (p.id === source.id) {
                  return {
                    ...p,
                    amount: 0,
                    gallons: 0,
                    prepayAmount: undefined,
                    status: 'idle' as const,
                    transactions: [
                      ...p.transactions,
                      {
                        timestamp: now,
                        type: 'transfer_out',
                        gallons: -movedGallons,
                        amount: -movedAmount,
                        note: `to ${target.label}`,
                      },
                    ],
                  }
                }
                if (p.id === target.id) {
                  return {
                    ...p,
                    amount: p.amount + movedAmount,
                    gallons: p.gallons + movedGallons,
                    status:
                      p.status === 'idle' ? ('authorized' as const) : p.status,
                    mode: 'prepay' as const,
                    prepayAmount: (p.prepayAmount ?? 0) + movedAmount,
                    transactions: [
                      ...p.transactions,
                      {
                        timestamp: now,
                        type: 'transfer_in',
                        gallons: movedGallons,
                        amount: movedAmount,
                        note: `from ${source.label}`,
                      },
                    ],
                  }
                }
                return p
              }),
            }
          },
          `Transferred ${pumpId} → ${targetPumpId}`,
        ),

      fuelRefund: (pumpId, amountCents, reason) =>
        commit(
          'Fuel Refund',
          (d) => {
            const pump = d.pumps.find((p) => p.id === pumpId)
            if (!pump || amountCents <= 0) return d
            const refundAmount = Math.min(amountCents, pump.amount)
            const refundFraction =
              pump.amount > 0 ? refundAmount / pump.amount : 0
            const refundGallons = pump.gallons * refundFraction
            return {
              ...d,
              pumps: d.pumps.map((p) =>
                p.id === pumpId
                  ? {
                      ...p,
                      amount: p.amount - refundAmount,
                      gallons: p.gallons - refundGallons,
                      transactions: [
                        ...p.transactions,
                        {
                          timestamp: Date.now(),
                          type: 'refund',
                          gallons: -refundGallons,
                          amount: -refundAmount,
                          note: reason,
                        },
                      ],
                    }
                  : p,
              ),
            }
          },
          `Refund on ${pumpId}: ${reason}`,
        ),

      fuelAdjust: (pumpId, gallons, amountCents) =>
        commit(
          'Manual Adjust',
          (d) => ({
            ...d,
            pumps: d.pumps.map((p) =>
              p.id === pumpId
                ? {
                    ...p,
                    gallons,
                    amount: amountCents,
                    transactions: [
                      ...p.transactions,
                      {
                        timestamp: Date.now(),
                        type: 'manual_adjust',
                        gallons,
                        amount: amountCents,
                        note: 'manual override',
                      },
                    ],
                  }
                : p,
            ),
          }),
          `Manual adjust on ${pumpId}`,
        ),

      addPump: () =>
        commit(
          'Add Pump',
          (d) => {
            const n = d.pumps.length + 1
            const pump: FuelPump = {
              id: uid('pump'),
              label: `Pump ${n}`,
              status: 'idle',
              grades: [
                { name: 'Regular', pricePerGallon: 329 },
                { name: 'Plus', pricePerGallon: 359 },
                { name: 'Premium', pricePerGallon: 389 },
                { name: 'Diesel', pricePerGallon: 369 },
              ],
              selectedGrade: 0,
              mode: 'prepay',
              gallons: 0,
              amount: 0,
              claimed: false,
              transactions: [], // <-- FIXED: initialize empty transactions array
            }
            return { ...d, pumps: [...d.pumps, pump] }
          },
          'Pump added',
        ),

      createCustomer: (c) => {
        const customer: Customer = {
          ...c,
          id: uid('cust'),
          createdAt: Date.now(),
        }
        commit(
          'Add Customer',
          (d) => ({ ...d, customers: [customer, ...d.customers] }),
          `Customer ${customer.name}`,
        )
        return customer
      },

      updateSettings: (partial) =>
        commit('Update Settings', (d) => ({
          ...d,
          settings: { ...d.settings, ...partial },
        })),

      setCashier: (cashierId) =>
        commit('Switch Cashier', (d) => ({
          ...d,
          currentCashierId: cashierId,
        })),

      // ===== MISSING ACTIONS ADDED =====
      setProducts: (products: Product[]) =>
        commit('Set Products', (d) => ({ ...d, products })),
      setCategories: (categories: Category[]) =>
        commit('Set Categories', (d) => ({ ...d, categories })),

      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      reset: () => dispatch({ type: 'RESET' }),
    }
  }, [full.present])

  const value: POSContextValue = {
    state: full.present,
    canUndo: full.past.length > 0,
    canRedo: full.future.length > 0,
    lastLabel: full.lastLabel,
    actions,
    ready: hydrated,
  }

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>
}

export function usePOS(): POSContextValue {
  const ctx = useContext(POSContext)
  if (!ctx) throw new Error('usePOS must be used within POSProvider')
  return ctx
}

// Convenience selectors
export { ebtEligibleTotal } from './calc'