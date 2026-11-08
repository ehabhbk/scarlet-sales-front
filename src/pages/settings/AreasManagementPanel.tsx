import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import { useAuthStore } from '../../store/authStore'

interface ManagedArea {
  id: number
  name: string
}

export default function AreasManagementPanel() {
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_tables')
  const canEdit = permissions.includes('edit_tables')
  const canDelete = permissions.includes('delete_tables')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ManagedArea | null>(null)
  const [name, setName] = useState('')

  const { data: areas, isLoading } = useQuery({
    queryKey: ['settings-areas'],
    queryFn: async () => {
      const res = await api.get('/areas')
      return (res.data?.areas || res.data?.data || []) as ManagedArea[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      if (editing) await api.put(`/areas/${editing.id}`, data)
      else await api.post('/areas', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-areas'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
      setShowModal(false)
      setEditing(null)
      setName('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/areas/${id}`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-areas'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
    },
  })

  const openEdit = (area: ManagedArea) => { setEditing(area); setName(area.name); setShowModal(true) }
  const openNew = () => { setEditing(null); setName(''); setShowModal(true) }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 gap-3">
          <div>
            <h2 className="text-lg font-semibold dark:text-gray-100">إدارة المناطق</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">إضافة أو تعديل أو حذف مناطق المطعم.</p>
          </div>
          {canCreate && <Button onClick={openNew}><Plus className="w-4 h-4" /> إضافة منطقة</Button>}
        </div>
      </Card>
      <Card>
        {isLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}
        {!isLoading && (!areas || areas.length === 0) && <p className="text-sm text-gray-500">لا توجد مناطق.</p>}
        <div className="space-y-2">
          {(areas || []).map((area) => (
            <div key={area.id} className="flex flex-wrap items-center justify-between gap-2 gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{area.name}</p>
              </div>
              {(canEdit || canDelete) && <div className="flex gap-2">
                {canEdit && <button onClick={() => openEdit(area)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-950/40" title="تعديل"><Pencil className="w-4 h-4" /></button>}
                {canDelete && <button onClick={() => { if (window.confirm(`حذف ${area.name}؟`)) deleteMutation.mutate(area.id) }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-950/40" title="حذف"><Trash2 className="w-4 h-4" /></button>}
              </div>}
            </div>
          ))}
        </div>
      </Card>
      {(canCreate || canEdit) && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل منطقة' : 'إضافة منطقة'}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ name }) }} className="space-y-4">
          <Input label="اسم المنطقة" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editing ? 'تحديث' : 'إضافة'}</Button>
          </div>
        </form>
      </Modal>}
    </div>
  )
}