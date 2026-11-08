import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { Plus, Trash2, UserRound, Pencil, Power, PowerOff } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import { mediaUrl } from '../../store/settingsStore'
import type { User } from '../../types'
import { getApiErrorMessage } from '../../utils/apiError'

interface Account {
  id: number
  code: string
  name: string
  type: string
  parent_id?: number | string | null
  is_active?: boolean
}

interface UserFormValues {
  name: string
  username: string
  password: string
  role: string
  is_active: boolean
  pay_account_id: string
  revenue_account_id: string
  kitchen_station_id: string
}

interface UserRoleOption {
  id: number
  name: string
}

interface KitchenStationOption {
  id: number
  name: string
  display_name?: string
}

interface UserFormProps {
  roles: UserRoleOption[]
  accounts: Account[]
  kitchenStations: KitchenStationOption[]
  onClose: () => void
  onSuccess: () => void
}

export default function UsersPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users')
      return (res.data.data || res.data) as User[]
    },
  })

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles')
      return (res.data.roles || res.data.data || res.data) as UserRoleOption[]
    },
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async (): Promise<Account[]> => {
      const res = await api.get('/accounts')
      return (res.data?.accounts || res.data?.data || []) as Account[]
    },
  })

  const { data: kitchenStations } = useQuery({
    queryKey: ['admin-kitchen-stations'],
    queryFn: async () => {
      const res = await api.get('/admin/kitchen-stations')
      return (res.data.stations || []) as KitchenStationOption[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('تم حذف المستخدم')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'تعذر حذف المستخدم'))
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      await api.put(`/admin/users/${id}`, { is_active })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('تم تحديث حالة المستخدم')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'تعذر تحديث الحالة'))
    },
  })

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'الاسم',
      render: (u) => (
        <div className="flex items-center gap-2">
          {(u.image || u.avatar) ? (
            <img src={mediaUrl(u.image || u.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" />
            </span>
          )}
          <span className="font-medium">{u.name}</span>
        </div>
      ),
    },
    {
      key: 'account_links',
      header: 'حسابات الربط',
      render: (u: User) => {
        const cashier = (u.roles || []).some((role) => isCashierRole(role.name || ''))
        const payAccount = u.pay_account?.name || accounts?.find((account) => Number(account.id) === Number(u.pay_account_id))?.name
        const revenueAccount = u.revenue_account?.name || accounts?.find((account) => Number(account.id) === Number(u.revenue_account_id))?.name
        if (!cashier) return payAccount || '-'
        return (
          <div className="space-y-1 text-xs">
            <p>مصروف الأجر: {payAccount || 'غير مربوط'}</p>
            <p>حساب الإيراد: {revenueAccount || 'غير مربوط'}</p>
          </div>
        )
      },
    },
    {
      key: 'username',
      header: 'اسم المستخدم',
      render: (u) => (
        <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
          {u.username ? `@${u.username}` : '-'}
        </span>
      ),
    },
    {
      key: 'roles',
      header: 'الدور',
      render: (u) => (
        <div className="flex gap-1 flex-wrap">
          {(u.roles || []).map((r) => (
            <Badge key={r.id} variant="info">
              {r.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'الحالة',
      render: (u) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
            u.is_active
              ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
          }`}
        >
          {u.is_active ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      render: (u) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
            className={`p-1.5 rounded ${
              u.is_active
                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 dark:text-amber-400'
                : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 dark:text-green-400'
            }`}
            title={u.is_active ? 'تعطيل' : 'تفعيل'}
          >
            {u.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setEditingUser(u)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded dark:text-blue-400"
            title="تعديل"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`هل تريد حذف المستخدم ${u.name}؟`)) {
                deleteMutation.mutate(u.id)
              }
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded dark:text-red-400"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  const list = users || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المستخدمون</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            إدارة حسابات الدخول وأدوار الموظفين
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> إضافة مستخدم
        </Button>
      </div>
      <Card>
        <DataTable data={list} columns={columns} loading={isLoading} emptyMessage="لا يوجد مستخدمون" />
      </Card>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="إضافة مستخدم">
        <UserForm
          roles={roles || []}
          accounts={accounts || []}
          kitchenStations={kitchenStations || []}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['admin-users'] })
            queryClient.invalidateQueries({ queryKey: ['accounts-list'] })
            queryClient.invalidateQueries({ queryKey: ['settings-accounts'] })
            queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
            queryClient.invalidateQueries({ queryKey: ['users-all'] })
          }}
        />
      </Modal>
      <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="تعديل مستخدم">
        {editingUser && (
          <EditUserForm
            user={editingUser}
            roles={roles || []}
            accounts={accounts || []}
            kitchenStations={kitchenStations || []}
            onClose={() => setEditingUser(null)}
            onSuccess={() => {
              setEditingUser(null)
              queryClient.invalidateQueries({ queryKey: ['admin-users'] })
              queryClient.invalidateQueries({ queryKey: ['accounts-list'] })
              queryClient.invalidateQueries({ queryKey: ['settings-accounts'] })
              queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
              queryClient.invalidateQueries({ queryKey: ['users-all'] })
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function isCashierRole(role: string) {
  const normalized = role.trim().toLowerCase().replace(/[\s_-]/g, '')
  return normalized.includes('cashier') || normalized.includes('كاشير')
}

function isChefRole(role: string) {
  const normalized = role.trim().toLowerCase()
  return normalized === 'chef' || normalized === 'شيف' || normalized === 'طباخ'
}

function CashierAccountsNotice() {
  return (
    <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        اختر حساب مصروف الأجر وحساب إيراد المبيعات، أو اترك حساب الإيراد على الإنشاء التلقائي ليُنشئ النظام حساب إيراد فرعياً باسم المستخدم تحت حساب إيرادات المبيعات ويربطه به عند الحفظ.
      </p>
    </div>
  )
}

function UserAccountFields({ accounts, cashier, formData, setFormData }: {
  accounts: Account[]
  cashier: boolean
  formData: UserFormValues
  setFormData: React.Dispatch<React.SetStateAction<UserFormValues>>
}) {
  const expenseAccounts = accounts.filter((account) => account.type === 'expense' && account.is_active)
  const revenueAccounts = accounts.filter((account) =>
    account.type === 'revenue' && account.is_active && account.parent_id
  )

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">حساب مصروف الأجر</label>
        <select
          value={formData.pay_account_id}
          onChange={(event) => setFormData({ ...formData, pay_account_id: event.target.value })}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">بدون تحديد (افتراضي)</option>
          {expenseAccounts.map((account: Account) => (
            <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
          ))}
        </select>
      </div>
      {cashier && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">حساب إيراد المبيعات</label>
          <select
            value={formData.revenue_account_id}
            onChange={(event) => setFormData({ ...formData, revenue_account_id: event.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">إنشاء حساب إيراد فرعي باسم المستخدم تلقائيًا</option>
            {revenueAccounts.map((account: Account) => (
              <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function CashierAccountSummary({ user }: { user: User }) {
  return (
    <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/20">
      <p>حساب مصروف الأجر: {user.pay_account?.name || 'غير مربوط'}</p>
      <p>حساب إيراد المبيعات: {user.revenue_account?.name || 'غير مربوط'}</p>
    </div>
  )
}

function UserForm({ roles, accounts, kitchenStations, onClose, onSuccess }: UserFormProps) {
  const [formData, setFormData] = useState<UserFormValues>({
    name: '',
    username: '',
    password: '',
    role: '',
    is_active: true,
    pay_account_id: '',
    revenue_account_id: '',
    kitchen_station_id: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (imageFile) {
        const requestData = new FormData()
        Object.entries(data).forEach(([key, value]) =>
          requestData.append(key, value === null || value === undefined ? '' : key === 'is_active' ? (value ? '1' : '0') : String(value))
        )
        requestData.append('image_file', imageFile)
        await api.post('/admin/users', requestData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        await api.post('/admin/users', data)
      }
    },
    onSuccess: () => {
      toast.success('تم إضافة المستخدم')
      onSuccess()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر إضافة المستخدم')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      ...formData,
      username: formData.username.trim().toLowerCase(),
      pay_account_id: formData.pay_account_id ? Number(formData.pay_account_id) : null,
      revenue_account_id: formData.revenue_account_id ? Number(formData.revenue_account_id) : null,
      kitchen_station_id: isChefRole(formData.role) && formData.kitchen_station_id
        ? Number(formData.kitchen_station_id)
        : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="الاسم"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">صورة المستخدم</label>
        {imagePreview && <img src={imagePreview} alt="معاينة صورة المستخدم" className="mb-3 h-20 w-20 rounded-full object-cover" />}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            setImageFile(file)
            setImagePreview(file ? URL.createObjectURL(file) : '')
          }}
          className="block w-full text-sm"
        />
      </div>
      <Input
        label="اسم المستخدم"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
        placeholder="cashier1"
        autoComplete="off"
        required
      />
      <Input
        label="كلمة المرور"
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        autoComplete="new-password"
        required
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          الدور
        </label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          required
        >
          <option value="">اختر الدور</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {isChefRole(formData.role) && (
        <KitchenStationField
          stations={kitchenStations}
          value={formData.kitchen_station_id}
          onChange={(value: string) => setFormData({ ...formData, kitchen_station_id: value })}
        />
      )}
      {isCashierRole(formData.role) && (
        <CashierAccountsNotice />
      )}
      <UserAccountFields
        accounts={accounts}
        cashier={isCashierRole(formData.role)}
        formData={formData}
        setFormData={setFormData}
      />
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="rounded border-gray-300 dark:border-gray-700"
        />
        الحساب نشط
      </label>
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          حفظ
        </Button>
      </div>
    </form>
  )
}

function EditUserForm({ user, roles, accounts, kitchenStations, onClose, onSuccess }: UserFormProps & { user: User }) {
  const [formData, setFormData] = useState<UserFormValues>({
    name: user.name || '',
    username: user.username || '',
    password: '',
    role: (user.roles && user.roles[0]?.name) || '',
    is_active: user.is_active ?? true,
    pay_account_id: user.pay_account_id ? String(user.pay_account_id) : '',
    revenue_account_id: user.revenue_account_id ? String(user.revenue_account_id) : '',
    kitchen_station_id: user.kitchen_station_id ? String(user.kitchen_station_id) : '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(
    user.image || user.avatar ? mediaUrl(user.image || user.avatar) : ''
  )

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (imageFile) {
        const requestData = new FormData()
        Object.entries(data).forEach(([key, value]) =>
          requestData.append(key, value === null || value === undefined ? '' : key === 'is_active' ? (value ? '1' : '0') : String(value))
        )
        requestData.append('_method', 'PUT')
        requestData.append('image_file', imageFile)
        await api.post(`/admin/users/${user.id}`, requestData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        await api.put(`/admin/users/${user.id}`, data)
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث المستخدم')
      onSuccess()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر تحديث المستخدم')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: {
      name: string
      username: string
      role: string
      is_active: boolean
      pay_account_id: number | null
      revenue_account_id: number | null
      kitchen_station_id: number | null
      password?: string
    } = {
      name: formData.name,
      username: formData.username.trim().toLowerCase(),
      role: formData.role,
      is_active: formData.is_active,
      pay_account_id: formData.pay_account_id ? Number(formData.pay_account_id) : null,
      revenue_account_id: formData.revenue_account_id ? Number(formData.revenue_account_id) : null,
      kitchen_station_id: isChefRole(formData.role) && formData.kitchen_station_id
        ? Number(formData.kitchen_station_id)
        : null,
    }
    if (formData.password) payload.password = formData.password
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="الاسم"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">صورة المستخدم</label>
        {imagePreview && <img src={imagePreview} alt="معاينة صورة المستخدم" className="mb-3 h-20 w-20 rounded-full object-cover" />}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            setImageFile(file)
            setImagePreview(file ? URL.createObjectURL(file) : mediaUrl(user.image || user.avatar))
          }}
          className="block w-full text-sm"
        />
      </div>
      <Input
        label="اسم المستخدم"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
        required
      />
      <Input
        label="كلمة المرور (اتركها فارغة للإبقاء)"
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        autoComplete="new-password"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          الدور
        </label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          required
        >
          <option value="">اختر الدور</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {isChefRole(formData.role) && (
        <KitchenStationField
          stations={kitchenStations}
          value={formData.kitchen_station_id}
          onChange={(value: string) => setFormData({ ...formData, kitchen_station_id: value })}
        />
      )}
      {isCashierRole(formData.role) && (
        <CashierAccountSummary user={user} />
      )}
      <UserAccountFields
        accounts={accounts}
        cashier={isCashierRole(formData.role)}
        formData={formData}
        setFormData={setFormData}
      />
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="rounded border-gray-300 dark:border-gray-700"
        />
        الحساب نشط
      </label>
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          حفظ التغييرات
        </Button>
      </div>
    </form>
  )
}

function KitchenStationField({ stations, value, onChange }: {
  stations: KitchenStationOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
        محطة المطبخ
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
        required
      >
        <option value="">اختر محطة المطبخ</option>
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.display_name || station.name}
          </option>
        ))}
      </select>
    </div>
  )
}