import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Plus, Search, Trash2, Pencil, Printer, CalendarDays, FilterX, ChevronRight, ChevronLeft } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { printReport } from '../../utils/printReport'
import { formatDate } from '../../utils/format'

interface Line { account_id: number | ''; debit: number; credit: number; description: string }

interface JournalEntry {
  id: number
  entry_date: string
  entry_number: string
  reference?: string | null
  description?: string | null
  lines: JournalEntryLine[]
}

interface JournalEntryLine extends Line {
  id: number
  account?: { code: string; name: string }
}


const today = () => new Date().toISOString().slice(0, 10)

export default function JournalEntriesPage() {
  const queryClient = useQueryClient()
  const { symbol, restaurant } = useSettingsStore()
  const currentUser = useAuthStore((state) => state.user)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const [form, setForm] = useState({ entry_date: today(), reference: '', description: '' })
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [lines, setLines] = useState<Line[]>([
    { account_id: '', debit: 0, credit: 0, description: '' },
    { account_id: '', debit: 0, credit: 0, description: '' },
  ])

  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => (await api.get('/accounting/chart-of-accounts')).data?.accounts as { id: number; code: string; name: string }[] || [],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', search, from, to, page],
    queryFn: async () => {
      const res = await api.get('/journal-entries', {
        params: { per_page: 50, page, search: search || undefined, from: from || undefined, to: to || undefined },
      })
      return res.data
    },
  })

  const entries = useMemo(() => {
    const payload = data?.data ?? data
    return Array.isArray(payload) ? payload as JournalEntry[] : []
  }, [data])

  const meta = data && !Array.isArray(data) ? data : null
  const totalPages = Number(meta?.last_page) || 1
  const totalEntries = Number(meta?.total) || entries.length

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc: { debit: number; credit: number }, entry) => {
          ;(entry.lines || []).forEach((line) => {
            acc.debit += Number(line.debit) || 0
            acc.credit += Number(line.credit) || 0
          })
          return acc
        },
        { debit: 0, credit: 0 }
      ),
    [entries]
  )

  const resetFilters = () => {
    setSearch('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const resetForm = () => {
    setEditing(null)
    setForm({ entry_date: today(), reference: '', description: '' })
    setLines([
      { account_id: '', debit: 0, credit: 0, description: '' },
      { account_id: '', debit: 0, credit: 0, description: '' },
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        entry_date: form.entry_date,
        reference: form.reference || null,
        description: form.description || null,
        lines: lines.map((l) => ({
          account_id: Number(l.account_id),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || null,
        })),
      }
      if (editing) await api.put(`/journal-entries/${editing.id}`, payload)
      else await api.post('/journal-entries', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      setShowModal(false)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/journal-entries/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
    },
  })

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001

  const addLine = () => setLines((prev) => [...prev, { account_id: '', debit: 0, credit: 0, description: '' }])
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const openEdit = (entry: JournalEntry) => {
    setEditing(entry)
    setForm({ entry_date: String(entry.entry_date || '').slice(0, 10), reference: entry.reference || '', description: entry.description || '' })
    setLines(
      (entry.lines || []).map((l) => ({
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || '',
      }))
    )
    setShowModal(true)
  }

  const handlePrint = () => {
    const rangeLabel = from && to ? `من ${from} إلى ${to}` : from ? `من ${from}` : to ? `حتى ${to}` : 'جميع الفترات'
    const rows = entries.flatMap((entry) => {
      const entryLines = entry.lines || []
      if (entryLines.length === 0) {
        return [[entry.entry_number, formatDate(entry.entry_date), '-', entry.description || entry.reference || '-', '', '']]
      }
      return entryLines.map((line, index: number) => [
        index === 0 ? entry.entry_number : '',
        index === 0 ? formatDate(entry.entry_date) : '',
        `${line.account?.code || ''} - ${line.account?.name || ''}`,
        line.description || (index === 0 ? entry.description || entry.reference || '' : ''),
        Number(line.debit) ? formatMoney(line.debit, symbol) : '',
        Number(line.credit) ? formatMoney(line.credit, symbol) : '',
      ])
    })

    printReport({
      title: 'قيود اليومية',
      subtitle: `الفترة: ${rangeLabel}${search ? ` — بحث: ${search}` : ''}`,
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'الفترة', value: rangeLabel },
        { label: 'عدد القيود', value: String(totalEntries) },
        { label: 'العملة', value: symbol },
        { label: 'تاريخ الإصدار', value: formatDate(new Date()) },
        { label: 'بحث', value: search || 'بدون' },
        { label: 'المستخدم', value: currentUser?.name || 'المستخدم الحالي' },
      ],
      kpis: [
        { label: 'إجمالي المدين', value: formatMoney(totals.debit, symbol), tone: 'blue' },
        { label: 'إجمالي الدائن', value: formatMoney(totals.credit, symbol), tone: 'green' },
        { label: 'عدد القيود', value: String(totalEntries) },
        { label: 'حالة التوازن', value: Math.abs(totals.debit - totals.credit) < 0.001 ? 'متوازن' : 'غير متوازن', tone: Math.abs(totals.debit - totals.credit) < 0.001 ? 'green' : 'red' },
      ],
      sections: [
        {
          title: 'تفاصيل القيود',
          columns: [
            { label: 'رقم القيد', nowrap: true },
            { label: 'التاريخ', nowrap: true },
            { label: 'الحساب' },
            { label: 'البيان' },
            { label: 'مدين', align: 'left', nowrap: true },
            { label: 'دائن', align: 'left', nowrap: true },
          ],
          rows,
          footer: ['الإجمالي', '', '', '', formatMoney(totals.debit, symbol), formatMoney(totals.credit, symbol)],
          emptyText: 'لا توجد قيود مطابقة للبحث',
        },
      ],
      summaryTitle: 'ملخص القيود',
      summary: [
        { label: 'إجمالي المدين', value: formatMoney(totals.debit, symbol) },
        { label: 'إجمالي الدائن', value: formatMoney(totals.credit, symbol) },
        { label: 'الفرق', value: formatMoney(totals.debit - totals.credit, symbol), tone: Math.abs(totals.debit - totals.credit) < 0.001 ? 'green' : 'red' },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'قيود اليومية',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">قيود اليومية</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            إجمالي {totalEntries} قيد — الترقيم التلقائي يبدأ من 01 ويتزايد لكل قيد جديد
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> تصدير PDF
          </Button>
          <Button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
          >
            <Plus className="w-4 h-4" /> قيد جديد
          </Button>
        </div>
      </div>

      <Card className="dark:border-gray-800 dark:bg-gray-900" padding="sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_11rem_11rem_auto] md:items-end">
          <Input
            label="بحث برقم القيد أو البيان أو المرجع"
            placeholder="مثال: 01 أو راتب أو JE..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            icon={<Search className="w-4 h-4" />}
          />
          <Input
            label="من تاريخ"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
          <Input
            label="إلى تاريخ"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
          <Button variant="secondary" onClick={resetFilters} className="h-[42px]">
            <FilterX className="w-4 h-4" /> مسح الفلاتر
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {from || to ? `${from || 'البداية'} ← ${to || 'اليوم'}` : 'كل الفترات'}
          </span>
          <span>مدين الصفحة: <b className="text-gray-700 dark:text-gray-200">{formatMoney(totals.debit, symbol)}</b></span>
          <span>دائن الصفحة: <b className="text-gray-700 dark:text-gray-200">{formatMoney(totals.credit, symbol)}</b></span>
        </div>
      </Card>

      <Card className="overflow-hidden dark:border-gray-800 dark:bg-gray-900" padding="sm">
        {isLoading && <p className="p-4 text-sm text-gray-500">جاري التحميل...</p>}
        {!isLoading && entries.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">لا توجد قيود مطابقة للبحث أو الفترة المحددة.</p>
        )}

        {entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="whitespace-nowrap px-2 py-2 text-start">القيد</th>
                  <th className="px-2 py-2 text-start">الحساب</th>
                  <th className="px-2 py-2 text-start">البيان</th>
                  <th className="whitespace-nowrap px-2 py-2 text-end">مدين</th>
                  <th className="whitespace-nowrap px-2 py-2 text-end">دائن</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const entryLines = entry.lines || []
                  const rowCount = Math.max(entryLines.length, 1)
                  return Array.from({ length: rowCount }).map((_, index) => {
                    const line = entryLines[index]
                    return (
                      <tr
                        key={`${entry.id}-${line?.id ?? index}`}
                        className="border-b border-gray-100 align-top last:border-0 dark:border-gray-800"
                      >
                        {index === 0 && (
                          <td rowSpan={rowCount} className="w-40 px-2 py-2 align-top">
                            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary dark:bg-accent/15 dark:text-blue-300">
                              {entry.entry_number}
                            </span>
                            <p className="mt-1 text-[11px] text-gray-500">{formatDate(entry.entry_date)}</p>
                            {entry.reference && (
                              <p className="text-[11px] text-gray-400">مرجع: {entry.reference}</p>
                            )}
                            <div className="mt-2 flex gap-1">
                              <button
                                onClick={() => openEdit(entry)}
                                className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                title="تعديل"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('حذف القيد؟')) deleteMutation.mutate(entry.id)
                                }}
                                className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="px-2 py-2">
                          {line ? (
                            <span className="text-gray-800 dark:text-gray-200">
                              <span className="font-mono text-xs text-gray-400">{line.account?.code}</span>{' '}
                              {line.account?.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="max-w-[22rem] px-2 py-2 text-xs text-gray-600 dark:text-gray-300">
                          {line?.description || (index === 0 ? entry.description || '-' : '')}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-end font-medium tabular-nums text-blue-700 dark:text-blue-300">
                          {line && Number(line.debit) ? formatMoney(line.debit, symbol) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-end font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                          {line && Number(line.credit) ? formatMoney(line.credit, symbol) : '—'}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 text-sm font-bold dark:bg-gray-800/70">
                  <td className="px-2 py-2" colSpan={3}>
                    إجمالي الصفحة
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums">{formatMoney(totals.debit, symbol)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums">{formatMoney(totals.credit, symbol)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-xs text-gray-500">
              صفحة {page} من {totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronRight className="w-4 h-4" /> السابق
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                التالي <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          resetForm()
        }}
        title={editing ? `تعديل قيد ${editing.entry_number}` : 'قيد جديد'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input label="التاريخ" type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required />
            <Input label="المرجع" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            <Input label="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2 px-1 text-xs text-gray-500">
              <span>الحساب</span>
              <span>مدين</span>
              <span>دائن</span>
              <span className="w-8" />
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem_6rem_auto] items-center gap-2">
                <select
                  value={line.account_id}
                  onChange={(e) => updateLine(i, { account_id: e.target.value ? Number(e.target.value) : '' })}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">اختر حساباً</option>
                  {(accounts || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={line.debit}
                  onChange={(e) => updateLine(i, { debit: Number(e.target.value) || 0 })}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="مدين"
                />
                <input
                  type="number"
                  step="0.01"
                  value={line.credit}
                  onChange={(e) => updateLine(i, { credit: Number(e.target.value) || 0 })}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="دائن"
                />
                <button
                  onClick={() => removeLine(i)}
                  className="rounded p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={addLine}>
              <Plus className="w-4 h-4" /> إضافة سطر
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
            <span className={balanced ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-red-600 dark:text-red-400'}>
              مدين: {formatMoney(totalDebit, symbol)} | دائن: {formatMoney(totalCredit, symbol)} {balanced ? '✓ متوازن' : '✗ غير متوازن'}
            </span>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowModal(false); resetForm() }}>
              إلغاء
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!balanced}>
              حفظ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
