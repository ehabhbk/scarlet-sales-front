export interface Role {
  id: number
  name: string
  guard_name: string
}

export interface User {
  id: number
  name: string
  username?: string
  email?: string
  phone?: string
  image?: string
  avatar?: string
  restaurant_id: number
  is_active: boolean
  permissions?: string[]
  pay_account_id?: number | null
  revenue_account_id?: number | null
  kitchen_station_id?: number | null
  kitchen_station?: {
    id: number
    name: string
  } | null
  pay_account?: {
    id: number
    code: string
    name: string
    type?: string
  }
  revenue_account?: {
    id: number
    code: string
    name: string
    type?: string
    parent_id?: number | null
  }
  roles: Role[]
  restaurant?: {
    id: number
    name: string
    slug: string
    currency: string
    symbol: string
    tax_rate: number
    logo?: string
  }
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Category {
  id: number
  name: string
  slug?: string
  color?: string
  is_active: boolean
  restaurant_id: number
}

export interface Product {
  id: number
  name: string
  sku?: string
  barcode?: string | null
  sale_price: number
  cost_price: number
  current_stock: number
  min_stock?: number
  sale_unit?: string | null
  purchase_unit?: string | null
  expiry_alert_days?: number
  low_stock_threshold?: number
  is_available: boolean
  category?: Category
  image?: string
}

export interface Order {
  id: number
  order_number: string
  status: string
  payment_status: string
  total_amount: number
  created_at: string
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface Warehouse {
  id: number
  restaurant_id?: number
  name: string
  code?: string | null
  type?: 'store' | 'warehouse' | 'both'
  allow_sales?: boolean
  pos_sale_source?: 'store' | 'warehouse' | 'both' | null
  address?: string | null
  phone?: string | null
  is_default: boolean
  is_active: boolean
  products_count?: number
  total_stock?: number
  total_value?: number
  created_at?: string
}

export interface ProductBatch {
  id: number
  product_id: number
  warehouse_id: number
  batch_number?: string | null
  quantity: number
  cost_price: number
  expiry_date?: string | null
  product?: Pick<Product, 'id' | 'name' | 'sku' | 'barcode' | 'image'>
  warehouse?: Pick<Warehouse, 'id' | 'name'>
  created_at?: string
}

export interface ProductAlertSettings {
  enable_expiry_alerts: boolean
  enable_near_expiry_alerts: boolean
  enable_low_stock_alerts: boolean
  near_expiry_days: number
  low_stock_threshold: number
}

export interface ExpiredBatchAlert {
  id: number
  product_id: number
  product_name?: string
  barcode?: string | null
  warehouse_id: number
  warehouse_name?: string
  batch_number?: string | null
  quantity: number
  cost_price: number
  loss: number
  expiry_date?: string | null
  days_overdue?: number | null
}

export interface NearExpiryBatchAlert {
  id: number
  product_id: number
  product_name?: string
  barcode?: string | null
  warehouse_id: number
  warehouse_name?: string
  batch_number?: string | null
  quantity: number
  cost_price: number
  value: number
  expiry_date?: string | null
  days_left?: number | null
}

export interface LowStockAlert {
  id: number
  name: string
  sku?: string | null
  barcode?: string | null
  image?: string | null
  stock: number
  min_stock: number
  threshold: number
  shortage: number
}

export interface ProductAlerts {
  settings: ProductAlertSettings
  summary: {
    expired_lots: number
    expired_quantity: number
    total_loss: number
    near_expiry_lots: number
    near_expiry_quantity: number
    low_stock_products: number
    total_alerts: number
  }
  expired: ExpiredBatchAlert[]
  near_expiry: NearExpiryBatchAlert[]
  low_stock: LowStockAlert[]
  generated_at: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
  meta?: PaginationMeta
}
