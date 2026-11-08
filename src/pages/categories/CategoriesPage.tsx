import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Trash2, Edit } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import { useAuthStore } from '../../store/authStore'

interface CategoryItem {
  id: number
  name: string
  color: string
  sort_order: number
  is_active: boolean
}

interface CategoryFormProps {
  category: CategoryItem | null
  onClose: () => void
  onSuccess: () => void
}

export default function CategoriesPage() {
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_categories')
  const canEdit = permissions.includes('edit_categories')
  const canDelete = permissions.includes('delete_categories')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CategoryItem | null>(null)
  const queryClient = useQueryClient()

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return res.data.categories || []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/categories/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })

  const columns: Column<CategoryItem>[] = [
    { key: 'name', header: 'الاسم' },
    { key: 'color', header: 'اللون', render: (c) => <span className="inline-block w-4 h-4 rounded" style={{ background: c.color }} /> },
    { key: 'sort_order', header: 'الترتيب' },
    { key: 'is_active', header: 'الحالة', render: (c) => c.is_active ? 'نشط' : 'معطل' },
    ...(canEdit || canDelete ? [{ key: 'actions', header: 'الإجراءات', render: (c: CategoryItem) => (
      <div className="flex gap-2">
        {canEdit && <button onClick={() => { setEditing(c); setShowModal(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"><Edit className="w-4 h-4" /></button>}
        {canDelete && <button onClick={() => deleteMutation.mutate(c.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )}] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">التصنيفات</h1>
        {canCreate && <Button onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-4 h-4" /> إضافة تصنيف</Button>}
      </div>
      <Card>
        <DataTable data={categories || []} columns={columns} loading={isLoading} emptyMessage="لا توجد تصنيفات" />
      </Card>
      {(canCreate || canEdit) && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل تصنيف' : 'إضافة تصنيف'}>
        <CategoryForm category={editing} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['categories'] }) }} />
      </Modal>}
    </div>
  )
}

function CategoryForm({ category, onClose, onSuccess }: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    color: category?.color || '#3b82f6',
    sort_order: category?.sort_order || 0,
    is_active: category?.is_active ?? true,
  })
  const mutation = useMutation({
    mutationFn: async (data: { name: string; color: string; sort_order: number; is_active: boolean; slug: string }) => {
      if (category) await api.put(`/categories/${category.id}`, data)
      else await api.post('/categories', data)
    },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate({ ...formData, slug: formData.name.toLowerCase().replace(/\s+/g, '-') }) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="اسم التصنيف" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <Input label="اللون" type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
      <Input label="الترتيب" type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>{category ? 'تحديث' : 'إضافة'}</Button>
      </div>
    </form>
  )
}