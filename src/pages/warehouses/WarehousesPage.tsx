import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { Plus, Search, Edit as PencilIcon, Trash2, ArrowLeftRight, Warehouse, Package, AlertTriangle, Clock } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import { formatNumber } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'
import { useNavigate } from 'react-router-dom'

interface WarehouseRecord {
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

interface StockRequestForm {
  from_warehouse_id: number | string
  to_warehouse_id: number | string
  product_id: number | string
  quantity: number | string
  notes: string
}

interface RequestRecord {
  id: number
  from_warehouse_id: number
  to_warehouse_id: number
  product_id: number
  requested_quantity: number
  approved_quantity?: number | null
  status: string
  requested_by?: number
  approved_by?: number
  received_by?: number
  notes?: string | null
  fromWarehouse?: { id: number; name: string }
  toWarehouse?: { id: number; name: string }
  product?: { id: number; name: string; barcode?: string | null }
  requester?: { id: number; name: string }
  approver?: { id: number; name: string }
  receiver?: { id: number; name: string }
}

interface ProductRecord {
  id: number
  name: string
  sku?: string | null
  barcode?: string | null
  sale_price: number
  cost_price: number
  current_stock?: number
  min_stock?: number
  sale_unit?: string | null
  purchase_unit?: string | null
  total_stock?: number
  nearest_expiry?: string | null
  is_available: boolean
  image?: string | null
  low_stock?: boolean
  expired_quantity?: number
  near_expiry_quantity?: number
}

export default function WarehousesPage() {
  const { symbol } = useSettingsStore()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canViewWarehouses = permissions.includes('view_warehouses')
  const canCreateWarehouses = permissions.includes('create_warehouses')
  const canEditWarehouses = permissions.includes('edit_warehouses')
  const canDeleteWarehouses = permissions.includes('delete_warehouses')
  const canManageStock = permissions.includes('manage_stock')

  const [tab, setTab] = useState<'warehouses' | 'requests'>('warehouses')
  const [showModal, setShowModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null)
  const [requestingWarehouse, setRequestingWarehouse] = useState<WarehouseRecord | null>(null)
  const [requestForm, setRequestForm] = useState<StockRequestForm>({
    from_warehouse_id: '',
    to_warehouse_id: '',
    product_id: '',
    quantity: '',
    notes: '',
  })
  const [warehouseSearch, setWarehouseSearch] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses?type=warehouse')
      return (res.data.warehouses || []) as WarehouseRecord[]
    },
    enabled: canViewWarehouses,
  })

  const { data: allWarehouses } = useQuery({
    queryKey: ['all-warehouses-for-request'],
    queryFn: async () => {
      const res = await api.get('/warehouses?type=warehouse')
      return (res.data.warehouses || []) as WarehouseRecord[]
    },
    enabled: canManageStock,
  })

  const { data: products } = useQuery({
    queryKey: ['warehouse-products'],
    queryFn: async () => {
      const res = await api.get('/products?per_page=1000')
      return (res.data.data || []) as ProductRecord[]
    },
  })

  const { data: requests, refetch: refetchRequests } = useQuery({
    queryKey: ['warehouse-stock-requests'],
    queryFn: async () => {
      const res = await api.get('/stock-requests')
      return (res.data.data || []) as RequestRecord[]
    },
    enabled: tab === 'requests',
  })

  // Stats
  const totalWarehouses = useMemo(() => warehouses?.length || 0, [warehouses])
  const totalProducts = useMemo(() => {
    if (!products) return 0
    return products.length
  }, [products])
  const totalQuantity = useMemo(() => {
    return products?.reduce((sum, p) => sum + Number(p.total_stock ?? p.current_stock ?? 0), 0) || 0
  }, [products])
  const stockValue = useMemo(() => {
    return products?.reduce((sum, p) => sum + Number(p.total_stock ?? p.current_stock ?? 0) * Number(p.cost_price), 0) || 0
  }, [products])
  const nearExpiryCount = useMemo(() => {
    return products?.filter((p) => (p.near_expiry_quantity || 0) > 0).length || 0
  }, [products])
  const lowStockCount = useMemo(() => {
    return products?.filter((p) => (p.low_stock || false)).length || 0
  }, [products])

  const filteredWarehouses = useMemo(() => {
    if (!warehouses) return []
    return warehouses.filter((w) => w.name.toLowerCase().includes(warehouseSearch.toLowerCase()))
  }, [warehouses, warehouseSearch])


  const saveWarehouseMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: editingWarehouse?.name || '',
        code: '',
        type: 'warehouse',
        allow_sales: true,
        address: '',
        phone: '',
        is_default: false,
        is_active: true,
        notes: '',
      }
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, payload)
      } else {
        await api.post('/warehouses', payload)
      }
    },
    onSuccess: () => {
      toast.success('تم حفظ المخزن')
      setShowModal(false)
      setEditingWarehouse(null)
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      queryClient.invalidateQueries({ queryKey: ['all-warehouses-for-request'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حفظ المخزن')),
  })

  const createRequestMutation = useMutation({
    mutationFn: async (data: StockRequestForm) => {
      await api.post('/stock-requests', {
        from_warehouse_id: Number(data.from_warehouse_id),
        to_warehouse_id: Number(data.to_warehouse_id),
        product_id: Number(data.product_id),
        quantity: Number(data.quantity),
        notes: data.notes || undefined,
      })
    },
    onSuccess: () => {
      toast.success('تم إرسال طلب المخزون')
      setShowRequestModal(false)
      setRequestForm({ from_warehouse_id: '', to_warehouse_id: '', product_id: '', quantity: '', notes: '' })
      refetchRequests()
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر إرسال الطلب')),
  })

  const approveRequestMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/stock-requests/${id}/approve`),
    onSuccess: () => {
      toast.success('تمت الموافقة على الطلب')
      refetchRequests()
    },
  })

  const receiveRequestMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/stock-requests/${id}/receive`),
    onSuccess: () => {
      toast.success('تم استلام الكمية وترحيلها إلى المخزن')
      refetchRequests()
    },
  })

  const deleteWarehouseMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/warehouses/${id}`),
    onSuccess: () => {
      toast.success('تم حذف المخزن')
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حذف المخزن')),
  })

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المخازن</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              إدارة المخازن والمستودعات وطلب المنتجات بين المخازن بناءً على الصلاحيات الممنوحة.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateWarehouses && <Button onClick={() => { setEditingWarehouse(null); setShowModal(true) }}><Plus className="w-4 h-4" /> إضافة مخزن</Button>}
            {canManageStock && <Button onClick={() => { setRequestingWarehouse(null); setShowRequestModal(true) }}>طلب من المخزن</Button>}
            {canViewWarehouses && tab === 'warehouses' && <Button onClick={() => setTab('requests')}>طلبات المخزون</Button>}
            {tab === 'requests' && <Button onClick={() => setTab('warehouses')}>إدارة المخازن</Button>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="إجمالي المخازن" value={formatNumber(totalWarehouses)} icon={<Warehouse className="h-5 w-5" />} tone="blue" />
          <StatCard label="إجمالي المنتجات" value={formatNumber(totalProducts)} icon={<Package className="h-5 w-5" />} tone="emerald" />
          <StatCard label="إجمالي الكمية" value={formatNumber(totalQuantity)} icon={<Package className="h-5 w-5" />} tone="emerald" />
          <StatCard label="قيمة المخزون" value={formatMoney(stockValue, symbol)} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="قريب الانتهاء" value={formatNumber(nearExpiryCount)} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="قريب النفاذ" value={formatNumber(lowStockCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        </div>
      </Card>

      {tab === 'warehouses' && canViewWarehouses && (
        <Card className="space-y-6">
          {/* Warehouse Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="بحث عن مخزن..."
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pe-10 ps-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Warehouses Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {warehousesLoading ? (
              <div className="col-span-full py-12 text-center">
                <p className="text-sm text-gray-500">جارٍ تحميل المخازن...</p>
              </div>
            ) : (
              <>
                {filteredWarehouses.length === 0 && (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-sm text-gray-500">لا توجد مخازن</p>
                  </div>
                )}
                {filteredWarehouses.map((warehouse) => (
                  <WarehouseCard
                    key={warehouse.id}
                    warehouse={warehouse}
                    onEdit={() => { setEditingWarehouse(warehouse); setShowModal(true) }}
                    onDelete={() => deleteWarehouseMutation.mutate(warehouse.id)}
                    onRequest={() => { setRequestingWarehouse(warehouse); setShowRequestModal(true) }}
                    onView={() => navigate(`/warehouses/${warehouse.id}`)}
                    canEdit={canEditWarehouses}
                    canDelete={canDeleteWarehouses}
                    canRequest={canManageStock}
                  />
                ))}
              </>
            )}
          </div>
        </Card>
      )}

      {tab === 'requests' && (
        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">طلبات المخزون</h2>
            <Badge variant="info">{requests?.length || 0} طلب</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-start">المنتج</th>
                  <th className="px-3 py-2 text-start">من المخزن</th>
                  <th className="px-3 py-2 text-start">إلى المخزن</th>
                  <th className="px-3 py-2 text-start">الكمية المطلوبة</th>
                  <th className="px-3 py-2 text-start">الحالة</th>
                  <th className="px-3 py-2 text-start">مقدم الطلب</th>
                  <th className="px-3 py-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(requests || []).map((req) => (
                  <tr key={req.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{req.product?.name || req.product_id}</td>
                    <td className="px-3 py-2">{req.fromWarehouse?.name || req.from_warehouse_id}</td>
                    <td className="px-3 py-2">{req.toWarehouse?.name || req.to_warehouse_id}</td>
                    <td className="px-3 py-2">{formatNumber(req.requested_quantity)}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : req.status === 'completed' ? 'info' : 'danger'}
                      >
                        {req.status === 'pending' ? 'معلق' : req.status === 'approved' ? 'معتمد' : req.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{req.requester?.name || '-'}</td>
                    <td className="px-3 py-2">
                      {req.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="success" onClick={() => approveRequestMutation.mutate(req.id)}>موافقة</Button>
                        </div>
                      )}
                      {req.status === 'approved' && (
                        <Button size="sm" variant="primary" onClick={() => receiveRequestMutation.mutate(req.id)}>استلام</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!requests?.length && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">لا توجد طلبات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Warehouse Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingWarehouse(null) }}
        title={editingWarehouse ? 'تعديل مخزن' : 'إضافة مخزن'}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            saveWarehouseMutation.mutate()
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
            <Button type="submit" loading={saveWarehouseMutation.isPending}>حفظ</Button>
          </div>
        </form>
      </Modal>

      {/* Request from Warehouse Modal */}
      <Modal
        isOpen={showRequestModal && requestingWarehouse !== null}
        onClose={() => setShowRequestModal(false)}
        title={`طلب منتجات من المخزن - ${requestingWarehouse?.name || ''}`}
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            createRequestMutation.mutate(requestForm)
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
                {(allWarehouses || []).map((w) => (
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
                {(products || []).map((p) => (
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
            <Button type="submit" loading={createRequestMutation.isPending}>إرسال الطلب</Button>
          </div>
        </form>
      </Modal>

      {/* Warehouse Detail Modal */}
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

function WarehouseCard({ warehouse, onEdit, onDelete, onRequest, onView, canEdit, canDelete, canRequest }: {
  warehouse: WarehouseRecord
  onEdit: () => void
  onDelete: () => void
  onRequest: () => void
  onView: () => void
  canEdit: boolean
  canDelete: boolean
  canRequest: boolean
}) {
  return (
    <div className="p-4 hover:shadow-md transition-shadow cursor-pointer group" onClick={onView}>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{warehouse.name}</h3>
          <Badge variant={warehouse.type === 'store' ? 'success' : warehouse.type === 'warehouse' ? 'info' : 'default'}>
            {warehouse.type === 'store' ? 'متجر' : warehouse.type === 'warehouse' ? 'مخزن' : 'كلاهما'}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          المنتجات: {warehouse.products_count ?? 0} · المخزون: {formatNumber(warehouse.total_quantity ?? 0)}
        </p>
        <div className="flex justify-end gap-2">
          {canEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit() }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded" title="تعديل">
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {canRequest && (
            <button onClick={(e) => { e.stopPropagation(); onRequest() }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded" title="طلب من المخزن">
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded" title="حذف">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
