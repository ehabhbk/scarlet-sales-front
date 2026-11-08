import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'

interface Area {
  id: number
  name: string
  description?: string
  sort_order: number
}

export default function AreasPage() {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: areas, isLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const res = await api.get('/areas')
      return (res.data.areas || []) as Area[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/areas/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['areas'] }),
  })

  const columns: Column<Area>[] = [
    { key: 'name', header: 'اسم المنطقة' },
    { key: 'description', header: 'الوصف' },
    { key: 'sort_order', header: 'الترتيب' },
    { key: 'actions', header: 'الإجراءات', render: (a) => (
      <button onClick={() => deleteMutation.mutate(a.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المناطق</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> إضافة منطقة</Button>
      </div>
      <Card>
        <DataTable data={areas || []} columns={columns} loading={isLoading} emptyMessage="لا توجد مناطق" />
      </Card>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="إضافة منطقة">
        <AreaForm onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['areas'] }) }} />
      </Modal>
    </div>
  )
}

function AreaForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ name: '', description: '', sort_order: 0 })
  const mutation = useMutation({
    mutationFn: async (data: { name: string; description: string; sort_order: number }) => { await api.post('/areas', data) },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(formData) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="اسم المنطقة" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <Input label="الوصف" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
      <Input label="الترتيب" type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>حفظ</Button>
      </div>
    </form>
  )
}