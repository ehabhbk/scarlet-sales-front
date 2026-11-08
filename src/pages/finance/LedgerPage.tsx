import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { api } from '../../services/api'
import Card from '../../components/common/cards/Card'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { printReport } from '../../utils/printReport'
import { formatDate, formatNumber } from '../../utils/format'

interface LedgerAccount {
  id: number
  code: string
  name: string
  type?: string
}

interface LedgerLine {
  date: string
  entry_number?: string
  description?: string
  reference?: string
  debit: number
  credit: number
  balance: number
}

export default function LedgerPage() {
  const { symbol, restaurant } = useSettingsStore()
  const [accountId, setAccountId] = useState<number | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')

  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => ((await api.get('/accounting/chart-of-accounts')).data?.accounts || []) as LedgerAccount[],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', accountId, from, to, search],
    queryFn: async () => {
      const res = await api.get('/accounting/ledger', {
        params: { account_id: accountId, from: from || undefined, to: to || undefined, search },
      })
      return res.data
    },
    enabled: !!accountId,
  })

  const lines = ((data?.lines || []) as LedgerLine[]).filter((line) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      String(line.entry_number || '').toLowerCase().includes(term) ||
      String(line.description || '').toLowerCase().includes(term) ||
      String(line.reference || '').toLowerCase().includes(term)
    )
  })

  const handlePrint = () => {
    if (!data?.account) return
    const rangeLabel = from && to ? `من ${from} إلى ${to}` : from ? `من ${from}` : to ? `حتى ${to}` : 'جميع الفترات'
    const totalDebit = lines.reduce((sum: number, line) => sum + (Number(line.debit) || 0), 0)
    const totalCredit = lines.reduce((sum: number, line) => sum + (Number(line.credit) || 0), 0)

    printReport({
      title: 'دفتر الأستاذ',
      subtitle: `الحساب: ${data.account.code} - ${data.account.name}`,
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'الحساب', value: `${data.account.code} - ${data.account.name}` },
        { label: 'نوع الحساب', value: data.account.type || '-' },
        { label: 'الفترة', value: rangeLabel },
        { label: 'الرصيد الافتتاحي', value: formatMoney(data.opening_balance, symbol) },
        { label: 'الرصيد الختامي', value: formatMoney(data.closing_balance, symbol) },
        { label: 'العملة', value: symbol },
      ],
      kpis: [
        { label: 'الرصيد الافتتاحي', value: formatMoney(data.opening_balance, symbol), tone: 'blue' },
        { label: 'إجمالي المدين', value: formatMoney(totalDebit, symbol) },
        { label: 'إجمالي الدائن', value: formatMoney(totalCredit, symbol) },
        { label: 'الرصيد الختامي', value: formatMoney(data.closing_balance, symbol), tone: Number(data.closing_balance) >= 0 ? 'green' : 'red' },
      ],
      sections: [
        {
          title: 'حركة الحساب',
          columns: [
            { label: 'التاريخ', nowrap: true },
            { label: 'رقم القيد', nowrap: true },
            { label: 'الوصف' },
            { label: 'مدين', align: 'left', nowrap: true },
            { label: 'دائن', align: 'left', nowrap: true },
            { label: 'الرصيد', align: 'left', nowrap: true },
          ],
          rows: lines.map((line) => [
            formatDate(line.date),
            line.entry_number,
            line.description || '-',
            Number(line.debit) ? formatMoney(line.debit, symbol) : '',
            Number(line.credit) ? formatMoney(line.credit, symbol) : '',
            formatMoney(line.balance, symbol),
          ]),
          footer: ['الإجمالي', '', '', formatMoney(totalDebit, symbol), formatMoney(totalCredit, symbol), formatMoney(data.closing_balance, symbol)],
          emptyText: 'لا توجد حركات على هذا الحساب خلال الفترة المحددة',
        },
      ],
      summaryTitle: 'ملخص الحساب',
      summary: [
        { label: 'الرصيد الافتتاحي', value: formatMoney(data.opening_balance, symbol) },
        { label: 'إجمالي المدين', value: formatMoney(totalDebit, symbol) },
        { label: 'إجمالي الدائن', value: formatMoney(totalCredit, symbol) },
        { label: 'الرصيد الختامي', value: formatMoney(data.closing_balance, symbol), tone: Number(data.closing_balance) >= 0 ? 'green' : 'red' },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'دفتر الأستاذ',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">دفتر الأستاذ</h1>
        <Button variant="outline" onClick={handlePrint} disabled={!data?.account}>
          <Printer className="w-4 h-4" /> تصدير PDF
        </Button>
      </div>
      <Card className="dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">الحساب</label>
            <select
              value={accountId || ''}
              onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">اختر حساباً</option>
              {(accounts || []).map((a: LedgerAccount) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="من تاريخ" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="إلى تاريخ" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input label="بحث برقم القيد أو الوصف" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}
        {!accountId && <p className="text-sm text-gray-500">اختر حساباً لعرض دفتر الأستاذ.</p>}
        {data && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {data.account?.code} - {data.account?.name}
              </span>
              <span className="text-gray-600 dark:text-gray-300">الرصيد الافتتاحي: {formatMoney(data.opening_balance, symbol)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="whitespace-nowrap py-2 text-start">التاريخ</th>
                    <th className="whitespace-nowrap py-2 text-start">القيد</th>
                    <th className="py-2 text-start">الوصف</th>
                    <th className="whitespace-nowrap py-2 text-end">مدين</th>
                    <th className="whitespace-nowrap py-2 text-end">دائن</th>
                    <th className="whitespace-nowrap py-2 text-end">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l: LedgerLine, i: number) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="whitespace-nowrap py-2">{formatDate(l.date)}</td>
                      <td className="whitespace-nowrap py-2 font-mono text-xs">{l.entry_number}</td>
                      <td className="py-2">{l.description || '-'}</td>
                      <td className="whitespace-nowrap py-2 text-end tabular-nums">{formatNumber(l.debit)}</td>
                      <td className="whitespace-nowrap py-2 text-end tabular-nums">{formatNumber(l.credit)}</td>
                      <td className="whitespace-nowrap py-2 text-end font-semibold tabular-nums">{formatMoney(l.balance, symbol)}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        لا توجد حركات مطابقة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-left font-bold text-gray-900 dark:text-gray-100">الرصيد الختامي: {formatMoney(data.closing_balance, symbol)}</div>
          </div>
        )}
      </Card>
    </div>
  )
}
