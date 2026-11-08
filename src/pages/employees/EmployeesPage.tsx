import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { Plus, Search, Edit, Trash2, DollarSign } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import Pagination from '../../components/common/Pagination'
import { getApiErrorMessage } from '../../utils/apiError'

interface EmployeeRecord {
  id: number
  user_id?: number
  employee_id: string
  name: string
  job_title: string
  phone?: string
  email?: string
  hire_date: string
  salary: number
  pay_type: string
  pay_rate: number
  pay_day: number
  pay_account_id?: number
  pay_auto: boolean
  status: string
  user?: { pay_account_id?: number; pay_account?: { name: string } }
  pay_account?: { name: string }
}

interface EmployeeFormProps {
  employee: EmployeeRecord | null
  accounts: { id: number; code: string; name: string; type: string; is_active: boolean }[]
  users: { id: number; name: string; username?: string }[]
  onClose: () => void
  onSuccess: () => void
}

export default function EmployeesPage() {
  const { symbol, paymentMethods } = useSettingsStore()
  const canPayEmployeeWages = useAuthStore((state) => state.user?.permissions?.includes('pay_employee_wages') ?? false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null)
  const queryClient = useQueryClient()

  const { data: employeesRes, isLoading } = useQuery({
    queryKey: ['employees', search, page],
    queryFn: async () => {
      const res = await api.get(`/employees?search=${search}&page=${page}`)
      return res.data
    },
  })

  const { data: accountsList } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => {
      const res = await api.get('/accounts')
      return res.data?.accounts || []
    },
  })
  const { data: usersResponse } = useQuery({
    queryKey: ['users-all'],
    queryFn: async () => (await api.get('/admin/users?per_page=100')).data,
  })
  const employees = employeesRes?.data
  const users = usersResponse?.data || []
  const employeesMeta = employeesRes ? { current_page: employeesRes.current_page, last_page: employeesRes.last_page, total: employeesRes.total, per_page: employeesRes.per_page } : null

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/employees/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })

  const paySalaryMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!paymentMethods[0]?.value) {
        throw new Error('لا توجد طريقة دفع مهيأة في الإعدادات')
      }
      const res = await api.post(`/employees/${id}/pay-salary`, {
        payment_method: paymentMethods[0].value,
      })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      alert(data?.message || 'تم دفع الراتب')
    },
    onError: (error) => alert(getApiErrorMessage(error, 'تعذر دفع الراتب')),
  })

  const statusColors: Record<string, 'success' | 'warning' | 'danger'> = {
    active: 'success',
    on_leave: 'warning',
    terminated: 'danger',
  }

  const columns: Column<EmployeeRecord>[] = [
    { key: 'employee_id', header: 'رقم الموظف' },
    { key: 'name', header: 'اسم الموظف' },
    { key: 'job_title', header: 'الوظيفة' },
    { key: 'phone', header: 'الهاتف' },
    { key: 'salary', header: 'الراتب', render: (item) => formatMoney(item.salary, symbol) },
    { key: 'pay_account', header: 'حساب الأجر', render: (item) => item.pay_account?.name || item.user?.pay_account?.name || '-' },
    { key: 'status', header: 'الحالة', render: (item) => (
      <Badge variant={statusColors[item.status] || 'default'}>{item.status}</Badge>
    )},
    { key: 'actions', header: 'الإجراءات', render: (item) => (
      <div className="flex gap-2">
        {canPayEmployeeWages && item.pay_type === 'monthly' && (
          <button onClick={() => paySalaryMutation.mutate(item.id)} className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 rounded" title="دفع الراتب">
            <DollarSign className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => { setEditingEmployee(item); setShowModal(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded">
          <Edit className="w-4 h-4" />
        </button>
        <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الموظفون</h1>
        <Button onClick={() => { setEditingEmployee(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" />
          إضافة موظف
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input
            placeholder="بحث عن موظف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-5 h-5" />}
          />
        </div>

        <DataTable
          data={employees || []}
          columns={columns}
          loading={isLoading}
          emptyMessage="لا توجد موظفين"
        />
        <Pagination meta={employeesMeta} onPageChange={setPage} />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEmployee ? 'تعديل موظف' : 'إضافة موظف جديد'}
      >
        <EmployeeForm
          employee={editingEmployee}
          accounts={(accountsList || []).filter((account: EmployeeFormProps['accounts'][number]) => account.type === 'expense' && account.is_active)}
          users={users}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['employees'] })
          }}
        />
      </Modal>
    </div>
  )
}

function EmployeeForm({ employee, accounts, users, onClose, onSuccess }: EmployeeFormProps) {
  const [formData, setFormData] = useState<{
    user_id: string | number
    employee_id: string
    name: string
    job_title: string
    phone: string
    email: string
    hire_date: string
    salary: number | string
    pay_type: string
    pay_rate: number | string
    pay_day: number | string
    pay_account_id: string | number
    pay_auto: boolean
    status: string
  }>({
    user_id: employee?.user_id || '',
    employee_id: employee?.employee_id || '',
    name: employee?.name || '',
    job_title: employee?.job_title || '',
    phone: employee?.phone || '',
    email: employee?.email || '',
    hire_date: employee?.hire_date || new Date().toISOString().split('T')[0],
    salary: employee?.salary || 0,
    pay_type: employee?.pay_type || 'monthly',
    pay_rate: employee?.pay_rate || 0,
    pay_day: employee?.pay_day || 1,
    pay_account_id: employee?.pay_account_id || employee?.user?.pay_account_id || '',
    pay_auto: employee?.pay_auto ?? true,
    status: employee?.status || 'active',
  })

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (employee) {
        await api.put(`/employees/${employee.id}`, data)
      } else {
        await api.post('/employees', data)
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="رقم الموظف"
          value={formData.employee_id}
          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
          required
        />
        <Input
          label="اسم الموظف"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      
      <Input
        label="الوظيفة"
        value={formData.job_title}
        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حساب المستخدم المرتبط</label>
        <select
          value={formData.user_id}
          onChange={(e) => setFormData({ ...formData, user_id: e.target.value ? Number(e.target.value) : '' })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
        >
          <option value="">بدون مستخدم</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name} (@{user.username})</option>
          ))}
        </select>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="الهاتف"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <Input
          label="البريد الإلكتروني"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="تاريخ التعيين"
          type="date"
          value={formData.hire_date}
          onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
          required
        />
        <Input
          label="الراتب"
          type="number"
          value={formData.salary}
          onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نوع الأجر</label>
        <select
          value={formData.pay_type}
          onChange={(e) => setFormData({ ...formData, pay_type: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
        >
          <option value="monthly">راتب شهري</option>
          <option value="daily">يومية</option>
          <option value="percentage">نسبة من المبيعات</option>
        </select>
      </div>

      {formData.pay_type === 'monthly' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="الراتب الشهري"
            type="number"
            value={formData.salary}
            onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
          />
          <Input
            label="يوم تسليم الراتب (1-31)"
            type="number"
            min={1}
            max={31}
            value={formData.pay_day}
            onChange={(e) => setFormData({ ...formData, pay_day: Number(e.target.value) || 1 })}
          />
        </div>
      )}

      {(formData.pay_type === 'daily' || formData.pay_type === 'percentage') && (
        <Input
          label={formData.pay_type === 'daily' ? 'الأجر اليومي' : 'النسبة (%)'}
          type="number"
          value={formData.pay_rate}
          onChange={(e) => setFormData({ ...formData, pay_rate: e.target.value })}
        />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حساب مصروف الأجر ({formData.pay_type === 'monthly' ? 'راتب' : formData.pay_type === 'daily' ? 'يومية' : 'نسبة'})</label>
        <select
          value={formData.pay_account_id}
          onChange={(e) => setFormData({ ...formData, pay_account_id: e.target.value ? Number(e.target.value) : '' })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
        >
          <option value="">الحساب الافتراضي</option>
          {(accounts || []).map((a) => (
            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
          ))}
        </select>
      </div>

      {(formData.pay_type === 'daily' || formData.pay_type === 'percentage') && <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.pay_auto}
            onChange={(e) => setFormData({ ...formData, pay_auto: e.target.checked })}
          />
          ترحيل تلقائي عند إغلاق الوردية (لليومية/النسبة)
        </label>
      </div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الحالة</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
        >
          <option value="active">نشط</option>
          <option value="on_leave">في إجازة</option>
          <option value="terminated">منتهي</option>
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>
          {employee ? 'تحديث' : 'إضافة'}
        </Button>
      </div>
    </form>
  )
}
