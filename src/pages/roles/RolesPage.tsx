import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import { useAuthStore } from '../../store/authStore'

interface RoleRecord {
  id: number
  name: string
  permissions?: PermissionOption[]
}

interface PermissionOption {
  id: number
  name: string
  group: string
  label: string
}

export default function RolesPage() {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()
  const userPermissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreateRole = userPermissions.includes('create_roles')
  const canDeleteRole = userPermissions.includes('delete_roles')

  const { data: roles, isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles')
      return (res.data.roles || res.data.data || res.data || []) as RoleRecord[]
    },
  })

  const { data: permissions } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const res = await api.get('/admin/permissions')
      return (res.data.permissions || res.data.data || res.data || []) as PermissionOption[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/admin/roles/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
  })

  const columns: Column<RoleRecord>[] = [
    { key: 'name', header: 'اسم الدور' },
    { key: 'permissions', header: 'الصلاحيات', render: (r) => (r.permissions || []).length },
    ...(canDeleteRole ? [{ key: 'actions', header: 'الإجراءات', render: (r: RoleRecord) => (
      <button onClick={() => deleteMutation.mutate(r.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
    )}] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الأدوار والصلاحيات</h1>
        {canCreateRole && <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> إضافة دور</Button>}
      </div>
      <Card>
        <DataTable data={roles || []} columns={columns} loading={isLoading} emptyMessage="لا توجد أدوار" />
      </Card>
      {canCreateRole && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="إضافة دور" size="lg">
        <RoleForm permissions={permissions || []} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['admin-roles'] }) }} />
      </Modal>}
    </div>
  )
}

function RoleForm({
  permissions,
  onClose,
  onSuccess,
}: {
  permissions: PermissionOption[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({ name: '', selected: [] as string[] })
  const groupedPermissions = permissions.reduce<Record<string, PermissionOption[]>>((groups, permission) => {
    const group = permission.group || 'صلاحيات إضافية'
    groups[group] = [...(groups[group] || []), permission]
    return groups
  }, {})
  const mutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => { await api.post('/admin/roles', data) },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ name: formData.name, permissions: formData.selected })
  }
  const toggle = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      selected: prev.selected.includes(name) ? prev.selected.filter((n) => n !== name) : [...prev.selected, name],
    }))
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="اسم الدور" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الصلاحيات</label>
        <div className="max-h-[28rem] overflow-y-auto space-y-4 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
          {Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
            <section key={group}>
              <h3 className="mb-2 border-b border-gray-100 dark:border-gray-800 pb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{group}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {groupPermissions.map((permission) => (
                  <label key={permission.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.selected.includes(permission.name)}
                      onChange={() => toggle(permission.name)}
                    />
                    {permission.label || 'صلاحية مخصصة'}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>حفظ</Button>
      </div>
    </form>
  )
}