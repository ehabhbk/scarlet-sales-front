import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Printer } from 'lucide-react'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { formatDate } from '../../utils/format'
import Button from '../../components/common/buttons/Button'
import Card from '../../components/common/cards/Card'
import { printReport } from '../../utils/printReport'

interface Account {
  id: number
  code: string
  name: string
  type: string
  parent_id: number | null
  opening_balance: number
  balance: number
  is_active: boolean
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'أصل',
  liability: 'التزام',
  equity: 'حقوق ملكية',
  revenue: 'إيراد',
  expense: 'مصروف',
}

export default function TrialBalancePage() {
  const { symbol, restaurant } = useSettingsStore()
  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const res = await api.get('/accounting/chart-of-accounts')
      return (res.data?.accounts || []) as Account[]
    },
  })
  const accounts = data ?? []

  const { totalDebit, totalCredit } = useMemo(() => {
    let d = 0, c = 0
    for (const a of accounts) {
      const b = Number(a.balance) || 0
      if (b >= 0) d += b
      else c += -b
    }
    return { totalDebit: d, totalCredit: c }
  }, [accounts])

  const handlePrint = () => {
    const rows = accounts.map((a) => {
      const b = Number(a.balance) || 0
      return [a.code, a.name, TYPE_LABELS[a.type] || a.type, b >= 0 ? formatMoney(b, symbol) : '-', b < 0 ? formatMoney(-b, symbol) : '-']
    })
    printReport({
      title: 'ميزان المراجعة',
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [{ label: 'تاريخ الإصدار', value: formatDate(new Date()) }],
      sections: [{
        title: 'الحسابات',
        columns: [{ label: 'الكود' }, { label: 'اسم الحساب' }, { label: 'النوع' }, { label: 'مدين' }, { label: 'دائن' }],
        rows,
        footer: ['', 'الإجمالي', '', formatMoney(totalDebit, symbol), formatMoney(totalCredit, symbol)],
      }],
      generatedAt: new Date(),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ميزان المراجعة</h1>
        <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4" /> طباعة / PDF</Button>
      </div>
      <Card>
        {isLoading ? (
          <p className="text-center py-8 text-gray-500">جارٍ التحميل...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-start">الكود</th>
                  <th className="px-3 py-2 text-start">اسم الحساب</th>
                  <th className="px-3 py-2 text-start">النوع</th>
                  <th className="px-3 py-2 text-start">مدين</th>
                  <th className="px-3 py-2 text-start">دائن</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const b = Number(a.balance) || 0
                  const debit = b >= 0 ? b : 0
                  const credit = b < 0 ? -b : 0
                  return (
                    <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{a.code}</td>
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2">{TYPE_LABELS[a.type] || a.type}</td>
                      <td className="px-3 py-2">{debit ? formatMoney(debit, symbol) : '-'}</td>
                      <td className="px-3 py-2">{credit ? formatMoney(credit, symbol) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                  <td className="px-3 py-2" colSpan={3}>الإجمالي</td>
                  <td className="px-3 py-2">{formatMoney(totalDebit, symbol)}</td>
                  <td className="px-3 py-2">{formatMoney(totalCredit, symbol)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}