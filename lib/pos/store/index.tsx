'use client'

// Re‑export all public API from the store
export {
  POSProvider,
  usePOS,
  type POSActions,
  type POSContextValue,
} from './context'

// Re‑export all types
export type {
  PaymentMethod,
  Discount,
  SaleItem,
  Payment,
  SaleStatus,
  Sale,
  DrawerTxnType,
  DrawerTransaction,
  Shift,
  FuelGrade,
  FuelPumpStatus,
  FuelTxnType,
  FuelPumpTransaction,
  FuelPump,
  Customer,
  Employee,
  AuditEntry,
  ButtonKey,
  Settings,
  DomainState,
  Category,
  Product,
  TaxCategory,
  StoreCatalog,
  StoreIndex,
} from './types'

// Re‑export helpers (e.g., ebtEligibleTotal) from calc
export { ebtEligibleTotal } from '../calc'