import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { ArrowLeft, Search, Edit as PencilIcon, ArrowLeftRight, RefreshCw, Package, AlertTriangle, Clock } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import { formatNumber, formatDate } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'

interface WarehouseDetail {
  id: number
  name: string
  code?: string | null
  type: string
  allow_sales: boolean
  address?: string | null
  phone?: string | null
  is_default: boolean
  is_active: boolean
  products_count?: number
  total_quantity?: number
  stock_value?: number
  expired_quantity?: number
  near_expiry_quantity?: number
}

interface BatchProduct {
  id: number
  product_id: number
  warehouse_id: number
  batch_number?: string | null
  quantity: number
  cost_price: number
  expiry_date?: string | null
  product?: {
    id: number
    name: string
    sku?: string | null
    barcode?: string | null
    sale_price: number
    cost_price: number
    sale_unit?: string | null
    purchase_unit?: string | null
    min_stock?: number
    image?: string | null
    expiry_date?: string | null
  }
}

interface StockRequest {
  id: number
  from_warehouse_id: number
  to_warehouse_id: number
  product_id: number
  requested_quantity: number
  status: string
  created_at?: string
  requested_by?: number
  toWarehouse?: { id: number; name: string }
  product?: { id: number; name: string }
  requester?: { id: number; name: string }
}

interface StoreProduct {
  id: number
  name: string
  barcode?: string | null
  sale_price: number
  cost_price: number
  current_stock?: number
  total_stock?: number
  min_stock?: number
  near_expiry_quantity?: number
  low_stock?: boolean
}

export default function WarehouseDetailPage() {
  const { symbol } = useSettingsStore()
  const { id: warehouseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canManageStock = permissions.includes('manage_stock')
  const canRequestStock = permissions.includes('request_stock_for_store')

  const [showRequestsModal, setShowRequestsModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [requestForm, setRequestForm] = useState<{
    from_warehouse_id: number | string
    product_id: number | string
    quantity: number | string
    notes: string
  }>({
    from_warehouse_id: '',
    product_id: '',
    quantity: '',
    notes: '',
  })
  const [logDateFrom, setLogDateFrom] = useState('')
  const [logDateTo, setLogDateTo] = useState('')
  const [logProductId, setLogProductId] = useState('')

  const { data: allRequests } = useQuery({
    queryKey: ['stock-requests'],
    queryFn: async () => {
      const res = await api.get('/stock-requests')
      return (res.data.data || []) as StockRequest[]
    },
    enabled: !!warehouseId && canManageStock,
  })

  const warehouseRequests = useMemo(() => {
    if (!allRequests || !warehouseId) return []
    return allRequests.filter((r) => r.from_warehouse_id === Number(warehouseId))
  }, [allRequests, warehouseId])

  const filteredLogRequests = useMemo(() => {
    if (!warehouseRequests) return []
    return warehouseRequests.filter((r) => {
      if (logDateFrom && r.created_at && r.created_at.slice(0, 10) < logDateFrom) return false
      if (logDateTo && r.created_at && r.created_at.slice(0, 10) > logDateTo) return false
      if (logProductId && String(r.product_id) !== logProductId) return false
      return true
    })
  }, [warehouseRequests, logDateFrom, logDateTo, logProductId])

  const approveWarehouseRequest = useMutation({
    mutationFn: async (id: number) => api.post(`/stock-requests/${id}/approve`),
    onSuccess: () => {
      toast.success('تمت الموافقة على الطلب')
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر الموافقة على الطلب')),
  })

  const rejectWarehouseRequest = useMutation({
    mutationFn: async (id: number) => api.post(`/stock-requests/${id}/reject`),
    onSuccess: () => {
      toast.success('تم رفض الطلب')
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر رفض الطلب')),
  })

  const { data: warehousesForRequest } = useQuery({
    queryKey: ['warehouses-for-request'],
    queryFn: async () => {
      const res = await api.get('/warehouses?type=warehouse')
      return (res.data.warehouses || []) as WarehouseDetail[]
    },
    enabled: canRequestStock && !!warehouseId,
  })

  const { data: productsForRequest } = useQuery({
    queryKey: ['products-for-request'],
    queryFn: async () => {
      const res = await api.get('/products?per_page=1000')
      return (res.data.data || []) as StoreProduct[]
    },
    enabled: canRequestStock && !!warehouseId,
  })

  const { data: productsForLog } = useQuery({
    queryKey: ['products-for-log'],
    queryFn: async () => {
      const res = await api.get('/products?per_page=1000')
      return (res.data.data || []) as StoreProduct[]
    },
    enabled: canManageStock && !!warehouseId,
  })

  const createWarehouseRequestMutation = useMutation({
    mutationFn: async (data: {
      from_warehouse_id: number | string
      product_id: number | string
      quantity: number | string
      notes: string
    }) => {
      await api.post('/stock-requests', {
        from_warehouse_id: Number(data.from_warehouse_id),
        to_warehouse_id: Number(warehouseId),
        product_id: Number(data.product_id),
        quantity: Number(data.quantity),
        notes: data.notes || undefined,
      })
    },
    onSuccess: () => {
      toast.success('تم إرسال طلب المخزون')
      setShowRequestModal(false)
      setRequestForm({ from_warehouse_id: '', product_id: '', quantity: '', notes: '' })
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر إرسال الطلب')),
  })
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseDetail | null>(null)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchProduct | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [batchQuantity, setBatchQuantity] = useState('')
  const [batchBatchNumber, setBatchBatchNumber] = useState('')
  const [batchExpiryDate, setBatchExpiryDate] = useState('')
  const queryClient = useQueryClient()

  const { data: warehouse, isLoading: warehouseLoading } = useQuery({
    queryKey: ['warehouse-detail', warehouseId],
    queryFn: async () => {
      const res = await api.get(`/warehouses/${warehouseId}`)
      return res.data.warehouse as WarehouseDetail
    },
    enabled: !!warehouseId,
  })

  const { data: detailData } = useQuery({
    queryKey: ['warehouse-detail-batches', warehouseId],
    queryFn: async () => {
      const res = await api.get(`/warehouses/${warehouseId}`)
      return res.data.batches as BatchProduct[]
    },
    enabled: !!warehouseId,
  })

  const updateBatchMutation = useMutation({
    mutationFn: async (data: { id: number; quantity: number; batch_number?: string; expiry_date?: string }) => {
      await api.put(`/warehouses/${warehouseId}/batches/${data.id}`, data)
    },
    onSuccess: () => {
      toast.success('تم تعديل المنتج بنجاح')
      setShowBatchModal(false)
      setEditingBatch(null)
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail-batches', warehouseId] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر تعديل المنتج')),
  })

  const filteredProducts = useMemo(() => {
    if (!detailData) return []
    const term = productSearch.toLowerCase()
    return detailData.filter((batch) =>
      batch.product?.name.toLowerCase().includes(term) ||
      (batch.product?.barcode && batch.product.barcode.toLowerCase().includes(term)) ||
      (batch.product?.sku && batch.product.sku.toLowerCase().includes(term))
    )
  }, [detailData, productSearch])

  // Stats for this warehouse only
  const totalProducts = useMemo(() => {
    if (!detailData) return 0
    const uniqueProducts = new Set(detailData.map((b) => b.product_id))
    return uniqueProducts.size
  }, [detailData])

  const totalQuantity = useMemo(() => {
    return detailData?.reduce((sum, b) => sum + Number(b.quantity), 0) || 0
  }, [detailData])

  const stockValue = useMemo(() => {
    return detailData?.reduce((sum, b) => sum + Number(b.quantity) * Number(b.cost_price), 0) || 0
  }, [detailData])


  const lowStockCount = useMemo(() => {
    if (!detailData) return 0
    return detailData.filter((b) => {
      const min = Number(b.product?.min_stock ?? 0)
      return min > 0 && Number(b.quantity) <= min
    }).length
  }, [detailData])

  if (warehouseLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-gray-500">جارٍ التحميل...</p>
      </div>
    )
  }

  if (!warehouse) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-red-500">المخزن غير موجود</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/warehouses')}
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{warehouse.name}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {warehouse.type === 'store' ? 'متجر' : warehouse.type === 'warehouse' ? 'مخزن' : 'كلاهما'} · {warehouse.code || '-'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* في صفحة المتجر: إظهار زر "طلب من المخزن" فقط */}
          {warehouse?.type === 'store' && canRequestStock && (
            <Button onClick={() => setShowRequestModal(true)}>
              <ArrowLeftRight className="w-4 h-4" />
              طلب من المخزن
            </Button>
          )}
          {/* في صفحة المخزن: إظهار زر "سجل الطلبات" فقط */}
          {warehouse?.type !== 'store' && canManageStock && (
            <Button onClick={() => {
              setLogDateFrom('')
              setLogDateTo('')
              setLogProductId('')
              setShowLogModal(true)
            }}>
              <RefreshCw className="w-4 h-4" />
              سجل الطلبات
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar for this warehouse */}
      <Card className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="إجمالي المنتجات" value={formatNumber(totalProducts)} icon={<Package className="h-5 w-5" />} tone="emerald" />
          <StatCard label="إجمالي الكمية" value={formatNumber(totalQuantity)} icon={<Package className="h-5 w-5" />} tone="emerald" />
          <StatCard label="قيمة المخزون" value={formatMoney(stockValue, symbol)} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="منتهية الصلاحية" value={formatNumber(warehouse?.expired_quantity ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
          <StatCard label="قريب الانتهاء" value={formatNumber(warehouse?.near_expiry_quantity ?? 0)} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="قريب النفاذ" value={formatNumber(lowStockCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        </div>
      </Card>

      {/* Products Table */}
      <Card className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">المنتجات في {warehouse.name}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              قائمة المنتجات المخزنة في هذا الموقع مع تواريخ الصلاحية والتنبيهات.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الباركود..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pe-10 ps-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-start">المنتج</th>
                <th className="px-3 py-2 text-start">الباركود / SKU</th>
                <th className="px-3 py-2 text-start">رقم الدفعة</th>
                <th className="px-3 py-2 text-start">الكمية</th>
                <th className="px-3 py-2 text-start">تكلفة الوحدة</th>
                <th className="px-3 py-2 text-start">تاريخ الصلاحية</th>
                <th className="px-3 py-2 text-start">الحالة</th>
                <th className="px-3 py-2 text-start">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">لا توجد منتجات في هذا المخزن</td></tr>
              ) : (
                filteredProducts.map((batch) => (
                  <tr key={batch.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 font-medium">{batch.product?.name || 'منتج'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {batch.product?.barcode || batch.product?.sku || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{batch.batch_number || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${Number(batch.quantity) <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {formatNumber(Number(batch.quantity))}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatMoney(Number(batch.cost_price), symbol)}</td>
                    <td className="px-3 py-2">
                      {batch.product?.expiry_date ? (
                        <span className={`text-xs ${new Date(batch.product.expiry_date) < new Date() ? 'text-red-600 font-bold' : 'text-amber-600'}`}>
                          {formatDate(batch.product.expiry_date)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          batch.product?.expiry_date && new Date(batch.product.expiry_date) < new Date()
                            ? 'danger'
                            : batch.product?.expiry_date && Number(batch.quantity) <= Number(batch.product?.min_stock ?? 0)
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {batch.product?.expiry_date && new Date(batch.product.expiry_date) < new Date()
                          ? 'منتهية'
                          : batch.product?.expiry_date && Number(batch.quantity) <= Number(batch.product?.min_stock ?? 0)
                          ? 'قريب النفاذ'
                          : 'متوفر'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingBatch(batch)
                          setBatchQuantity(String(batch.quantity))
                          setBatchBatchNumber(batch.batch_number || '')
                          setBatchExpiryDate(batch.product?.expiry_date || '')
                          setShowBatchModal(true)
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded" title="تعديل المنتج"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Warehouse Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingWarehouse(null) }}
        title={editingWarehouse ? 'تعديل مخزن' : 'إضافة مخزن'}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <Input
            label="اسم المخزن"
            value={editingWarehouse?.name || ''}
            onChange={() => { }}
            required
          />
          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditingWarehouse(null) }}>إلغاء</Button>
            <Button type="submit" disabled>حفظ</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => { setShowBatchModal(false); setEditingBatch(null) }}
        title={editingBatch ? 'تعديل منتج' : 'إضافة منتج'}
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!editingBatch) return
            updateBatchMutation.mutate({
              id: editingBatch.id,
              quantity: Number(batchQuantity),
              batch_number: batchBatchNumber || undefined,
              expiry_date: batchExpiryDate || undefined,
            })
          }}
        >
          <Input
            label="اسم المنتج"
            value={editingBatch?.product?.name || ''}
            readOnly
          />
          <Input
            label="الكمية"
            type="number"
            min={0}
            step="0.001"
            value={batchQuantity}
            onChange={(e) => setBatchQuantity(e.target.value)}
            required
          />
          <Input
            label="رقم الدفعة"
            value={batchBatchNumber}
            onChange={(e) => setBatchBatchNumber(e.target.value)}
          />
          <Input
            label="تاريخ الصلاحية"
            type="date"
            value={batchExpiryDate}
            onChange={(e) => setBatchExpiryDate(e.target.value)}
          />
          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => { setShowBatchModal(false); setEditingBatch(null) }}>إلغاء</Button>
            <Button type="submit" loading={updateBatchMutation.isPending}>حفظ التعديل</Button>
          </div>
        </form>
      </Modal>

      {/* Warehouse Requests Modal */}
      <Modal
        isOpen={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        title={`طلبات مخزن ${warehouse?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">طلبات صادرة من هذا المخزن</h3>
            <Badge variant="info">{warehouseRequests.length} طلب</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-start">المتجر المطلوب له</th>
                  <th className="px-3 py-2 text-start">المنتج</th>
                  <th className="px-3 py-2 text-start">الكمية</th>
                  <th className="px-3 py-2 text-start">مقدم الطلب</th>
                  <th className="px-3 py-2 text-start">الحالة</th>
                  <th className="px-3 py-2 text-start">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {warehouseRequests.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">لا توجد طلبات صادرة من هذا المخزن</td></tr>
                ) : (
                  warehouseRequests.map((req) => (
                    <tr key={req.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{req.toWarehouse?.name || req.to_warehouse_id}</td>
                      <td className="px-3 py-2">{req.product?.name || req.product_id}</td>
                      <td className="px-3 py-2">{formatNumber(req.requested_quantity)}</td>
                      <td className="px-3 py-2">{req.requester?.name || '-'}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'default'}
                        >
                          {req.status === 'pending' ? 'معلق' : req.status === 'approved' ? 'معتمد' : req.status === 'rejected' ? 'مرفوض' : req.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {req.status === 'pending' && (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => { setShowRequestsModal(false); approveWarehouseRequest.mutate(req.id) }}
                            >
                              قبول
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => { setShowRequestsModal(false); rejectWarehouseRequest.mutate(req.id) }}
                            >
                              رفض
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Store Request Modal (طلب من المخزن للمتجر) */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title={`طلب منتجات من المخزن - ${warehouse?.name || ''}`}
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            createWarehouseRequestMutation.mutate(requestForm)
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">المخزن المصدر</label>
              <select
                value={requestForm.from_warehouse_id}
                onChange={(e) => setRequestForm({ ...requestForm, from_warehouse_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
                required
              >
                <option value="">اختر مخزناً</option>
                {(warehousesForRequest || []).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">المنتج</label>
              <select
                value={requestForm.product_id}
                onChange={(e) => setRequestForm({ ...requestForm, product_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
                required
              >
                <option value="">اختر منتجاً</option>
                {(productsForRequest || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">الكمية</label>
              <Input type="number" min={0.001} step="0.001" value={requestForm.quantity} onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })} />
            </div>
            <div className="col-span-1">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</label>
              <Input value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowRequestModal(false)}>إلغاء</Button>
            <Button type="submit" loading={createWarehouseRequestMutation.isPending}>إرسال الطلب</Button>
          </div>
        </form>
      </Modal>

      {/* Requests Log Modal (سجل الطلبات للمخزن) */}
      <Modal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title={`سجل طلبات مخزن ${warehouse?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">من تاريخ</label>
              <input
                type="date"
                value={logDateFrom}
                onChange={(e) => setLogDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">إلى تاريخ</label>
              <input
                type="date"
                value={logDateTo}
                onChange={(e) => setLogDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">المنتج</label>
              <select
                value={logProductId}
                onChange={(e) => setLogProductId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
              >
                <option value="">جميع المنتجات</option>
                {(productsForLog || []).map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-start">التاريخ</th>
                  <th className="px-3 py-2 text-start">المنتج</th>
                  <th className="px-3 py-2 text-start">الكمية المطلوبة</th>
                  <th className="px-3 py-2 text-start">إلى المتجر</th>
                  <th className="px-3 py-2 text-start">مقدم الطلب</th>
                  <th className="px-3 py-2 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogRequests.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">لا توجد طلبات في هذا السجل</td></tr>
                ) : (
                  filteredLogRequests.map((req) => (
                    <tr key={req.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{req.created_at ? req.created_at.slice(0, 16).replace('T', ' ') : '-'}</td>
                      <td className="px-3 py-2">{req.product?.name || req.product_id}</td>
                      <td className="px-3 py-2">{formatNumber(req.requested_quantity)}</td>
                      <td className="px-3 py-2">{req.toWarehouse?.name || req.to_warehouse_id}</td>
                      <td className="px-3 py-2">{req.requester?.name || '-'}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'default'}
                        >
                          {req.status === 'pending' ? 'معلق' : req.status === 'approved' ? 'معتمد' : req.status === 'rejected' ? 'مرفوض' : req.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300',
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}
