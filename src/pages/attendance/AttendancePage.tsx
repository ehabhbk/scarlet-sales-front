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

interface AttendanceEmployee {
  id: number
  name: string
}

interface AttendanceRecord {
  id: number
  employee?: AttendanceEmployee
  work_date: string
  check_in?: string | null
  check_out?: string | null
  work_hours?: number
  status: string
}

interface AttendanceFormProps {
  employees: AttendanceEmployee[]
  onClose: () => void
  onSuccess: () => void
}

export default function AttendancePage() {
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data: attendanceRes, isLoading } = useQuery({
    queryKey: ['attendances', page],
    queryFn: async () => {
      const res = await api.get(`/attendances?page=${page}`)
      return res.data
    },
  })
  const attendance = attendanceRes?.data
  const meta = attendanceRes ? { current_page: attendanceRes.current_page, last_page: attendanceRes.last_page, total: attendanceRes.total, per_page: attendanceRes.per_page } : null

  const { data: employees } = useQuery({
    queryKey: ['employees-all'],
    queryFn: async () => {
      const res = await api.get('/employees')
      return (res.data.data || []) as AttendanceEmployee[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/attendances/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendances'] }),
  })

  const columns: Column<AttendanceRecord>[] = [
    { key: 'employee', header: 'الموظف', render: (a) => a.employee?.name || '-' },
    { key: 'work_date', header: 'التاريخ' },
    { key: 'check_in', header: 'دخول', render: (a) => a.check_in || '-' },
    { key: 'check_out', header: 'خروج', render: (a) => a.check_out || '-' },
    { key: 'work_hours', header: 'ساعات', render: (a) => a.work_hours },
    { key: 'status', header: 'الحالة' },
    { key: 'actions', header: 'الإجراءات', render: (a) => (
      <button onClick={() => deleteMutation.mutate(a.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الحضور</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> تسجيل حضور</Button>
      </div>
      <Card>
        <DataTable data={attendance || []} columns={columns} loading={isLoading} emptyMessage="لا توجد سجلات" />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="تسجيل حضور">
        <AttendanceForm employees={employees || []} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['attendances'] }) }} />
      </Modal>
    </div>
  )
}

function AttendanceForm({ employees, onClose, onSuccess }: AttendanceFormProps) {
  const [formData, setFormData] = useState({
    employee_id: '',
    work_date: new Date().toISOString().split('T')[0],
    check_in: '',
    check_out: '',
    status: 'present',
  })
  const mutation = useMutation({
    mutationFn: async (data: { employee_id: string; work_date: string; check_in: string; check_out: string; status: string }) => { await api.post('/attendances', data) },
    onSuccess,
  })
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(formData) }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الموظف</label>
        <select value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
          <option value="">اختر الموظف</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
      </div>
      <Input label="التاريخ" type="date" value={formData.work_date} onChange={(e) => setFormData({ ...formData, work_date: e.target.value })} required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="دخول" type="time" value={formData.check_in} onChange={(e) => setFormData({ ...formData, check_in: e.target.value })} />
        <Input label="خروج" type="time" value={formData.check_out} onChange={(e) => setFormData({ ...formData, check_out: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الحالة</label>
        <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
          <option value="present">حاضر</option>
          <option value="absent">غائب</option>
          <option value="late">متأخر</option>
          <option value="half_day">نصف يوم</option>
        </select>
      </div>
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>حفظ</Button>
      </div>
    </form>
  )
}