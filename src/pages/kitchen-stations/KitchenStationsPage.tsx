import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'

interface KitchenStation {
  id: number
  name: string
  color: string
  sort_order: number
  is_active: boolean
}

export default function KitchenStationsPage() {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: stations, isLoading } = useQuery({
    queryKey: ['kitchen-stations'],
    queryFn: async () => {
      const res = await api.get('/kitchen/stations')
      return (res.data.stations || []) as KitchenStation[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/kitchen/stations/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] }),
  })

  const columns = [
    { key: 'name', header: 'اسم المحطة' },
    { key: 'color', header: 'اللون', render: (s: KitchenStation) => <span className="inline-block w-4 h-4 rounded" style={{ background: s.color }} /> },
    { key: 'sort_order', header: 'الترتيب' },
    { key: 'is_active', header: 'الحالة', render: (s: KitchenStation) => s.is_active ? 'نشط' : 'معطل' },
    { key: 'actions', header: 'الإجراءات', render: (s: KitchenStation) => (
      <button onClick={() => deleteMutation.mutate(s.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">محطات المطبخ</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> إضافة محطة</Button>
      </div>
      <Card>
        <DataTable data={stations || []} columns={columns} loading={isLoading} emptyMessage="لا توجد محطات" />
      </Card>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="إضافة محطة">
        <StationForm onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] }) }} />
      </Modal>
    </div>
  )
}

function StationForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6', sort_order: 0 })
  const mutation = useMutation({
    mutationFn: async (data: { name: string; color: string; sort_order: number }) => { await api.post('/kitchen/stations', data) },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(formData) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="اسم المحطة" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <Input label="اللون" type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
      <Input label="الترتيب" type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>حفظ</Button>
      </div>
    </form>
  )
}