import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { Plus, Trash2, Printer } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Pagination from '../../components/common/Pagination'
import { useAuthStore } from '../../store/authStore'
import { formatDate } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'
import { printReport } from '../../utils/printReport'

interface ExpenseFormProps {
  accounts: { id: number; code: string; name: string; type: string; is_active: boolean }[]
  paymentMethods: { value: string; label: string }[]
  onClose: () => void
  onSuccess: () => void
}

interface ExpenseRecord {
  id: number
  category: string
  amount: number
  account?: { name: string }
  expense_date: string
  description?: string
  is_approved: boolean
}

export default function ExpensesPage() {
  const { symbol, paymentMethods } = useSettingsStore()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_expenses')
  const canDelete = permissions.includes('delete_expenses')
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const queryClient = useQueryClient()
  const { restaurant } = useSettingsStore()

  const { data: expensesRes, isLoading } = useQuery({
    queryKey: ['expenses', page, search, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (search) params.set('search', search)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const res = await api.get(`/expenses?${params.toString()}`)
      return res.data
    },
  })
  const expenses = expensesRes?.data
  const expensesMeta = expensesRes ? { current_page: expensesRes.current_page, last_page: expensesRes.last_page, total: expensesRes.total, per_page: expensesRes.per_page } : null
  const { data: accounts } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => (await api.get('/accounts')).data?.accounts || [],
  })

  const handlePrint = () => {
    const rows = (expenses || []).map((e: ExpenseRecord) => [
      e.category,
      formatMoney(e.amount, symbol),
      e.account?.name || '-',
      formatDate(e.expense_date),
      e.description || '-',
      e.is_approved ? 'نعم' : 'لا',
    ])
    printReport({
      title: 'تقرير المصروفات',
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'الفترة', value: `${fromDate || 'البداية'} — ${toDate || 'اليوم'}` },
        { label: 'البحث', value: search || 'الكل' },
      ],
      sections: [{
        title: 'المصروفات',
        columns: [
          { label: 'الفئة' },
          { label: 'المبلغ' },
          { label: 'الحساب' },
          { label: 'التاريخ' },
          { label: 'الوصف' },
          { label: 'معتمد' },
        ],
        rows,
      }],
      generatedAt: new Date(),
    })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/expenses/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const columns: Column<ExpenseRecord>[] = [
    { key: 'category', header: 'الفئة' },
    { key: 'amount', header: 'المبلغ', render: (e) => formatMoney(e.amount, symbol) },
    { key: 'account', header: 'الحساب', render: (e) => e.account?.name || '-' },
    { key: 'expense_date', header: 'التاريخ', render: (e) => formatDate(e.expense_date) },
    { key: 'description', header: 'الوصف' },
    { key: 'is_approved', header: 'معتمد', render: (e) => e.is_approved ? 'نعم' : 'لا' },
    ...(canDelete ? [{ key: 'actions', header: 'الإجراءات', render: (e: ExpenseRecord) => (
      <button onClick={() => deleteMutation.mutate(e.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 className="w-4 h-4" /></button>
    )}] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المصروفات</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4" /> طباعة / PDF</Button>
          {canCreate && <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> إضافة مصروف</Button>}
        </div>
      </div>
      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input label="بحث بالوصف/الفئة" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          <Input label="من تاريخ" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1) }} />
          <Input label="إلى تاريخ" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1) }} />
        </div>
        <DataTable data={expenses || []} columns={columns} loading={isLoading} emptyMessage="لا توجد مصروفات" />
        <Pagination meta={expensesMeta} onPageChange={setPage} />
      </Card>
      {canCreate && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="إضافة مصروف">
        <ExpenseForm accounts={accounts || []} paymentMethods={paymentMethods} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['journal-entries'] }); queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }) }} />
      </Modal>}
    </div>
  )
}

function ExpenseForm({ accounts, paymentMethods, onClose, onSuccess }: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    account_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    payment_method: paymentMethods[0]?.value || '',
  })
  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => { await api.post('/expenses', data) },
    onSuccess,
    onError: (error) => window.alert(getApiErrorMessage(error, 'تعذر حفظ المصروف')),
  })
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ ...formData, amount: Number(formData.amount), account_id: Number(formData.account_id) })
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="الفئة" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required />
      <Input label="المبلغ" type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حساب المصروف</label>
        <select value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
          <option value="">اختر حساب المصروف</option>
          {accounts.filter((a) => a.type === 'expense' && a.is_active).map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">طريقة الدفع</label>
        <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
          {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
        </select>
      </div>
      <Input label="التاريخ" type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} required />
      <Input label="الوصف" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>حفظ</Button>
      </div>
    </form>
  )
}