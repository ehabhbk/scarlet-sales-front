import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Pencil, Trash2, ChefHat } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import { useAuthStore } from '../../store/authStore'

interface ManagedKitchenStation {
  id: number
  name: string
  color?: string
  sort_order?: number
}

export default function KitchenStationsManagementPanel() {
  const queryClient = useQueryClient()
  const canManageStations = useAuthStore((state) => state.user?.permissions?.includes('update_kitchen_order') || false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ManagedKitchenStation | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [sortOrder, setSortOrder] = useState(0)

  const { data: stations, isLoading } = useQuery({
    queryKey: ['settings-kitchen-stations'],
    queryFn: async () => {
      const res = await api.get('/kitchen/stations')
      return (res.data?.stations || res.data?.data || []) as ManagedKitchenStation[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; sort_order: number }) => {
      if (editing) await api.put(`/kitchen/stations/${editing.id}`, data)
      else await api.post('/kitchen/stations', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-kitchen-stations'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] })
      setShowModal(false)
      setEditing(null)
      setName('')
      setColor('#3b82f6')
      setSortOrder(0)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/kitchen/stations/${id}`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-kitchen-stations'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] })
    },
  })

  const openEdit = (s: ManagedKitchenStation) => { setEditing(s); setName(s.name); setColor(s.color || '#3b82f6'); setSortOrder(s.sort_order || 0); setShowModal(true) }
  const openNew = () => { setEditing(null); setName(''); setColor('#3b82f6'); setSortOrder(0); setShowModal(true) }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 gap-3">
          <div>
            <h2 className="text-lg font-semibold dark:text-gray-100">إدارة محطات المطبخ</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">إضافة أو تعديل أو حذف محطات المطبخ.</p>
          </div>
          {canManageStations && <Button onClick={openNew}><Plus className="w-4 h-4" /> إضافة محطة</Button>}
        </div>
      </Card>
      <Card>
        {isLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}
        {!isLoading && (!stations || stations.length === 0) && <p className="text-sm text-gray-500">لا توجد محطات.</p>}
        <div className="space-y-2">
          {(stations || []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: s.color || '#3b82f6' }}>
                  <ChefHat className="h-5 w-5" />
                </span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
              </div>
              {canManageStations && <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-950/40" title="تعديل"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => { if (window.confirm(`حذف ${s.name}؟`)) deleteMutation.mutate(s.id) }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-950/40" title="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>}
            </div>
          ))}
        </div>
      </Card>
      {canManageStations && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل محطة' : 'إضافة محطة'}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ name, color, sort_order: sortOrder }) }} className="space-y-4">
          <Input label="اسم المحطة" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="اللون (hex)" value={color} onChange={(e) => setColor(e.target.value)} />
          <Input label="الترتيب" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editing ? 'تحديث' : 'إضافة'}</Button>
          </div>
        </form>
      </Modal>}
    </div>
  )
}