import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { Plus, Search, Edit, Trash2, Settings, ImagePlus, Barcode, AlertTriangle } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Pagination from '../../components/common/Pagination'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { getApiErrorMessage } from '../../utils/apiError'
import { formatDate } from '../../utils/format'

interface ProductRecord {
  id: number
  name: string
  image?: string
  sku?: string
  barcode?: string
  category?: { name: string }
  category_id: number | string
  sale_price: number
  cost_price: number
  current_stock: number
  total_stock?: number
  min_stock?: number
  sale_unit?: string | null
  purchase_unit?: string | null
  expiry_alert_days?: number
  low_stock_threshold?: number
  low_stock?: boolean
  expired_quantity?: number
  near_expiry_quantity?: number
  nearest_expiry?: string | null
  track_inventory?: boolean
  is_available: boolean
}

interface WarehouseOption {
  id: number
  name: string
  code?: string | null
  is_default: boolean
}

interface ProductFormProps {
  product: ProductRecord | null
  categories: { id: number; name: string }[]
  warehouses: WarehouseOption[]
  onClose: () => void
  onSuccess: () => void
}

export default function ProductsPage() {
  const { symbol } = useSettingsStore()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_products')
  const canEdit = permissions.includes('edit_products')
  const canDelete = permissions.includes('delete_products')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null)
  const [managingProduct, setManagingProduct] = useState<ProductRecord | null>(null)
  const queryClient = useQueryClient()

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: async () => {
      const res = await api.get('/products', { params: { search, page } })
      return res.data
    },
  })

  const products = (productsRes?.data || []) as ProductRecord[]
  const productsMeta = productsRes?.meta || (productsRes?.current_page ? {
    current_page: productsRes.current_page,
    last_page: productsRes.last_page,
    total: productsRes.total,
    per_page: productsRes.per_page,
  } : null)

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return (res.data.categories || res.data.data || []) as ProductFormProps['categories']
    },
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses')
      return (res.data.warehouses || []) as WarehouseOption[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/products/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const columns: Column<ProductRecord>[] = [
    {
      key: 'name',
      header: 'اسم المنتج',
      render: (item: ProductRecord) => (
        <div className="flex items-center gap-3">
          {item.image ? (
            <img src={mediaUrl(item.image)} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
              <ImagePlus className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{item.name}</p>
            <p className="truncate text-xs text-gray-500">{item.category?.name || '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'barcode',
      header: 'الباركود',
      render: (item) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-600 dark:text-gray-300">
          <Barcode className="h-3.5 w-3.5" />
          {item.barcode || item.sku || '-'}
        </span>
      ),
    },
    {
      key: 'sale_price',
      header: 'سعر البيع',
      render: (item) => <div>{formatMoney(item.sale_price, symbol)}</div>,
    },
    {
      key: 'cost_price',
      header: 'التكلفة',
      render: (item) => <div>{formatMoney(item.cost_price, symbol)}</div>,
    },
    {
      key: 'total_stock',
      header: 'الرصيد',
      render: (item: ProductRecord) => {
        const stock = item.total_stock ?? item.current_stock ?? 0
        return (
          <div className="flex flex-col gap-1">
            <span className={`w-fit rounded px-2 py-1 text-xs ${
              item.low_stock
                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                : 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
            }`}>
              {stock}
            </span>
            {item.low_stock && (
              <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                حد التنبيه {item.min_stock ?? 0}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'nearest_expiry',
      header: 'أقرب صلاحية',
      render: (item: ProductRecord) => (
        <div className="text-xs">
          {item.nearest_expiry ? formatDate(item.nearest_expiry) : '-'}
          {Number(item.expired_quantity) > 0 && (
            <p className="text-[10px] text-red-600 dark:text-red-400">منتهي: {item.expired_quantity}</p>
          )}
          {Number(item.near_expiry_quantity) > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">قريب: {item.near_expiry_quantity}</p>
          )}
        </div>
      ),
    },
    ...(canEdit || canDelete ? [{
      key: 'actions',
      header: 'الإجراءات',
      render: (item: ProductRecord) => (
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button onClick={() => setManagingProduct(item)} className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded" title="إدارة الأحجام والإضافات">
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditingProduct(item); setShowModal(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded" title="تعديل">
                <Edit className="w-4 h-4" />
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => {
              if (window.confirm(`هل تريد حذف المنتج ${item.name}؟`)) deleteMutation.mutate(item.id)
            }} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded" title="حذف">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المنتجات</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            إدارة المنتجات والباركود وحدود التنبيه وتواريخ الصلاحية.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditingProduct(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> إضافة منتج
          </Button>
        )}
      </div>
      <Card>
        <div className="mb-4">
          <Input
            placeholder="اسم المنتج أو الباركود أو القسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-5 h-5" />}
          />
        </div>
        <DataTable data={products} columns={columns} loading={isLoading} emptyMessage="لا توجد منتجات" />
        <Pagination meta={productsMeta} onPageChange={setPage} />
      </Card>
      {(canCreate || canEdit) && <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'تعديل منتج' : 'إضافة منتج'}
      >
        <ProductForm
          product={editingProduct}
          categories={categories || []}
          warehouses={warehouses || []}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['warehouses'] })
            queryClient.invalidateQueries({ queryKey: ['product-alerts'] })
          }}
        />
      </Modal>}
      {canEdit && <Modal
        isOpen={!!managingProduct}
        onClose={() => setManagingProduct(null)}
        title={`الأحجام والإضافات: ${managingProduct?.name || ''}`}
        size="lg"
      >
        {managingProduct && <ProductModifiersManager product={managingProduct} symbol={symbol} />}
      </Modal>}
    </div>
  )
}

function ProductForm({ product, categories, warehouses, onClose, onSuccess }: ProductFormProps) {
  const defaultWarehouse = warehouses.find((warehouse) => warehouse.is_default) || warehouses[0]
  const [formData, setFormData] = useState<{
    name: string
    category_id: number | string
    barcode: string
    sale_price: number | string
    cost_price: number | string
    min_stock: number | string
    sale_unit: string
    purchase_unit: string
    expiry_alert_days: number | string
    low_stock_threshold: number | string
    track_inventory: boolean
    is_available: boolean
    initial_warehouse_id: string
    initial_quantity: number | string
    expiry_date: string
    batch_number: string
  }>({
    name: product?.name || '',
    category_id: product?.category_id || '',
    barcode: product?.barcode || '',
    sale_price: product?.sale_price || '',
    cost_price: product?.cost_price || '',
    min_stock: product?.min_stock ?? 5,
    sale_unit: product?.sale_unit || '',
    purchase_unit: product?.purchase_unit || '',
    expiry_alert_days: product?.expiry_alert_days ?? 30,
    low_stock_threshold: product?.low_stock_threshold ?? 5,
    track_inventory: product?.track_inventory ?? true,
    is_available: product?.is_available ?? true,
    initial_warehouse_id: defaultWarehouse ? String(defaultWarehouse.id) : '',
    initial_quantity: '',
    expiry_date: '',
    batch_number: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(product?.image ? mediaUrl(product.image) : '')

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const mutation = useMutation({
    mutationFn: async () => {
      const data = new FormData()
      data.append('name', formData.name)
      data.append('category_id', String(formData.category_id))
      if (formData.barcode.trim()) data.append('barcode', formData.barcode.trim())
      data.append('sale_price', String(formData.sale_price))
      data.append('cost_price', String(formData.cost_price))
      data.append('min_stock', String(formData.min_stock))
      data.append('sale_unit', formData.sale_unit.trim())
      data.append('purchase_unit', formData.purchase_unit.trim())
      data.append('expiry_alert_days', String(formData.expiry_alert_days))
      data.append('low_stock_threshold', String(formData.low_stock_threshold))
      data.append('track_inventory', formData.track_inventory ? '1' : '0')
      data.append('is_available', formData.is_available ? '1' : '0')
      if (imageFile) data.append('image_file', imageFile)
      if (product) {
        data.append('_method', 'PUT')
        await api.post(`/products/${product.id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        if (formData.initial_warehouse_id) data.append('warehouse_id', formData.initial_warehouse_id)
        if (Number(formData.initial_quantity) > 0) {
          data.append('initial_quantity', String(formData.initial_quantity))
          if (formData.expiry_date) data.append('expiry_date', formData.expiry_date)
          if (formData.batch_number.trim()) data.append('batch_number', formData.batch_number.trim())
        }
        await api.post('/products', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
    },
    onSuccess: () => {
      toast.success('تم الحفظ')
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
      <Input
        label="اسم المنتج"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">القسم</label>
          <select
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          >
            <option value="">بدون قسم</option>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          label="التكلفة"
          type="number"
          min={0}
          step="0.01"
          value={formData.cost_price}
          onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="حد التنبيه (الحد الأدنى للمخزون)"
          type="number"
          min={0}
          value={formData.min_stock}
          onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
        />
        <Input
          label="وحدة البيع"
          value={formData.sale_unit}
          onChange={(e) => setFormData({ ...formData, sale_unit: e.target.value })}
          placeholder="مثال: قطعة، كرتون"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="وحدة الشراء"
          value={formData.purchase_unit}
          onChange={(e) => setFormData({ ...formData, purchase_unit: e.target.value })}
          placeholder="مثال: صندوق، كيس"
        />
        <Input
          label="مدة تنبيه قبل انتهاء الصلاحية (أيام)"
          type="number"
          min={0}
          value={formData.expiry_alert_days}
          onChange={(e) => setFormData({ ...formData, expiry_alert_days: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="قيمة تنبيه قرب نفاذ الكمية"
          type="number"
          min={0}
          value={formData.low_stock_threshold}
          onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
        />
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.track_inventory}
              onChange={(e) => setFormData({ ...formData, track_inventory: e.target.checked })}
              className="w-4 h-4"
            />
            تتبع المخزون
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.is_available}
              onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
              className="w-4 h-4"
            />
            متوفر للبيع
          </label>
        </div>
      </div>

      {!product && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">رصيد افتتاحي (اختياري)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">المخزن</label>
              <select
                value={formData.initial_warehouse_id}
                onChange={(e) => setFormData({ ...formData, initial_warehouse_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              >
                <option value="">المخزن الافتراضي</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}{warehouse.code ? ` (${warehouse.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="الكمية الافتتاحية"
              type="number"
              min={0}
              step="0.001"
              value={formData.initial_quantity}
              onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
            />
            <Input
              label="تاريخ انتهاء الدفعة"
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
            />
            <Input
              label="رقم الدفعة"
              value={formData.batch_number}
              onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
            />
          </div>
          <p className="text-xs text-gray-500">
            يمكنك إدخال دفعات إضافية وتواريخ صلاحية متعددة من صفحة المخازن.
          </p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">صورة المنتج</label>
        {imagePreview && <img src={imagePreview} alt="معاينة المنتج" className="mb-3 h-24 w-24 rounded-lg object-cover" />}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            setImageFile(file)
            setImagePreview(file ? URL.createObjectURL(file) : product?.image ? mediaUrl(product.image) : '')
          }}
          className="block w-full text-sm"
        />
      </div>
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {product ? 'تحديث' : 'إضافة'}
        </Button>
      </div>
    </form>
  )
}

function ProductModifiersManager({ product, symbol }: { product: Pick<ProductRecord, 'id' | 'name'>; symbol: string }) {
  const queryClient = useQueryClient()
  const { data: sizes, refetch: refetchSizes } = useQuery({
    queryKey: ['product-sizes', product.id],
    queryFn: async () => {
      const res = await api.get(`/products/${product.id}/sizes`)
      return (res.data.sizes || res.data.data || res.data || []) as { id: number; name: string; price_modifier: number }[]
    },
  })
  const { data: modifiers, refetch: refetchModifiers } = useQuery({
    queryKey: ['product-modifiers', product.id],
    queryFn: async () => {
      const res = await api.get(`/products/${product.id}/modifiers`)
      return (res.data.modifiers || res.data.data || res.data || []) as { id: number; name: string; is_required: boolean }[]
    },
  })
  const [sizeName, setSizeName] = useState('')
  const [sizePrice, setSizePrice] = useState('')
  const [modName, setModName] = useState('')
  const [modRequired, setModRequired] = useState(false)

  const addSizeMutation = useMutation({
    mutationFn: async () => { await api.post(`/products/${product.id}/sizes`, { name: sizeName, price_modifier: Number(sizePrice), is_default: false }) },
    onSuccess: () => { setSizeName(''); setSizePrice(''); refetchSizes(); queryClient.invalidateQueries({ queryKey: ['products'] }) },
  })
  const deleteSizeMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/products/${product.id}/sizes/${id}`) },
    onSuccess: () => { refetchSizes(); queryClient.invalidateQueries({ queryKey: ['products'] }) },
  })
  const addModifierMutation = useMutation({
    mutationFn: async () => { await api.post(`/products/${product.id}/modifiers`, { name: modName, is_required: modRequired, min_selection: modRequired ? 1 : 0, max_selection: 1, is_active: true }) },
    onSuccess: () => { setModName(''); setModRequired(false); refetchModifiers(); queryClient.invalidateQueries({ queryKey: ['products'] }) },
  })
  const deleteModifierMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/products/${product.id}/modifiers/${id}`) },
    onSuccess: () => { refetchModifiers(); queryClient.invalidateQueries({ queryKey: ['products'] }) },
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">الأحجام</h3>
        <div className="space-y-2 mb-3">
          {(sizes || []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-800/40 rounded">
              <span>{s.name} ({formatMoney(s.price_modifier, symbol)})</span>
              <button onClick={() => deleteSizeMutation.mutate(s.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="اسم الحجم" value={sizeName} onChange={(e) => setSizeName(e.target.value)} />
          <Input placeholder="فرق السعر" type="number" value={sizePrice} onChange={(e) => setSizePrice(e.target.value)} />
          <Button size="sm" onClick={() => addSizeMutation.mutate()} loading={addSizeMutation.isPending}>إضافة</Button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">الإضافات</h3>
        <div className="space-y-2 mb-3">
          {(modifiers || []).map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-800/40 rounded">
              <span>{m.name} {m.is_required ? '(مطلوبة)' : ''}</span>
              <button onClick={() => deleteModifierMutation.mutate(m.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Input placeholder="اسم الإضافة" value={modName} onChange={(e) => setModName(e.target.value)} />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={modRequired} onChange={(e) => setModRequired(e.target.checked)} /> مطلوبة
          </label>
          <Button size="sm" onClick={() => addModifierMutation.mutate()} loading={addModifierMutation.isPending}>إضافة</Button>
        </div>
      </div>
    </div>
  )
}
