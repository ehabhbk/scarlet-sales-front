import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { Plus, Search, Edit, Trash2, AlertTriangle, ImageIcon } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import Pagination from '../../components/common/Pagination'
import { toast } from 'sonner'
import { formatNumber } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'

interface InventoryProduct {
  id: number
  name: string
  sku?: string | null
  barcode?: string | null
  category?: { name: string } | string
  category_id?: number | null
  sale_price: number
  cost_price: number
  current_stock: number
  min_stock?: number
  sale_unit?: string | null
  purchase_unit?: string | null
  main_unit?: string | null
  sub_unit?: string | null
  conversion_factor?: number | null
  sub_unit_price?: number | null
  total_stock?: number
  is_available: boolean
  image?: string | null
}

interface CategoryOption {
  id: number
  name: string
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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return (res.data.categories || res.data.data || []) as CategoryOption[]
    },
  })

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
          categories={categories || []}
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

function InventoryForm({ item, categories, onClose, onSuccess }: {
  item: InventoryProduct | null
  categories: CategoryOption[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState<{
    name: string
    category_id: number | string
    sku: string
    barcode: string
    sale_price: number | string
    cost_price: number | string
    min_stock: number | string
    sale_unit: string
    purchase_unit: string
    main_unit: string
    sub_unit: string
    conversion_factor: number | string
    sub_unit_price: number | string
    is_available: boolean
  }>({
    name: item?.name || '',
    category_id: item?.category_id || '',
    sku: item?.sku || '',
    barcode: item?.barcode || '',
    sale_price: item?.sale_price ?? '',
    cost_price: item?.cost_price ?? '',
    min_stock: item?.min_stock ?? 0,
    sale_unit: item?.sale_unit || '',
    purchase_unit: item?.purchase_unit || '',
    main_unit: item?.main_unit || '',
    sub_unit: item?.sub_unit || '',
    conversion_factor: item?.conversion_factor ?? '',
    sub_unit_price: item?.sub_unit_price ?? '',
    is_available: item?.is_available ?? true,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(item?.image ? mediaUrl(item.image) : '')

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const mutation = useMutation({
    mutationFn: async () => {
      const data = new FormData()
      data.append('name', formData.name)
      if (String(formData.category_id).trim()) data.append('category_id', String(formData.category_id))
      if (formData.sku.trim()) data.append('sku', formData.sku.trim())
      if (formData.barcode.trim()) data.append('barcode', formData.barcode.trim())
      data.append('sale_price', String(formData.sale_price))
      data.append('cost_price', String(formData.cost_price))
      data.append('min_stock', String(formData.min_stock))
      if (formData.sale_unit.trim()) data.append('sale_unit', formData.sale_unit.trim())
      if (formData.purchase_unit.trim()) data.append('purchase_unit', formData.purchase_unit.trim())
      if (formData.main_unit.trim()) data.append('main_unit', formData.main_unit.trim())
      if (formData.sub_unit.trim()) data.append('sub_unit', formData.sub_unit.trim())
      if (String(formData.conversion_factor).trim()) {
        data.append('conversion_factor', String(formData.conversion_factor))
      }
      if (String(formData.sub_unit_price).trim()) {
        data.append('sub_unit_price', String(formData.sub_unit_price))
      }
      data.append('is_available', formData.is_available ? '1' : '0')
      if (imageFile) data.append('image_file', imageFile)

      if (item) {
        data.append('_method', 'PUT')
        await api.post(`/products/${item.id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        await api.post('/products', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
    },
    onSuccess: () => {
      toast.success(item ? 'تم تحديث المنتج' : 'تم إضافة المنتج')
      onSuccess()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حفظ المنتج')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto,1fr]">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">صورة المنتج</label>
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            {imagePreview ? (
              <img src={imagePreview} alt="معاينة صورة المنتج" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setImageFile(file)
              setImagePreview(file ? URL.createObjectURL(file) : item?.image ? mediaUrl(item.image) : '')
            }}
            className="mt-2 block w-full max-w-[12rem] text-xs"
          />
        </div>
        <Input
          label="اسم المنتج"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">التصنيف</label>
          <select
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">بدون تصنيف</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <Input
          label="الباركود"
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          placeholder="امسح الباركود أو أدخله يدوياً"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="SKU"
          value={formData.sku}
          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
        />
        <Input
          label="الحد الأدنى للمخزون"
          type="number"
          min={0}
          value={formData.min_stock}
          onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="الوحدة الأساسية"
          value={formData.main_unit}
          placeholder="مثال: كرتون"
          onChange={(e) => setFormData({ ...formData, main_unit: e.target.value })}
        />
        <Input
          label="الوحدة الفرعية"
          value={formData.sub_unit}
          placeholder="مثال: قطعة"
          onChange={(e) => setFormData({ ...formData, sub_unit: e.target.value })}
        />
        <Input
          label="معامل التحويل"
          type="number"
          min={0}
          step="0.001"
          value={formData.conversion_factor}
          placeholder="عدد الوحدات الفرعية في الأساسية"
          onChange={(e) => setFormData({ ...formData, conversion_factor: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="سعر الوحدة الفرعية (اختياري)"
          type="number"
          min={0}
          step="0.01"
          value={formData.sub_unit_price}
          onChange={(e) => setFormData({ ...formData, sub_unit_price: e.target.value })}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={formData.is_available}
            onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
            className="h-4 w-4"
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
