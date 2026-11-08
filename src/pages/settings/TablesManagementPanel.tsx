import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Pencil, Trash2, Table as TableIcon } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import { useAuthStore } from '../../store/authStore'

interface ManagedTable {
  id: number
  name: string
  area_id?: number | string
  capacity: number
  status: string
  area?: { name: string }
}

interface TableFormProps {
  table: ManagedTable | null
  areas: { id: number; name: string }[]
  onClose: () => void
  onSuccess: () => void
}

const STATUS_LABELS: Record<string, string> = {
  available: 'متاحة',
  occupied: 'مشغولة',
  reserved: 'محجوزة',
  cleaning: 'قيد التنظيف',
}

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  available: 'success',
  occupied: 'danger',
  reserved: 'warning',
  cleaning: 'info',
}

export default function TablesManagementPanel() {
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_tables')
  const canEdit = permissions.includes('edit_tables')
  const canDelete = permissions.includes('delete_tables')
  const [showModal, setShowModal] = useState(false)
  const [editingTable, setEditingTable] = useState<ManagedTable | null>(null)

  const { data: tables, isLoading } = useQuery({
    queryKey: ['settings-tables'],
    queryFn: async () => {
      const res = await api.get('/tables', { params: { per_page: 100 } })
      const payload = res.data
      return (Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []) as ManagedTable[]
    },
  })

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const res = await api.get('/areas')
      return (res.data?.areas || res.data?.data || []) as TableFormProps['areas']
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/tables/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables-all'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await api.put(`/tables/${id}`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables-all'] })
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 gap-3">
          <div>
            <h2 className="text-lg font-semibold dark:text-gray-100">إدارة الطاولات</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              إضافة طاولة جديدة أو تعديل اسمها وسعتها وحالتها أو حذفها.
            </p>
          </div>
          {canCreate && <Button
            onClick={() => {
              setEditingTable(null)
              setShowModal(true)
            }}
          >
            <Plus className="w-4 h-4" />
            إضافة طاولة
          </Button>}
        </div>
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}
        {!isLoading && (!tables || tables.length === 0) && (
          <p className="text-sm text-gray-500">لا توجد طاولات.</p>
        )}
        <div className="space-y-3">
          {(tables || []).map((table) => (
            <div
              key={table.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TableIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{table.name}</p>
                  <p className="text-xs text-gray-500">
                    {table.area?.name || 'بدون منطقة'} • السعة: {table.capacity}
                  </p>
                </div>
                <Badge variant={STATUS_COLORS[table.status] || 'default'}>
                  {STATUS_LABELS[table.status] || table.status}
                </Badge>
              </div>

              {(canEdit || canDelete) && <div className="flex flex-wrap items-center gap-2">
                {canEdit && <select
                  value={table.status}
                  onChange={(e) =>
                    statusMutation.mutate({ id: table.id, status: e.target.value })
                  }
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="available">متاح</option>
                  <option value="occupied">مشغول</option>
                  <option value="reserved">محجوز</option>
                  <option value="cleaning">تنظيف</option>
                </select>}
                {canEdit && <button
                  onClick={() => {
                    setEditingTable(table)
                    setShowModal(true)
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:hover:bg-blue-500/10 dark:text-blue-400"
                  title="تعديل"
                >
                  <Pencil className="w-4 h-4" />
                </button>}
                {canDelete && <button
                  onClick={() => {
                    if (window.confirm(`هل تريد حذف ${table.name}؟`)) {
                      deleteMutation.mutate(table.id)
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-500/10 dark:text-red-400"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>}
              </div>}
            </div>
          ))}
        </div>
      </Card>

      {(canCreate || canEdit) && <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTable ? 'تعديل طاولة' : 'إضافة طاولة جديدة'}
      >
        <TableForm
          table={editingTable}
          areas={areas || []}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['settings-tables'] })
            queryClient.invalidateQueries({ queryKey: ['tables'] })
            queryClient.invalidateQueries({ queryKey: ['tables-all'] })
          }}
        />
      </Modal>}
    </div>
  )
}

function TableForm({ table, areas, onClose, onSuccess }: TableFormProps) {
  const [formData, setFormData] = useState({
    name: table?.name || '',
    area_id: table?.area_id || '',
    capacity: table?.capacity || 4,
    status: table?.status || 'available',
  })

  const mutation = useMutation({
    mutationFn: async (data: { name: string; area_id: number | string; capacity: number; status: string }) => {
      if (table) {
        await api.put(`/tables/${table.id}`, data)
      } else {
        await api.post('/tables', data)
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
        label="اسم الطاولة"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">المنطقة</label>
        <select
          value={formData.area_id}
          onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">اختر المنطقة</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>{area.name}</option>
          ))}
        </select>
      </div>

      <Input
        label="السعة (عدد الكراسي)"
        type="number"
        min={1}
        value={formData.capacity}
        onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) || 1 })}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">الحالة</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="available">متاح</option>
          <option value="occupied">مشغول</option>
          <option value="reserved">محجوز</option>
          <option value="cleaning">تنظيف</option>
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>
          {table ? 'تحديث' : 'إضافة'}
        </Button>
      </div>
    </form>
  )
}