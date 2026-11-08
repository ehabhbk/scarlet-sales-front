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

interface UnitItem {
  id: number
  name: string
  abbreviation: string
  sort_order?: number
  is_active: boolean
}

interface UnitFormProps {
  unit: UnitItem | null
  onClose: () => void
  onSuccess: () => void
}

export default function InventoryUnitsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_inventory') || permissions.includes('manage_inventory')
  const canEdit = permissions.includes('edit_inventory') || permissions.includes('manage_inventory')
  const canDelete = permissions.includes('delete_inventory') || permissions.includes('manage_inventory')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<UnitItem | null>(null)
  const queryClient = useQueryClient()

  const { data: units, isLoading } = useQuery({
    queryKey: ['inventory-units'],
    queryFn: async () => {
      const res = await api.get('/inventory-units')
      return res.data.units || []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/inventory-units/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-units'] }),
  })

  const columns: Column<UnitItem>[] = [
    { key: 'name', header: 'الاسم' },
    { key: 'abbreviation', header: 'الاختصار' },
    { key: 'sort_order', header: 'الترتيب' },
    { key: 'is_active', header: 'الحالة', render: (u) => u.is_active ? 'نشط' : 'معطل' },
    ...(canEdit || canDelete ? [{ key: 'actions', header: 'الإجراءات', render: (u: UnitItem) => (
      <div className="flex gap-2">
        {canEdit && <button onClick={() => { setEditing(u); setShowModal(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"><Edit className="w-4 h-4" /></button>}
        {canDelete && <button onClick={() => deleteMutation.mutate(u.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )}] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">وحدات القياس</h1>
        {canCreate && <Button onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-4 h-4" /> إضافة وحدة</Button>}
      </div>
      <Card>
        <DataTable data={units || []} columns={columns} loading={isLoading} emptyMessage="لا توجد وحدات" />
      </Card>
      {(canCreate || canEdit) && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل وحدة' : 'إضافة وحدة'}>
        <UnitForm unit={editing} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['inventory-units'] }) }} />
      </Modal>}
    </div>
  )
}

function UnitForm({ unit, onClose, onSuccess }: UnitFormProps) {
  const [formData, setFormData] = useState({
    name: unit?.name || '',
    abbreviation: unit?.abbreviation || '',
    sort_order: unit?.sort_order || 0,
    is_active: unit?.is_active ?? true,
  })
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (unit) await api.put(`/inventory-units/${unit.id}`, data)
      else await api.post('/inventory-units', data)
    },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(formData) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="الاسم" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <Input label="الاختصار" value={formData.abbreviation} onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })} required />
      <Input label="الترتيب" type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>{unit ? 'تحديث' : 'إضافة'}</Button>
      </div>
    </form>
  )
}