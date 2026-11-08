import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'

interface RecipeRecord {
  id: number
  name: string
  product?: { name: string }
  product_id: number | string
  yield_qty: number
  total_cost: number
  instructions?: string
  is_active: boolean
}

interface RecipeFormProps {
  recipe: RecipeRecord | null
  products: { id: number; name: string }[]
  onClose: () => void
  onSuccess: () => void
}

export default function RecipesPage() {
  const { symbol } = useSettingsStore()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<RecipeRecord | null>(null)
  const queryClient = useQueryClient()

  const { data: recipes, isLoading } = useQuery({
    queryKey: ['recipes', search],
    queryFn: async () => {
      const res = await api.get('/recipes')
      return res.data.data || res.data
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const res = await api.get('/products?is_available=1')
      return (res.data.data || []) as RecipeFormProps['products']
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/recipes/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  })

  const columns: Column<RecipeRecord>[] = [
    { key: 'name', header: 'اسم الوصفة' },
    { key: 'product', header: 'المنتج', render: (item) => item.product?.name || '-' },
    { key: 'yield_qty', header: 'الكمية المنتجة' },
    { key: 'total_cost', header: 'التكلفة', render: (item) => formatMoney(item.total_cost, symbol) },
    { key: 'is_active', header: 'الحالة', render: (item) => item.is_active ? 'نشط' : 'معطل' },
    { key: 'actions', header: 'الإجراءات', render: (item) => (
      <div className="flex gap-2">
        <button onClick={() => { setEditing(item); setShowModal(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"><Edit className="w-4 h-4" /></button>
        <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
      </div>
    )},
  ]

  const list = Array.isArray(recipes) ? recipes : (recipes?.data || [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الوصفات</h1>
        <Button onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-4 h-4" /> إضافة وصفة</Button>
      </div>
      <Card>
        <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-5 h-5" />} />
        <div className="mt-4">
          <DataTable data={list} columns={columns} loading={isLoading} emptyMessage="لا توجد وصفات" />
        </div>
      </Card>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل وصفة' : 'إضافة وصفة'}>
        <RecipeForm recipe={editing} products={(products || []) as RecipeFormProps['products']} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['recipes'] }) }} />
      </Modal>
    </div>
  )
}

function RecipeForm({ recipe, products, onClose, onSuccess }: RecipeFormProps) {
  const [formData, setFormData] = useState<{
    product_id: string | number
    name: string
    yield_qty: number | string
    instructions: string
    is_active: boolean
  }>({
    product_id: recipe?.product_id || '',
    name: recipe?.name || '',
    yield_qty: recipe?.yield_qty || 1,
    instructions: recipe?.instructions || '',
    is_active: recipe?.is_active ?? true,
  })
  const mutation = useMutation({
    mutationFn: async (data: { product_id: string | number; name: string; yield_qty: number | string; instructions: string; is_active: boolean }) => {
      if (recipe) await api.put(`/recipes/${recipe.id}`, data)
      else await api.post('/recipes', data)
    },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(formData) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المنتج</label>
        <select value={formData.product_id} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
          <option value="">اختر المنتج</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <Input label="اسم الوصفة" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <Input label="كمية الإنتاج" type="number" value={formData.yield_qty} onChange={(e) => setFormData({ ...formData, yield_qty: e.target.value })} />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">التعليمات</label>
        <textarea value={formData.instructions} onChange={(e) => setFormData({ ...formData, instructions: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" rows={3} />
      </div>
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>{recipe ? 'تحديث' : 'إضافة'}</Button>
      </div>
    </form>
  )
}