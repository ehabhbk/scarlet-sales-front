import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { Plus, Search, Edit as PencilIcon, Trash2, Warehouse, Package, AlertTriangle, Clock } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import { formatNumber } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'
import { useNavigate } from 'react-router-dom'

interface StoreRecord {
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

export default function StoresPage() {
  const { symbol } = useSettingsStore()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canViewStores = permissions.includes('view_stores')
  const canCreateStores = permissions.includes('create_stores')
  const canEditStores = permissions.includes('edit_stores')
  const canDeleteStores = permissions.includes('delete_stores')

  const [showModal, setShowModal] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null)
  const [storeName, setStoreName] = useState('')
  const [storeSearch, setStoreSearch] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const res = await api.get('/warehouses?type=store')
      return (res.data.warehouses || []) as StoreRecord[]
    },
    enabled: canViewStores,
  })

  // إحصائيات فقط للمنتجات الموجودة في المتاجر (وليس المخازن)
  const totalStores = useMemo(() => stores?.length || 0, [stores])
  const totalProducts = useMemo(() => {
    return stores?.reduce((sum, s) => sum + Number(s.products_count ?? 0), 0) || 0
  }, [stores])
  const totalQuantity = useMemo(() => {
    return stores?.reduce((sum, s) => sum + Number(s.total_quantity ?? 0), 0) || 0
  }, [stores])
  const stockValue = useMemo(() => {
    return stores?.reduce((sum, s) => sum + Number(s.stock_value ?? 0), 0) || 0
  }, [stores])
  const nearExpiryCount = useMemo(() => {
    return stores?.filter((s) => (s.near_expiry_quantity ?? 0) > 0).length || 0
  }, [stores])
  // لا يوجد مؤشر "قريب النفاذ" على مستوى المتجر مباشرة، تُحسب من المنتجات العامة كتقدير
  const { data: products } = useQuery({
    queryKey: ['store-products'],
    queryFn: async () => {
      const res = await api.get('/products?per_page=1000')
      return (res.data.data || []) as Array<{ low_stock?: boolean }>
    },
  })
  const lowStockCount = useMemo(() => {
    return products?.filter((p) => (p.low_stock || false)).length || 0
  }, [products])

  const filteredStores = useMemo(() => {
    if (!stores) return []
    return stores.filter((s) => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
  }, [stores, storeSearch])

  const saveStoreMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: storeName,
        code: '',
        type: 'store',
        allow_sales: true,
        address: '',
        phone: '',
        is_default: false,
        is_active: true,
        notes: '',
      }
      if (editingStore) {
        await api.put(`/warehouses/${editingStore.id}`, payload)
      } else {
        await api.post('/warehouses', payload)
      }
    },
    onSuccess: () => {
      toast.success('تم حفظ المتجر')
      setShowModal(false)
      setEditingStore(null)
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حفظ المتجر')),
  })

  const deleteStoreMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/warehouses/${id}`),
    onSuccess: () => {
      toast.success('تم حذف المتجر')
      queryClient.invalidateQueries({ queryKey: ['stores'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حذف المتجر')),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المتاجر</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            إدارة المتاجر بناءً على الصلاحيات الممنوحة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateStores && (
            <Button onClick={() => { setEditingStore(null); setShowModal(true) }}>
              <Plus className="w-4 h-4" /> إضافة متجر
            </Button>
          )}
        </div>
      </div>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="إجمالي المتاجر" value={formatNumber(totalStores)} icon={<Warehouse className="h-5 w-5" />} tone="blue" />
          <StatCard label="إجمالي المنتجات" value={formatNumber(totalProducts)} icon={<Package className="h-5 w-5" />} tone="emerald" />
          <StatCard label="إجمالي الكمية" value={formatNumber(totalQuantity)} icon={<Package className="h-5 w-5" />} tone="emerald" />
          <StatCard label="قيمة المنتجات" value={formatMoney(stockValue, symbol)} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="قريب الانتهاء" value={formatNumber(nearExpiryCount)} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="قريب النفاذ" value={formatNumber(lowStockCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        </div>
      </Card>

      {canViewStores && (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="بحث عن متجر..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pe-10 ps-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {storesLoading ? (
              <div className="col-span-full py-12 text-center">
                <p className="text-sm text-gray-500">جارٍ تحميل المتاجر...</p>
              </div>
            ) : (
              <>
                {filteredStores.length === 0 && (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-sm text-gray-500">لا توجد متاجر</p>
                  </div>
                )}
                {filteredStores.map((store) => (
                  <StoreCard
                    key={store.id}
                    store={store}
                    onEdit={() => { setEditingStore(store); setStoreName(store.name || ''); setShowModal(true) }}
                    onDelete={() => deleteStoreMutation.mutate(store.id)}
                    onView={() => navigate(`/stores/${store.id}`)}
                    canEdit={canEditStores}
                    canDelete={canDeleteStores}
                  />
                ))}
              </>
            )}
          </div>
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingStore(null); setStoreName('') }}
        title={editingStore ? 'تعديل متجر' : 'إضافة متجر'}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            saveStoreMutation.mutate()
          }}
        >
          <Input
            label="اسم المتجر"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            required
          />
          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditingStore(null) }}>إلغاء</Button>
            <Button type="submit" loading={saveStoreMutation.isPending}>حفظ</Button>
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

function StoreCard({ store, onEdit, onDelete, onView, canEdit, canDelete }: {
  store: StoreRecord
  onEdit: () => void
  onDelete: () => void
  onView: () => void
  canEdit: boolean
  canDelete: boolean
}) {
  return (
    <div className="p-6 hover:shadow-xl transition-all cursor-pointer group" onClick={onView}>
      <Card className="p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-lg">{store.name}</h3>
          <Badge variant={store.type === 'store' ? 'success' : store.type === 'warehouse' ? 'info' : 'default'}>
            {store.type === 'store' ? 'متجر' : store.type === 'warehouse' ? 'مخزن' : 'كلاهما'}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          المنتجات: {store.products_count ?? 0} · المخزون: {formatNumber(store.total_quantity ?? 0)}
        </p>
        <div className="flex justify-end gap-2">
          {canEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit() }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded" title="تعديل">
              <PencilIcon className="w-5 h-5" />
            </button>
          )}
          {canDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded" title="حذف">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
