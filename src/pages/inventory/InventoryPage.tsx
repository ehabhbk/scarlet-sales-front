import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { Plus, Search, Edit, Trash2, AlertTriangle } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import Pagination from '../../components/common/Pagination'
import { toast } from 'sonner'
import { formatNumber } from '../../utils/format'

interface InventoryProduct {
  id: number
  name: string
  sku?: string | null
  barcode?: string | null
  category?: { name: string } | string
  sale_price: number
  cost_price: number
  current_stock: number
  min_stock?: number
  sale_unit?: string | null
  purchase_unit?: string | null
  total_stock?: number
  is_available: boolean
  image?: string | null
}

export default function InventoryPage() {
  const { symbol } = useSettingsStore()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryProduct | null>(null)
  const queryClient = useQueryClient()

  const { data: itemsRes, isLoading } = useQuery({
    queryKey: ['inventory-products', search, page],
    queryFn: async () => {
      const res = await api.get(`/products?search=${search}&page=${page}&per_page=15`)
      return res.data
    },
  })
  const items = itemsRes?.data as InventoryProduct[] | undefined
  const itemsMeta = itemsRes ? { current_page: itemsRes.current_page, last_page: itemsRes.last_page, total: itemsRes.total, per_page: itemsRes.per_page } : null

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/products/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('تم حذف المنتج')
    },
  })

  const columns: Column<InventoryProduct>[] = [
    { key: 'name', header: 'اسم المنتج', render: (item) => <div className="font-medium">{item.name}</div> },
    { key: 'sku', header: 'SKU', render: (item) => item.sku || '-' },
    { key: 'barcode', header: 'الباركود', render: (item) => item.barcode || '-' },
    { key: 'category', header: 'التصنيف', render: (item) => (typeof item.category === 'string' ? item.category : item.category?.name) || '-' },
    { key: 'stock', header: 'المخزون', render: (item) => {
      const stock = Number(item.total_stock ?? item.current_stock)
      const min = Number(item.min_stock ?? 0)
      return (
        <span className={`font-medium ${min > 0 && stock <= min ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {formatNumber(stock)}
        </span>
      )
    }},
    { key: 'min_stock', header: 'الحد الأدنى', render: (item) => formatNumber(Number(item.min_stock ?? 0)) },
    { key: 'cost_price', header: 'تكلفة الوحدة', render: (item) => formatMoney(item.cost_price, symbol) },
    { key: 'sale_price', header: 'سعر البيع', render: (item) => formatMoney(item.sale_price, symbol) },
    { key: 'status', header: 'الحالة', render: (item) => (
      item.is_available ? <Badge variant="success">متوفر</Badge> : <Badge variant="default">غير متاح</Badge>
    )},
    { key: 'actions', header: 'الإجراءات', render: (item) => (
      <div className="flex gap-2">
        <button onClick={() => { setEditingItem(item); setShowModal(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded">
          <Edit className="w-4 h-4" />
        </button>
        <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ]

  const lowStockCount = items?.filter((i) => {
    const stock = Number(i.total_stock ?? i.current_stock)
    const min = Number(i.min_stock ?? 0)
    return stock <= min && min > 0
  }).length || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المخزون (المنتجات)</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            إدارة أرصدة المنتجات عبر المخازن، تواريخ الصلاحية، وتنبيهات النفاذ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => { setEditingItem(null); setShowModal(true) }}><Plus className="w-4 h-4" /> إضافة منتج</Button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-800 dark:text-amber-300">
            يوجد {lowStockCount} منتج بمخزون منخفض
          </span>
        </div>
      )}

      <Card>
        <div className="mb-4">
          <Input
            placeholder="بحث عن منتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-5 h-5" />}
          />
        </div>

        <DataTable
          data={items || []}
          columns={columns}
          loading={isLoading}
          emptyMessage="لا توجد منتجات"
        />
        <Pagination meta={itemsMeta} onPageChange={setPage} />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'تعديل منتج' : 'إضافة منتج جديد'}
      >
        <InventoryForm
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['inventory-products'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
          }}
        />
      </Modal>
    </div>
  )
}

function InventoryForm({ item, onClose, onSuccess }: { item: InventoryProduct | null; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState<{
    name: string
    sku: string
    barcode: string
    sale_price: number | string
    cost_price: number | string
    min_stock: number | string
    sale_unit: string
    purchase_unit: string
    is_available: boolean
  }>({
    name: item?.name || '',
    sku: item?.sku || '',
    barcode: item?.barcode || '',
    sale_price: item?.sale_price || '',
    cost_price: item?.cost_price || '',
    min_stock: item?.min_stock ?? 0,
    sale_unit: item?.sale_unit || '',
    purchase_unit: item?.purchase_unit || '',
    is_available: item?.is_available ?? true,
  })

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (item) {
        await api.put(`/products/${item.id}`, data)
      } else {
        await api.post('/products', data)
      }
    },
    onSuccess,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="اسم المنتج"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="SKU"
          value={formData.sku}
          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
        />
        <Input
          label="الباركود"
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="سعر البيع"
          type="number"
          min={0}
          step="0.01"
          value={formData.sale_price}
          onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
          required
        />
        <Input
          label="تكلفة الوحدة"
          type="number"
          min={0}
          step="0.01"
          value={formData.cost_price}
          onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="وحدة البيع"
          value={formData.sale_unit}
          placeholder="مثال: قطعة، كرتون"
          onChange={(e) => setFormData({ ...formData, sale_unit: e.target.value })}
        />
        <Input
          label="وحدة الشراء"
          value={formData.purchase_unit}
          placeholder="مثال: صندوق، كيس"
          onChange={(e) => setFormData({ ...formData, purchase_unit: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="الحد الأدنى للمخزون"
          type="number"
          min={0}
          value={formData.min_stock}
          onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.is_available}
            onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
            className="w-4 h-4"
          />
          متاح للبيع
        </label>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>
          {item ? 'تحديث' : 'إضافة'}
        </Button>
      </div>
    </form>
  )
}
