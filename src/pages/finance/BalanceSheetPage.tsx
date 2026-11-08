import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { api } from '../../services/api'
import Card from '../../components/common/cards/Card'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { printReport } from '../../utils/printReport'
import { formatDate } from '../../utils/format'

interface BalanceSheetRow {
  id: number
  code: string
  name: string
  amount: number
}

export default function BalanceSheetPage() {
  const { symbol, restaurant } = useSettingsStore()
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))

  const { data, isLoading } = useQuery({
    queryKey: ['balance-sheet', asOf],
    queryFn: async () => {
      const res = await api.get('/accounting/balance-sheet', { params: { as_of: asOf } })
      return res.data
    },
  })

  const renderSection = (title: string, rows: BalanceSheetRow[], total: number, color: string) => (
    <div>
      <h2 className={`mb-2 text-lg font-semibold ${color}`}>{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <tbody>
            {(rows || []).map((r) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1">{r.code} - {r.name}</td>
                <td className="whitespace-nowrap py-1 text-end">{formatMoney(r.amount, symbol)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2">الإجمالي</td>
              <td className="whitespace-nowrap py-2 text-end">{formatMoney(total, symbol)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  const handlePrint = () => {
    if (!data) return
    const toRows = (rows: BalanceSheetRow[]) => rows.map((row) => [`${row.code} - ${row.name}`, formatMoney(row.amount, symbol)])

    printReport({
      title: 'الميزانية العمومية',
      subtitle: `كما في ${asOf}`,
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'كما في تاريخ', value: asOf },
        { label: 'العملة', value: symbol },
        { label: 'تاريخ الإصدار', value: formatDate(new Date()) },
      ],
      kpis: [
        { label: 'إجمالي الأصول', value: formatMoney(data.total_assets, symbol), tone: 'blue' },
        { label: 'إجمالي الالتزامات', value: formatMoney(data.total_liabilities, symbol), tone: 'red' },
        { label: 'حقوق الملكية', value: formatMoney(data.total_equity, symbol), tone: 'green' },
        {
          label: 'حالة الميزانية',
          value: Math.abs(Number(data.total_assets) - Number(data.total_liabilities_equity)) < 0.01 ? 'متوازنة' : 'غير متوازنة',
          tone: Math.abs(Number(data.total_assets) - Number(data.total_liabilities_equity)) < 0.01 ? 'green' : 'red',
        },
      ],
      sections: [
        {
          title: 'الأصول',
          columns: [{ label: 'الحساب' }, { label: 'المبلغ', align: 'left', nowrap: true }],
          rows: toRows(data.assets),
          footer: ['إجمالي الأصول', formatMoney(data.total_assets, symbol)],
          emptyText: 'لا توجد أصول مسجلة',
        },
        {
          title: 'الالتزامات',
          columns: [{ label: 'الحساب' }, { label: 'المبلغ', align: 'left', nowrap: true }],
          rows: toRows(data.liabilities),
          footer: ['إجمالي الالتزامات', formatMoney(data.total_liabilities, symbol)],
          emptyText: 'لا توجد التزامات مسجلة',
        },
        {
          title: 'حقوق الملكية',
          columns: [{ label: 'الحساب' }, { label: 'المبلغ', align: 'left', nowrap: true }],
          rows: toRows(data.equity),
          footer: ['إجمالي حقوق الملكية', formatMoney(data.total_equity, symbol)],
          emptyText: 'لا توجد حقوق ملكية مسجلة',
        },
      ],
      summaryTitle: 'الملخص النهائي',
      summary: [
        { label: 'إجمالي الأصول', value: formatMoney(data.total_assets, symbol) },
        { label: 'إجمالي الالتزامات', value: formatMoney(data.total_liabilities, symbol) },
        { label: 'حقوق الملكية', value: formatMoney(data.total_equity, symbol) },
        { label: 'الالتزامات + حقوق الملكية', value: formatMoney(data.total_liabilities_equity, symbol) },
        {
          label: 'الفرق بين الأصول والالتزامات وحقوق الملكية',
          value: formatMoney(Number(data.total_assets) - Number(data.total_liabilities_equity), symbol),
          tone: Math.abs(Number(data.total_assets) - Number(data.total_liabilities_equity)) < 0.01 ? 'green' : 'red',
        },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'الميزانية العمومية',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الميزانية العمومية</h1>
        <Button variant="outline" onClick={handlePrint} disabled={!data}>
          <Printer className="w-4 h-4" /> تصدير PDF
        </Button>
      </div>
      <Card className="dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4">
          <Input label="كما في تاريخ" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        {isLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}
        {data && (
          <div className="space-y-6">
            {renderSection('الأصول', data.assets, data.total_assets, 'text-blue-600 dark:text-blue-400')}
            {renderSection('الالتزامات', data.liabilities, data.total_liabilities, 'text-red-600 dark:text-red-400')}
            {renderSection('حقوق الملكية', data.equity, data.total_equity, 'text-purple-600 dark:text-purple-400')}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-300 pt-3 text-lg font-bold dark:border-gray-700">
              <span>الالتزامات + حقوق الملكية</span>
              <span>{formatMoney(data.total_liabilities_equity, symbol)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
              <span>الأصول</span>
              <span>{formatMoney(data.total_assets, symbol)}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
