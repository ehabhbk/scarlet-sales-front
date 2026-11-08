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

interface SupplierItem {
  id: number
  name: string
  contact_person?: string
  phone?: string
  address?: string
  tax_number?: string
  balance?: number
  is_active: boolean
}

interface SupplierFormProps {
  supplier: SupplierItem | null
  onClose: () => void
  onSuccess: () => void
}

export default function SuppliersPage() {
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_suppliers')
  const canEdit = permissions.includes('edit_suppliers')
  const canDelete = permissions.includes('delete_suppliers')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SupplierItem | null>(null)
  const queryClient = useQueryClient()

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/suppliers')
      return res.data.suppliers || []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/suppliers/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  })

  const columns: Column<SupplierItem>[] = [
    { key: 'name', header: 'الاسم' },
    { key: 'contact_person', header: 'جهة الاتصال' },
    { key: 'phone', header: 'الهاتف' },
    { key: 'balance', header: 'الرصيد' },
    { key: 'is_active', header: 'الحالة', render: (s) => s.is_active ? 'نشط' : 'معطل' },
    ...(canEdit || canDelete ? [{ key: 'actions', header: 'الإجراءات', render: (s: SupplierItem) => (
      <div className="flex gap-2">
        {canEdit && <button onClick={() => { setEditing(s); setShowModal(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"><Edit className="w-4 h-4" /></button>}
        {canDelete && <button onClick={() => deleteMutation.mutate(s.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )}] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الموردون</h1>
        {canCreate && <Button onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-4 h-4" /> إضافة مورد</Button>}
      </div>
      <Card>
        <DataTable data={suppliers || []} columns={columns} loading={isLoading} emptyMessage="لا يوجد موردون" />
      </Card>
      {(canCreate || canEdit) && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل مورد' : 'إضافة مورد'}>
        <SupplierForm supplier={editing} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['suppliers'] }) }} />
      </Modal>}
    </div>
  )
}

function SupplierForm({ supplier, onClose, onSuccess }: SupplierFormProps) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    tax_number: supplier?.tax_number || '',
    balance: supplier?.balance || 0,
    is_active: supplier?.is_active ?? true,
  })
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (supplier) await api.put(`/suppliers/${supplier.id}`, data)
      else await api.post('/suppliers', data)
    },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(formData) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="الاسم" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <Input label="جهة الاتصال" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
      <Input label="الهاتف" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
      <Input label="العنوان" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
      <Input label="الرقم الضريبي" value={formData.tax_number} onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>{supplier ? 'تحديث' : 'إضافة'}</Button>
      </div>
    </form>
  )
}