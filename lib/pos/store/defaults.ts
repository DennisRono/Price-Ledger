import type { Settings, DomainState } from './types'

export const STORAGE_KEY = 'v0_pos_state_v1'
export const MAX_HISTORY = 80

export function defaultSettings(): Settings {
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

export function fallbackDomain(): DomainState {
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
