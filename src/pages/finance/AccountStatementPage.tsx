import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { formatDate } from '../../utils/format'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import { Printer, FileSpreadsheet } from 'lucide-react'
import { printReport } from '../../utils/printReport'
import { mediaUrl } from '../../store/settingsStore'

interface AccountOption {
  id: number
  code: string
  name: string
  type: string
  parent_id: number | null
}

interface LedgerLine {
  date: string
  entry_number: number
  reference: string
  account_id: number
  account_code: string
  account_name: string
  description: string
  debit: number
  credit: number
  balance: number
}

interface PerAccount {
  id: number
  code: string
  name: string
  debit: number
  credit: number
  opening: number
  closing: number
}

export default function AccountStatementPage() {
  const { symbol, restaurant } = useSettingsStore()
  const [accountId, setAccountId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [includeChildren, setIncludeChildren] = useState(true)

  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const res = await api.get('/accounting/chart-of-accounts')
      return (res.data?.accounts || []) as AccountOption[]
    },
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['account-statement', accountId, fromDate, toDate, includeChildren],
    queryFn: async () => {
      if (!accountId) return null
      const params = new URLSearchParams()
      params.set('account_id', accountId)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (includeChildren) params.set('include_children', '1')
      const res = await api.get(`/accounting/ledger?${params.toString()}`)
      return res.data
    },
    enabled: Boolean(accountId),
  })

  const lines: LedgerLine[] = data?.lines || []
  const perAccount: PerAccount[] = data?.per_account || []

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), [lines])
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0), [lines])

  const handlePrint = () => {
    if (!data) return
    const rows = lines.map((l) => [
      formatDate(l.date),
      l.account_code,
      l.account_name,
      l.description || '-',
      formatMoney(l.debit, symbol),
      formatMoney(l.credit, symbol),
      formatMoney(l.balance, symbol),
    ])
    printReport({
      title: 'كشف حساب',
      subtitle: `${data.account?.code} - ${data.account?.name}`,
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'الفترة', value: `${fromDate || 'البداية'} — ${toDate || 'اليوم'}` },
        { label: 'يشمل الحسابات الفرعية', value: includeChildren ? 'نعم' : 'لا' },
      ],
      sections: [{
        title: 'الحركات',
        columns: [
          { label: 'التاريخ' },
          { label: 'كود الحساب' },
          { label: 'اسم الحساب' },
          { label: 'الوصف' },
          { label: 'مدين' },
          { label: 'دائن' },
          { label: 'الرصيد' },
        ],
        rows,
        footer: ['الإجمالي', '', '', '', formatMoney(totalDebit, symbol), formatMoney(totalCredit, symbol), formatMoney(data.closing_balance, symbol)],
      }],
      summaryTitle: 'ملخص الحسابات',
      summary: perAccount.map((a) => ({ label: `${a.code} - ${a.name}`, value: `مدين ${formatMoney(a.debit, symbol)} | دائن ${formatMoney(a.credit, symbol)} | رصيد ${formatMoney(a.closing, symbol)}` })),
      generatedAt: new Date(),
    })
  }

  const handleExportExcel = () => {
    if (!data) return
    const header = ['التاريخ', 'كود الحساب', 'اسم الحساب', 'الوصف', 'مدين', 'دائن', 'الرصيد']
    const csvRows = [header.join(',')]
    for (const l of lines) {
      csvRows.push([
        l.date,
        l.account_code,
        `"${(l.account_name || '').replace(/"/g, '""')}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        l.debit,
        l.credit,
        l.balance,
      ].join(','))
    }
    csvRows.push(['الإجمالي', '', '', '', totalDebit, totalCredit, data.closing_balance].join(','))
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `account-statement-${data.account?.code || 'account'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">كشف حساب</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={!data}><Printer className="w-4 h-4" /> طباعة / PDF</Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={!data}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        </div>
      </div>
      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">الحساب</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">اختر حساباً</option>
              {(accounts || []).map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <Input label="من تاريخ" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="إلى تاريخ" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 mt-6">
            <input type="checkbox" checked={includeChildren} onChange={(e) => setIncludeChildren(e.target.checked)} />
            تضمين الحسابات الفرعية
          </label>
        </div>
        {isLoading || isFetching ? (
          <p className="text-center py-8 text-gray-500">جارٍ التحميل...</p>
        ) : !data ? (
          <p className="text-center py-8 text-gray-500">اختر حساباً لعرض كشفه</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card padding="sm"><p className="text-xs text-gray-500">الرصيد الافتتاحي</p><p className="font-bold">{formatMoney(data.opening_balance, symbol)}</p></Card>
              <Card padding="sm"><p className="text-xs text-gray-500">إجمالي المدين</p><p className="font-bold">{formatMoney(totalDebit, symbol)}</p></Card>
              <Card padding="sm"><p className="text-xs text-gray-500">إجمالي الدائن</p><p className="font-bold">{formatMoney(totalCredit, symbol)}</p></Card>
              <Card padding="sm"><p className="text-xs text-gray-500">الرصيد الختامي</p><p className="font-bold">{formatMoney(data.closing_balance, symbol)}</p></Card>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-start">التاريخ</th>
                    <th className="px-3 py-2 text-start">الحساب</th>
                    <th className="px-3 py-2 text-start">الوصف</th>
                    <th className="px-3 py-2 text-start">مدين</th>
                    <th className="px-3 py-2 text-start">دائن</th>
                    <th className="px-3 py-2 text-start">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td className="px-3 py-4 text-center text-gray-500" colSpan={6}>لا توجد حركات</td></tr>
                  ) : lines.map((l, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.date)}</td>
                      <td className="px-3 py-2">{l.account_code} - {l.account_name}</td>
                      <td className="px-3 py-2 text-xs">{l.description || '-'}</td>
                      <td className="px-3 py-2">{l.debit ? formatMoney(l.debit, symbol) : '-'}</td>
                      <td className="px-3 py-2">{l.credit ? formatMoney(l.credit, symbol) : '-'}</td>
                      <td className="px-3 py-2 font-semibold">{formatMoney(l.balance, symbol)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                    <td className="px-3 py-2" colSpan={3}>الإجمالي</td>
                    <td className="px-3 py-2">{formatMoney(totalDebit, symbol)}</td>
                    <td className="px-3 py-2">{formatMoney(totalCredit, symbol)}</td>
                    <td className="px-3 py-2">{formatMoney(data.closing_balance, symbol)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {includeChildren && perAccount.length > 1 && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold mb-2">ملخص الحسابات الفرعية</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-start">الكود</th>
                        <th className="px-3 py-2 text-start">الاسم</th>
                        <th className="px-3 py-2 text-start">مدين</th>
                        <th className="px-3 py-2 text-start">دائن</th>
                        <th className="px-3 py-2 text-start">الرصيد الافتتاحي</th>
                        <th className="px-3 py-2 text-start">الرصيد الختامي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perAccount.map((a) => (
                        <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2">{a.code}</td>
                          <td className="px-3 py-2">{a.name}</td>
                          <td className="px-3 py-2">{formatMoney(a.debit, symbol)}</td>
                          <td className="px-3 py-2">{formatMoney(a.credit, symbol)}</td>
                          <td className="px-3 py-2">{formatMoney(a.opening, symbol)}</td>
                          <td className="px-3 py-2 font-semibold">{formatMoney(a.closing, symbol)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}