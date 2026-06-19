export type Category = {
  id: string
  name: string
  parentId: string | null
}

export type TaxCategory = {
  id: string
  label: string
  notes?: string
}

export type Product = {
  id: string
  sku?: string
  barcode: string | null
  barcode_status?: string
  group_key?: string
  name: string
  receipt_name?: string
  description?: string
  brand?: string
  manufacturer?: string
  category?: string
  subcategory?: string
  tags?: string[]
  size?: {
    value: number | null
    unit: string | null
  }
  container?: string
  packaging?: {
    type: string
    units_per_pack: number
  }
  image_url: string | null
  pricing: {
    currency: string
    unit_price_cents: number | null
    price_status?: string
    last_updated?: string
  }
  promotions?: unknown[]
  tax?: {
    taxable: boolean
    tax_category?: string
  }
  compliance?: {
    age_restricted?: boolean
    minimum_age?: number | null
    requires_id_verification?: boolean
  }
  inventory?: {
    track_inventory?: boolean
    quantity_on_hand?: number | null
    reorder_point?: number | null
    unit_of_measure?: string
  }
  flags?: Record<string, boolean>
  status?: string
  metadata?: {
    source?: string
    date_added?: string
    last_modified?: string
    needs_review?: boolean
    review_note?: string | null
  }
}

export type StoreCatalog = {
  store: string
  generated?: string
  schema_version?: string
  categories: Category[]
  tax_categories?: TaxCategory[]
  products: Product[]
}

export type StoreMeta = {
  id: string
  name: string
  createdAt: string
  productCount: number
}

export type StoreIndex = {
  stores: StoreMeta[]
}
