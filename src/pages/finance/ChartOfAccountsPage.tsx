import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Printer } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { printReport } from '../../utils/printReport'
import { formatDate } from '../../utils/format'

interface Account {
  id: number
  code: string
  name: string
  type: string
  parent_id: number | null
  opening_balance: number
  balance: number
  is_active: boolean
  notes?: string
}

interface AccountPayload {
  code: string
  name: string
  type: string
  parent_id: number | null
  opening_balance: number
  is_active: boolean
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'أصل',
  liability: 'التزام',
  equity: 'حقوق ملكية',
  revenue: 'إيراد',
  expense: 'مصروف',
}

const TYPE_COLORS: Record<string, string> = {
  asset: 'text-blue-600 dark:text-blue-400',
  liability: 'text-red-600 dark:text-red-400',
  equity: 'text-purple-600 dark:text-purple-400',
  revenue: 'text-green-600 dark:text-green-400',
  expense: 'text-amber-600 dark:text-amber-400',
}

const EMPTY_ACCOUNTS: Account[] = []

export default function ChartOfAccountsPage() {
  const { symbol, restaurant } = useSettingsStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [expandedOverrides, setExpandedOverrides] = useState<{ expanded: Set<number>; collapsed: Set<number> }>({
    expanded: new Set(),
    collapsed: new Set(),
  })
  const [form, setForm] = useState({ code: '', name: '', type: 'asset', parent_id: '', opening_balance: 0, is_active: true, notes: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const res = await api.get('/accounting/chart-of-accounts')
      return (res.data?.accounts || []) as Account[]
    },
  })

  const accounts = data ?? EMPTY_ACCOUNTS
  const parentIds = useMemo(
    () => new Set(accounts.flatMap((account) => account.parent_id == null ? [] : [account.parent_id])),
    [accounts]
  )
  const expanded = useMemo(
    () => new Set([
      ...[...parentIds].filter((id) => !expandedOverrides.collapsed.has(id)),
      ...expandedOverrides.expanded,
    ]),
    [parentIds, expandedOverrides]
  )

  const saveMutation = useMutation({
    mutationFn: async (d: AccountPayload) => {
      if (editing) await api.put(`/accounts/${editing.id}`, d)
      else await api.post('/accounts', d)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      setShowModal(false)
      setEditing(null)
      setForm({ code: '', name: '', type: 'asset', parent_id: '', opening_balance: 0, is_active: true, notes: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/accounts/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }),
  })

  const childrenOf = (parentId: number | null) => accounts.filter((a) => (a.parent_id ?? null) === parentId)

  const toggle = (id: number) => {
    setExpandedOverrides((previous) => {
      const nextExpanded = new Set(previous.expanded)
      const nextCollapsed = new Set(previous.collapsed)
      if (expanded.has(id)) {
        nextExpanded.delete(id)
        if (parentIds.has(id)) nextCollapsed.add(id)
      } else {
        nextCollapsed.delete(id)
        nextExpanded.add(id)
      }
      return { expanded: nextExpanded, collapsed: nextCollapsed }
    })
  }

  const openNew = (parentId: number | null = null) => {
    setEditing(null)
    setForm({ code: '', name: '', type: 'asset', parent_id: parentId ? String(parentId) : '', opening_balance: 0, is_active: true, notes: '' })
    setShowModal(true)
  }

  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({ code: a.code, name: a.name, type: a.type, parent_id: a.parent_id ? String(a.parent_id) : '', opening_balance: a.opening_balance || 0, is_active: a.is_active, notes: a.notes || '' })
    setShowModal(true)
  }

  const renderNode = (account: Account, depth = 0) => {
    const kids = childrenOf(account.id)
    const hasKids = kids.length > 0
    const isExpanded = expanded.has(account.id)
    return (
      <div key={account.id}>
        <div className="flex flex-wrap items-center justify-between gap-2 gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900" style={{ marginRight: depth * 20 }}>
          <div className="flex items-center gap-2 min-w-0">
            {hasKids ? (
              <button onClick={() => toggle(account.id)} className="text-gray-500">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : <span className="w-4" />}
            <span className="font-mono text-xs text-gray-500">{account.code}</span>
            <span className={`font-medium truncate ${TYPE_COLORS[account.type] || ''}`}>{account.name}</span>
            <span className="text-xs text-gray-400">({TYPE_LABELS[account.type]})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{formatMoney(account.balance, symbol)}</span>
            <button onClick={() => openEdit(account)} className="p-1 text-blue-600 hover:bg-blue-50 rounded dark:text-blue-400 dark:hover:bg-blue-950/40" title="تعديل"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => { if (window.confirm(`حذف ${account.name}؟`)) deleteMutation.mutate(account.id) }} className="p-1 text-red-600 hover:bg-red-50 rounded dark:text-red-400 dark:hover:bg-red-950/40" title="حذف"><Trash2 className="w-4 h-4" /></button>
            <button onClick={() => openNew(account.id)} className="p-1 text-green-600 hover:bg-green-50 rounded dark:text-green-400 dark:hover:bg-green-950/40" title="إضافة فرعي"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        {hasKids && isExpanded && (
          <div className="mt-1 space-y-1">
            {kids.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const roots = childrenOf(null)

  const handlePrint = () => {
    const sorted = [...accounts].sort((a, b) => String(a.code).localeCompare(String(b.code)))
    const rows = sorted.map((account) => [
      account.code,
      account.name,
      TYPE_LABELS[account.type] || account.type || '-',
      formatMoney(account.balance, symbol),
    ])
    const totalsByType = Object.keys(TYPE_LABELS).map((type) => ({
      type,
      total: sorted
        .filter((account) => account.type === type)
        .reduce((sum: number, account) => sum + (Number(account.balance) || 0), 0),
    }))

    printReport({
      title: 'شجرة الحسابات',
      subtitle: 'دليل الحسابات والأرصدة الحالية',
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'عدد الحسابات', value: String(sorted.length) },
        { label: 'العملة', value: symbol },
        { label: 'تاريخ الإصدار', value: formatDate(new Date()) },
      ],
      kpis: totalsByType.map((item) => ({
        label: `إجمالي ${TYPE_LABELS[item.type]}`,
        value: formatMoney(item.total, symbol),
        tone: item.type === 'asset' ? 'blue' : item.type === 'liability' || item.type === 'expense' ? 'red' : 'green',
      })),
      sections: [
        {
          title: 'دليل الحسابات',
          columns: [
            { label: 'الرمز', nowrap: true },
            { label: 'اسم الحساب' },
            { label: 'النوع', nowrap: true },
            { label: 'الرصيد', align: 'left', nowrap: true },
          ],
          rows,
          emptyText: 'لا توجد حسابات مسجلة',
        },
      ],
      summaryTitle: 'ملخص الأرصدة حسب النوع',
      summary: totalsByType.map((item) => ({ label: `إجمالي ${TYPE_LABELS[item.type]}`, value: formatMoney(item.total, symbol) })),
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'شجرة الحسابات',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">شجرة الحسابات</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={accounts.length === 0}>
            <Printer className="w-4 h-4" /> تصدير PDF
          </Button>
          <Button onClick={() => openNew(null)}><Plus className="w-4 h-4" /> إضافة حساب</Button>
        </div>
      </div>
      <Card>
        {isLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}
        {!isLoading && accounts.length === 0 && <p className="text-sm text-gray-500">لا توجد حسابات. أضف حسابات أو استخدم التهيئة.</p>}
        <div className="space-y-2">
          {roots.map((a) => renderNode(a, 0))}
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل حساب' : 'إضافة حساب'}>
        <form onSubmit={(e) => {
          e.preventDefault()
          saveMutation.mutate({
            code: form.code,
            name: form.name,
            type: form.type,
            parent_id: form.parent_id ? Number(form.parent_id) : null,
            opening_balance: Number(form.opening_balance) || 0,
            is_active: form.is_active,
            notes: form.notes || null,
          })
        }} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="رمز الحساب" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input label="اسم الحساب" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">النوع</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">الحساب الأب</label>
              <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <option value="">بدون (جذر)</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <Input label="الرصيد الافتتاحي" type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} />
            <Input label="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editing ? 'تحديث' : 'إضافة'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}