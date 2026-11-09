import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { ArrowLeft, Search, Edit as PencilIcon, Trash2, ArrowLeftRight, Package, AlertTriangle, Clock } from 'lucide-react'
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

export default function WarehouseDetailPage() {
  const { symbol } = useSettingsStore()
  const { id: warehouseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canEditWarehouses = permissions.includes('edit_warehouses')
  const canDeleteWarehouses = permissions.includes('delete_warehouses')
  const canManageStock = permissions.includes('manage_stock')

  const [showModal, setShowModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseDetail | null>(null)
  const [productSearch, setProductSearch] = useState('')
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

  const deleteWarehouseMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/warehouses/${warehouseId}`)
    },
    onSuccess: () => {
      toast.success('تم حذف المخزن')
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      navigate('/warehouses')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حذف المخزن')),
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
          {canEditWarehouses && (
            <Button onClick={() => { setEditingWarehouse(warehouse); setShowModal(true) }}>
              <PencilIcon className="w-4 h-4" />
              تعديل
            </Button>
          )}
          {canDeleteWarehouses && (
            <Button variant="danger" onClick={() => deleteWarehouseMutation.mutate()}>
              <Trash2 className="w-4 h-4" />
              حذف
            </Button>
          )}
          {canManageStock && (
            <Button onClick={() => navigate('/warehouses')}>
              <ArrowLeftRight className="w-4 h-4" />
              نقل مخزون
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
                        <span className={`text-xs ${new Date(batch.product.expiry_date) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
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
