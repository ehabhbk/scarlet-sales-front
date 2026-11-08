import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  Clock,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { api } from '../../services/api'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { formatDate } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'

interface WarehouseRecord {
  id: number
  name: string
  code?: string | null
  type?: string | null
  address?: string | null
  phone?: string | null
  is_default: boolean
  is_active: boolean
  notes?: string | null
  products_count: number
  total_quantity: number
  stock_value: number
  expired_quantity: number
  near_expiry_quantity: number
}

interface StockRow {
  id: number
  name: string
  sku?: string | null
  barcode?: string | null
  image?: string | null
  category?: { id: number; name: string } | null
  sale_price: number
  cost_price: number
  track_inventory: boolean
  stock: number
  min_stock: number
  low_stock: boolean
  expired_quantity: number
  near_expiry_quantity: number
  nearest_expiry?: string | null
  batches_count: number
}

interface ProductOption {
  id: number
  name: string
  barcode?: string | null
  sku?: string | null
  track_inventory?: boolean
}

interface BatchRecord {
  id: number
  batch_number?: string | null
  quantity: number
  cost_price: number
  expiry_date?: string | null
  received_at?: string | null
  product?: { id: number; name: string }
  warehouse?: { id: number; name: string }
  supplier?: { id: number; name: string } | null
}

interface AlertSummary {
  expired_lots: number
  expired_quantity: number
  total_loss: number
  near_expiry_lots: number
  near_expiry_quantity: number
  low_stock_products: number
  total_alerts: number
}

interface AlertsResponse {
  summary: AlertSummary
  expired: Array<{
    id: number
    product_name?: string
    warehouse_name?: string
    batch_number?: string
    quantity: number
    loss: number
    expiry_date?: string
    days_overdue?: number
  }>
  near_expiry: Array<{
    id: number
    product_name?: string
    warehouse_name?: string
    batch_number?: string
    quantity: number
    value: number
    expiry_date?: string
    days_left?: number
  }>
  low_stock: Array<{
    id: number
    name: string
    stock: number
    threshold: number
    shortage: number
  }>
}

const EMPTY_WAREHOUSE = {
  name: '',
  code: '',
  type: 'store',
  address: '',
  phone: '',
  is_default: false,
  is_active: true,
  notes: '',
}

type WarehouseForm = typeof EMPTY_WAREHOUSE

const EMPTY_STOCK_IN = {
  warehouse_id: '',
  product_id: '',
  quantity: '',
  cost_price: '',
  expiry_date: '',
  batch_number: '',
  notes: '',
}

export default function WarehousesPage() {
  const { symbol } = useSettingsStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'warehouses' | 'stock'>('warehouses')
  const [manualWarehouseId, setManualWarehouseId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null)
  const [warehouseForm, setWarehouseForm] = useState<WarehouseForm>(EMPTY_WAREHOUSE)
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockInForm, setStockInForm] = useState({ ...EMPTY_STOCK_IN })
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    product_id: '',
    quantity: '',
    notes: '',
  })
  const [batchesProduct, setBatchesProduct] = useState<StockRow | null>(null)
  const [adjustForm, setAdjustForm] = useState<{ batch_id: string; quantity: string; notes: string }>({
    batch_id: '',
    quantity: '',
    notes: '',
  })

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses')
      return (res.data.warehouses || []) as WarehouseRecord[]
    },
  })

  const selectedWarehouseId =
    manualWarehouseId ?? (warehouses?.find((warehouse) => warehouse.is_default)?.id ?? warehouses?.[0]?.id ?? null)

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['warehouse-stock', selectedWarehouseId, search, lowStockOnly],
    queryFn: async () => {
      const res = await api.get('/warehouse-stock', {
        params: {
          warehouse_id: selectedWarehouseId || undefined,
          search: search || undefined,
          low_stock: lowStockOnly ? 1 : undefined,
          per_page: 100,
        },
      })
      return (res.data.data || []) as StockRow[]
    },
    enabled: tab === 'stock',
  })

  const { data: alerts } = useQuery({
    queryKey: ['product-alerts'],
    queryFn: async () => {
      const res = await api.get('/product-alerts')
      return res.data as AlertsResponse
    },
    refetchInterval: 60000,
  })

  const { data: products } = useQuery({
    queryKey: ['products-for-select'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { per_page: 200 } })
      return (res.data.data || []) as ProductOption[]
    },
  })

  const { data: batches, refetch: refetchBatches } = useQuery({
    queryKey: ['product-batches', selectedWarehouseId, batchesProduct?.id],
    queryFn: async () => {
      const res = await api.get('/product-batches', {
        params: {
          warehouse_id: selectedWarehouseId || undefined,
          product_id: batchesProduct?.id,
          in_stock: 1,
          per_page: 100,
        },
      })
      return (res.data.data || []) as BatchRecord[]
    },
    enabled: !!batchesProduct,
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] })
    queryClient.invalidateQueries({ queryKey: ['product-alerts'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const saveWarehouseMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: warehouseForm.name.trim(),
        code: warehouseForm.code.trim() || null,
        type: warehouseForm.type,
        address: warehouseForm.address.trim() || null,
        phone: warehouseForm.phone.trim() || null,
        is_default: warehouseForm.is_default,
        is_active: warehouseForm.is_active,
        notes: warehouseForm.notes.trim() || null,
      }
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, payload)
      } else {
        await api.post('/warehouses', payload)
      }
    },
    onSuccess: () => {
      toast.success(editingWarehouse ? 'تم تحديث المخزن' : 'تم إضافة المخزن')
      setWarehouseModalOpen(false)
      setEditingWarehouse(null)
      setWarehouseForm(EMPTY_WAREHOUSE)
      refreshAll()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حفظ المخزن')),
  })

  const deleteWarehouseMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/warehouses/${id}`)
    },
    onSuccess: () => {
      toast.success('تم حذف المخزن')
      refreshAll()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حذف المخزن')),
  })

  const stockInMutation = useMutation({
    mutationFn: async () => {
      await api.post('/warehouse-stock/in', {
        warehouse_id: Number(stockInForm.warehouse_id),
        product_id: Number(stockInForm.product_id),
        quantity: Number(stockInForm.quantity),
        cost_price: stockInForm.cost_price ? Number(stockInForm.cost_price) : undefined,
        expiry_date: stockInForm.expiry_date || undefined,
        batch_number: stockInForm.batch_number.trim() || undefined,
        notes: stockInForm.notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast.success('تم إدخال المخزون')
      setStockInOpen(false)
      setStockInForm({ ...EMPTY_STOCK_IN })
      refreshAll()
      void refetchBatches()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر إدخال المخزون')),
  })

  const transferMutation = useMutation({
    mutationFn: async () => {
      await api.post('/warehouse-stock/transfer', {
        from_warehouse_id: Number(transferForm.from_warehouse_id),
        to_warehouse_id: Number(transferForm.to_warehouse_id),
        product_id: Number(transferForm.product_id),
        quantity: Number(transferForm.quantity),
        notes: transferForm.notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast.success('تم تحويل المخزون')
      setTransferOpen(false)
      setTransferForm({ from_warehouse_id: '', to_warehouse_id: '', product_id: '', quantity: '', notes: '' })
      refreshAll()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر تحويل المخزون')),
  })

  const adjustMutation = useMutation({
    mutationFn: async () => {
      await api.post('/warehouse-stock/adjust', {
        batch_id: Number(adjustForm.batch_id),
        quantity: Number(adjustForm.quantity),
        notes: adjustForm.notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast.success('تم تعديل كمية الدفعة')
      setAdjustForm({ batch_id: '', quantity: '', notes: '' })
      refreshAll()
      void refetchBatches()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر تعديل الكمية')),
  })

  const openCreateWarehouse = () => {
    setEditingWarehouse(null)
    setWarehouseForm(EMPTY_WAREHOUSE)
    setWarehouseModalOpen(true)
  }

  const openEditWarehouse = (warehouse: WarehouseRecord) => {
    setEditingWarehouse(warehouse)
    setWarehouseForm({
      name: warehouse.name,
      code: warehouse.code || '',
      type: warehouse.type || 'store',
      address: warehouse.address || '',
      phone: warehouse.phone || '',
      is_default: warehouse.is_default,
      is_active: warehouse.is_active,
      notes: warehouse.notes || '',
    })
    setWarehouseModalOpen(true)
  }

  const openStockIn = (warehouseId?: number, productId?: number) => {
    setStockInForm({
      ...EMPTY_STOCK_IN,
      warehouse_id: String(warehouseId || selectedWarehouseId || ''),
      product_id: productId ? String(productId) : '',
    })
    setStockInOpen(true)
  }

  const openTransfer = (productId?: number) => {
    setTransferForm({
      from_warehouse_id: String(selectedWarehouseId || ''),
      to_warehouse_id: '',
      product_id: productId ? String(productId) : '',
      quantity: '',
      notes: '',
    })
    setTransferOpen(true)
  }

  const summary = alerts?.summary
  const totalStockValue = useMemo(
    () => (warehouses || []).reduce((sum, warehouse) => sum + Number(warehouse.stock_value || 0), 0),
    [warehouses]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المخازن والأرصدة</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            إدارة المخازن، إدخال البضاعة، التحويل بين المخازن ومتابعة تواريخ الصلاحية.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
          <Button onClick={openCreateWarehouse}>
            <Plus className="w-4 h-4" />
            إضافة مخزن
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<WarehouseIcon className="h-5 w-5" />}
          label="عدد المخازن"
          value={String(warehouses?.length || 0)}
          tone="blue"
        />
        <SummaryCard
          icon={<Boxes className="h-5 w-5" />}
          label="قيمة المخزون"
          value={formatMoney(totalStockValue, symbol)}
          tone="emerald"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="كمية منتهية الصلاحية"
          value={String(summary?.expired_quantity ?? 0)}
          hint={`خسائر: ${formatMoney(summary?.total_loss || 0, symbol)}`}
          tone="red"
        />
        <SummaryCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="قريبة الانتهاء"
          value={String(summary?.near_expiry_quantity ?? 0)}
          hint={`${summary?.low_stock_products || 0} منتج قارب على النفاد`}
          tone="amber"
        />
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <TabButton active={tab === 'warehouses'} onClick={() => setTab('warehouses')}>
          <WarehouseIcon className="h-4 w-4" />
          المخازن
        </TabButton>
        <TabButton active={tab === 'stock'} onClick={() => setTab('stock')}>
          <Package className="h-4 w-4" />
          الأرصدة والدفعات
        </TabButton>
      </div>

      {tab === 'warehouses' && (
        <div className="space-y-6">
          {warehousesLoading ? (
            <Card><p className="py-8 text-center text-sm text-gray-500">جارٍ تحميل المخازن...</p></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(warehouses || []).map((warehouse) => (
                <Card key={warehouse.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <WarehouseIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">{warehouse.name}</h3>
                          {warehouse.is_default && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              افتراضي
                            </span>
                          )}
                          {!warehouse.is_active && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
                              موقوف
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {warehouse.code || 'بدون رمز'} · {warehouse.type === 'pos' ? 'نقطة بيع' : 'مخزن'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEditWarehouse(warehouse)}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                        title="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`هل تريد حذف المخزن ${warehouse.name}؟`)) {
                            deleteWarehouseMutation.mutate(warehouse.id)
                          }
                        }}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat label="عدد المنتجات" value={String(warehouse.products_count)} />
                    <Stat label="إجمالي الكمية" value={String(warehouse.total_quantity)} />
                    <Stat label="قيمة المخزون" value={formatMoney(warehouse.stock_value, symbol)} />
                    <Stat label="منتهي الصلاحية" value={String(warehouse.expired_quantity)} danger={warehouse.expired_quantity > 0} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setManualWarehouseId(warehouse.id); openStockIn(warehouse.id) }}>
                      <PackagePlus className="h-4 w-4" />
                      إدخال مخزون
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setManualWarehouseId(warehouse.id); setTab('stock') }}>
                      <Package className="h-4 w-4" />
                      عرض الأرصدة
                    </Button>
                  </div>
                </Card>
              ))}
              {!warehouses?.length && (
                <Card className="md:col-span-2 xl:col-span-3">
                  <p className="py-8 text-center text-sm text-gray-500">لا توجد مخازن بعد. أضف أول مخزن للبدء.</p>
                </Card>
              )}
            </div>
          )}

          <AlertsPanel alerts={alerts} symbol={symbol} />
        </div>
      )}

      {tab === 'stock' && (
        <Card className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">المخزن</label>
                <select
                  value={selectedWarehouseId || ''}
                  onChange={(event) => setManualWarehouseId(Number(event.target.value) || null)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="">كل المخازن</option>
                  {(warehouses || []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <Input
                placeholder="بحث بالاسم أو الباركود..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(event) => setLowStockOnly(event.target.checked)}
                />
                نواقص فقط
              </label>
              <Button variant="secondary" onClick={() => openStockIn()}>
                <PackagePlus className="h-4 w-4" />
                إدخال مخزون
              </Button>
              <Button variant="secondary" onClick={() => openTransfer()}>
                <ArrowLeftRight className="h-4 w-4" />
                تحويل
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-start text-xs text-gray-500 dark:border-gray-700">
                  <th className="px-3 py-2 text-start">المنتج</th>
                  <th className="px-3 py-2 text-start">الباركود</th>
                  <th className="px-3 py-2 text-start">الرصيد</th>
                  <th className="px-3 py-2 text-start">حد التنبيه</th>
                  <th className="px-3 py-2 text-start">أقرب صلاحية</th>
                  <th className="px-3 py-2 text-start">منتهي</th>
                  <th className="px-3 py-2 text-start">قريب الانتهاء</th>
                  <th className="px-3 py-2 text-start">الدفعات</th>
                  <th className="px-3 py-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {stockLoading && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">جارٍ تحميل الأرصدة...</td></tr>
                )}
                {!stockLoading && !stockData?.length && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">لا توجد أرصدة مطابقة</td></tr>
                )}
                {(stockData || []).map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {row.image ? (
                          <img src={mediaUrl(row.image)} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-400 dark:bg-gray-800">
                            <Package className="h-4 w-4" />
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{row.name}</p>
                          <p className="text-xs text-gray-500">{row.category?.name || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">{row.barcode || row.sku || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-1 text-xs ${row.low_stock ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
                        {row.stock}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.min_stock}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.nearest_expiry ? formatDate(row.nearest_expiry) : '-'}</td>
                    <td className="px-3 py-2 text-red-600 dark:text-red-400">{row.expired_quantity || '-'}</td>
                    <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{row.near_expiry_quantity || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.batches_count}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openStockIn(selectedWarehouseId || undefined, row.id)}
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          title="إدخال مخزون"
                        >
                          <PackagePlus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openTransfer(row.id)}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                          title="تحويل بين المخازن"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchesProduct(row)}
                          className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40"
                          title="الدفعات"
                        >
                          <Boxes className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        title={editingWarehouse ? 'تعديل مخزن' : 'إضافة مخزن'}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!warehouseForm.name.trim()) {
              toast.error('أدخل اسم المخزن')
              return
            }
            saveWarehouseMutation.mutate()
          }}
        >
          <Input
            label="اسم المخزن"
            value={warehouseForm.name}
            onChange={(event) => setWarehouseForm({ ...warehouseForm, name: event.target.value })}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="الرمز"
              placeholder="MAIN"
              value={warehouseForm.code}
              onChange={(event) => setWarehouseForm({ ...warehouseForm, code: event.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">النوع</label>
              <select
                value={warehouseForm.type}
                onChange={(event) => setWarehouseForm({ ...warehouseForm, type: event.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="store">مخزن</option>
                <option value="pos">نقطة بيع</option>
              </select>
            </div>
            <Input
              label="الهاتف"
              value={warehouseForm.phone}
              onChange={(event) => setWarehouseForm({ ...warehouseForm, phone: event.target.value })}
            />
            <Input
              label="العنوان"
              value={warehouseForm.address}
              onChange={(event) => setWarehouseForm({ ...warehouseForm, address: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">ملاحظات</label>
            <textarea
              value={warehouseForm.notes}
              onChange={(event) => setWarehouseForm({ ...warehouseForm, notes: event.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={warehouseForm.is_default}
                onChange={(event) => setWarehouseForm({ ...warehouseForm, is_default: event.target.checked })}
              />
              المخزن الافتراضي
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={warehouseForm.is_active}
                onChange={(event) => setWarehouseForm({ ...warehouseForm, is_active: event.target.checked })}
              />
              مفعّل
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setWarehouseModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={saveWarehouseMutation.isPending}>حفظ</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={stockInOpen} onClose={() => setStockInOpen(false)} title="إدخال مخزون">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!stockInForm.warehouse_id || !stockInForm.product_id || Number(stockInForm.quantity) <= 0) {
              toast.error('اختر المخزن والمنتج وأدخل كمية أكبر من صفر')
              return
            }
            stockInMutation.mutate()
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium">المخزن</label>
            <select
              value={stockInForm.warehouse_id}
              onChange={(event) => setStockInForm({ ...stockInForm, warehouse_id: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              required
            >
              <option value="">اختر المخزن</option>
              {(warehouses || []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">المنتج</label>
            <select
              value={stockInForm.product_id}
              onChange={(event) => setStockInForm({ ...stockInForm, product_id: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              required
            >
              <option value="">اختر المنتج</option>
              {(products || []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}{product.barcode ? ` - ${product.barcode}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="الكمية"
              type="number"
              min={0.001}
              step="0.001"
              value={stockInForm.quantity}
              onChange={(event) => setStockInForm({ ...stockInForm, quantity: event.target.value })}
              required
            />
            <Input
              label="تكلفة الوحدة"
              type="number"
              min={0}
              step="0.01"
              value={stockInForm.cost_price}
              onChange={(event) => setStockInForm({ ...stockInForm, cost_price: event.target.value })}
            />
            <Input
              label="تاريخ الانتهاء"
              type="date"
              value={stockInForm.expiry_date}
              onChange={(event) => setStockInForm({ ...stockInForm, expiry_date: event.target.value })}
            />
            <Input
              label="رقم الدفعة"
              value={stockInForm.batch_number}
              onChange={(event) => setStockInForm({ ...stockInForm, batch_number: event.target.value })}
            />
          </div>
          <Input
            label="ملاحظات"
            value={stockInForm.notes}
            onChange={(event) => setStockInForm({ ...stockInForm, notes: event.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStockInOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={stockInMutation.isPending}>إدخال</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="تحويل بين المخازن">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!transferForm.from_warehouse_id || !transferForm.to_warehouse_id || !transferForm.product_id || Number(transferForm.quantity) <= 0) {
              toast.error('اختر المخازن والمنتج وأدخل كمية صحيحة')
              return
            }
            transferMutation.mutate()
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">من مخزن</label>
              <select
                value={transferForm.from_warehouse_id}
                onChange={(event) => setTransferForm({ ...transferForm, from_warehouse_id: event.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                required
              >
                <option value="">اختر المخزن</option>
                {(warehouses || []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">إلى مخزن</label>
              <select
                value={transferForm.to_warehouse_id}
                onChange={(event) => setTransferForm({ ...transferForm, to_warehouse_id: event.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                required
              >
                <option value="">اختر المخزن</option>
                {(warehouses || []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">المنتج</label>
            <select
              value={transferForm.product_id}
              onChange={(event) => setTransferForm({ ...transferForm, product_id: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              required
            >
              <option value="">اختر المنتج</option>
              {(products || []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}{product.barcode ? ` - ${product.barcode}` : ''}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="الكمية"
            type="number"
            min={0.001}
            step="0.001"
            value={transferForm.quantity}
            onChange={(event) => setTransferForm({ ...transferForm, quantity: event.target.value })}
            required
          />
          <Input
            label="ملاحظات"
            value={transferForm.notes}
            onChange={(event) => setTransferForm({ ...transferForm, notes: event.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTransferOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={transferMutation.isPending}>تحويل</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!batchesProduct}
        onClose={() => { setBatchesProduct(null); setAdjustForm({ batch_id: '', quantity: '', notes: '' }) }}
        title={`الدفعات: ${batchesProduct?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                  <th className="px-2 py-2 text-start">الدفعة</th>
                  <th className="px-2 py-2 text-start">المخزن</th>
                  <th className="px-2 py-2 text-start">الكمية</th>
                  <th className="px-2 py-2 text-start">التكلفة</th>
                  <th className="px-2 py-2 text-start">الانتهاء</th>
                  <th className="px-2 py-2 text-start">تعديل</th>
                </tr>
              </thead>
              <tbody>
                {!batches?.length && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-500">لا توجد دفعات متاحة</td></tr>
                )}
                {(batches || []).map((batch) => (
                  <tr key={batch.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-2">{batch.batch_number || `#${batch.id}`}</td>
                    <td className="px-2 py-2">{batch.warehouse?.name || '-'}</td>
                    <td className="px-2 py-2 font-semibold">{batch.quantity}</td>
                    <td className="px-2 py-2">{formatMoney(batch.cost_price, symbol)}</td>
                    <td className="px-2 py-2">{batch.expiry_date ? formatDate(batch.expiry_date) : '-'}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setAdjustForm({
                          batch_id: String(batch.id),
                          quantity: String(batch.quantity),
                          notes: '',
                        })}
                        className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        title="تسوية الكمية"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {adjustForm.batch_id && (
            <form
              className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
              onSubmit={(event) => {
                event.preventDefault()
                adjustMutation.mutate()
              }}
            >
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                تسوية كمية الدفعة #{adjustForm.batch_id}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="الكمية الصحيحة"
                  type="number"
                  min={0}
                  step="0.001"
                  value={adjustForm.quantity}
                  onChange={(event) => setAdjustForm({ ...adjustForm, quantity: event.target.value })}
                  required
                />
                <Input
                  label="سبب التسوية"
                  value={adjustForm.notes}
                  onChange={(event) => setAdjustForm({ ...adjustForm, notes: event.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setAdjustForm({ batch_id: '', quantity: '', notes: '' })}>
                  إلغاء
                </Button>
                <Button type="submit" loading={adjustMutation.isPending}>حفظ التسوية</Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone: 'blue' | 'emerald' | 'red' | 'amber'
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  }
  return (
    <Card className="flex items-center gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {hint && <p className="truncate text-[11px] text-gray-400">{hint}</p>}
      </div>
    </Card>
  )
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`font-semibold ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

function AlertsPanel({ alerts, symbol }: { alerts?: AlertsResponse; symbol: string }) {
  if (!alerts) return null
  const { expired, near_expiry, low_stock } = alerts
  if (!expired.length && !near_expiry.length && !low_stock.length) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-2 text-emerald-700 dark:text-emerald-300">
          <Package className="h-5 w-5" />
          <p className="text-sm font-medium">لا توجد تنبيهات حالياً. المخزون وتواريخ الصلاحية بحالة جيدة.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AlertList
        title="منتجات منتهية الصلاحية"
        tone="red"
        count={expired.length}
        rows={expired.map((row) => ({
          key: row.id,
          title: row.product_name || '-',
          subtitle: `${row.warehouse_name || '-'} · دفعة ${row.batch_number || row.id}`,
          value: `${row.quantity} · خسارة ${formatMoney(row.loss, symbol)}`,
          meta: row.expiry_date ? `انتهت في ${formatDate(row.expiry_date)} (${row.days_overdue} يوم)` : '',
        }))}
      />
      <AlertList
        title="قريبة من الانتهاء"
        tone="amber"
        count={near_expiry.length}
        rows={near_expiry.map((row) => ({
          key: row.id,
          title: row.product_name || '-',
          subtitle: `${row.warehouse_name || '-'} · دفعة ${row.batch_number || row.id}`,
          value: `${row.quantity} · قيمة ${formatMoney(row.value, symbol)}`,
          meta: row.expiry_date ? `تنتهي في ${formatDate(row.expiry_date)} (${row.days_left} يوم)` : '',
        }))}
      />
      <AlertList
        title="مخزون قارب على النفاد"
        tone="blue"
        count={low_stock.length}
        rows={low_stock.map((row) => ({
          key: row.id,
          title: row.name,
          subtitle: `الرصيد الحالي ${row.stock}`,
          value: `حد التنبيه ${row.threshold}`,
          meta: row.shortage > 0 ? `النقص ${row.shortage}` : '',
        }))}
      />
    </div>
  )
}

function AlertList({
  title,
  tone,
  count,
  rows,
}: {
  title: string
  tone: 'red' | 'amber' | 'blue'
  count: number
  rows: Array<{ key: number; title: string; subtitle: string; value: string; meta: string }>
}) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold dark:bg-gray-900/50">{count}</span>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {!rows.length && <p className="text-xs opacity-70">لا توجد عناصر</p>}
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg bg-white/70 p-2 text-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
            <p className="truncate text-sm font-medium">{row.title}</p>
            <p className="truncate text-[11px] opacity-80">{row.subtitle}</p>
            <p className="mt-1 text-xs font-semibold">{row.value}</p>
            {row.meta && <p className="text-[11px] opacity-70">{row.meta}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
