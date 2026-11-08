import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Pagination from '../../components/common/Pagination'
import { formatDateTime } from '../../utils/format'

interface StockMovement {
  id: number
  inventoryItem?: { name: string }
  type: string
  quantity: number
  cost_per_unit: number
  total_cost: number
  reference_type?: string
  created_at: string
}

interface MovementFormProps {
  items: { id: number; name: string }[]
  onClose: () => void
  onSuccess: () => void
}

export default function StockMovementsPage() {
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data: movementsRes, isLoading } = useQuery({
    queryKey: ['stock-movements', page],
    queryFn: async () => {
      const res = await api.get(`/stock-movements?page=${page}`)
      return res.data
    },
  })
  const movements = movementsRes?.data as StockMovement[] | undefined
  const meta = movementsRes ? { current_page: movementsRes.current_page, last_page: movementsRes.last_page, total: movementsRes.total, per_page: movementsRes.per_page } : null

  const { data: items } = useQuery({
    queryKey: ['inventory-items-all2'],
    queryFn: async () => {
      const res = await api.get('/inventory-items')
      return (res.data.data || []) as MovementFormProps['items']
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/stock-movements/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
  })

  const columns: Column<StockMovement>[] = [
    { key: 'inventory_item', header: 'الصنف', render: (m) => m.inventoryItem?.name || '-' },
    { key: 'type', header: 'النوع', render: (m) => m.type === 'in' ? 'إدخال' : m.type === 'out' ? 'إخراج' : 'تسوية' },
    { key: 'quantity', header: 'الكمية' },
    { key: 'cost_per_unit', header: 'التكلفة/وحدة' },
    { key: 'total_cost', header: 'الإجمالي' },
    { key: 'reference_type', header: 'المرجع' },
    { key: 'created_at', header: 'التاريخ', render: (m) => formatDateTime(m.created_at) },
    { key: 'actions', header: 'الإجراءات', render: (m) => (
      <button onClick={() => deleteMutation.mutate(m.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">حركات المخزون</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> تسجيل حركة</Button>
      </div>
      <Card>
        <DataTable data={movements || []} columns={columns} loading={isLoading} emptyMessage="لا توجد حركات" />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="تسجيل حركة مخزون">
        <MovementForm items={items || []} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['stock-movements'] }) }} />
      </Modal>
    </div>
  )
}

function MovementForm({ items, onClose, onSuccess }: MovementFormProps) {
  const [formData, setFormData] = useState({
    inventory_item_id: '',
    type: 'in',
    quantity: '',
    cost_per_unit: '',
    notes: '',
  })
  const mutation = useMutation({
    mutationFn: async (data: { inventory_item_id: string; type: string; quantity: string; cost_per_unit: string; notes: string }) => { await api.post('/stock-movements', data) },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(formData) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الصنف</label>
        <select value={formData.inventory_item_id} onChange={(e) => setFormData({ ...formData, inventory_item_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
          <option value="">اختر الصنف</option>
          {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">النوع</label>
        <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
          <option value="in">إدخال</option>
          <option value="out">إخراج</option>
          <option value="adjustment">تسوية</option>
        </select>
      </div>
      <Input label="الكمية" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
      <Input label="التكلفة/وحدة" type="number" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })} />
      <Input label="ملاحظات" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>حفظ</Button>
      </div>
    </form>
  )
}