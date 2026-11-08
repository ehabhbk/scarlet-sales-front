import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Printer } from 'lucide-react'
import Card from '../../components/common/cards/Card'
import Button from '../../components/common/buttons/Button'
import StatCard from '../../components/common/data-display/StatCard'
import { printReport } from '../../utils/printReport'
import { formatDate } from '../../utils/format'

interface PaymentMethodStat {
  payment_method: string
  total: number
  count?: number
  transactions?: number
}

export default function FinancePage() {
  const { symbol, paymentMethods, restaurant } = useSettingsStore()
  const [period, setPeriod] = useState('month')

  const range = useMemo(() => {
    const now = new Date()
    let start = new Date(now)
    if (period === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (period === 'week') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1)
    if (period === 'year') start = new Date(now.getFullYear(), 0, 1)
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { from: fmt(start), to: fmt(now) }
  }, [period])

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss', period],
    queryFn: async () => {
      const res = await api.get(`/reports/profit-loss?from=${range.from}&to=${range.to}`)
      return res.data
    },
  })

  const { data: paymentMethodStats } = useQuery({
    queryKey: ['payment-methods', period],
    queryFn: async () => {
      const res = await api.get(`/reports/payment-methods?from=${range.from}&to=${range.to}`)
      return res.data.methods as PaymentMethodStat[]
    },
  })

  const paymentRows = (paymentMethodStats || []).map((method) => [
    paymentMethods.find((m) => m.value === method.payment_method)?.label || method.payment_method,
    formatMoney(method.total, symbol),
    String(method.count ?? method.transactions ?? ''),
  ])

  const handlePrint = () => {
    printReport({
      title: 'التقرير المالي',
      subtitle: 'نظرة عامة على الأداء المالي',
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'الفترة', value: period === 'today' ? 'اليوم' : period === 'week' ? 'هذا الأسبوع' : period === 'year' ? 'هذا العام' : 'هذا الشهر' },
        { label: 'العملة', value: symbol },
        { label: 'تاريخ الإصدار', value: formatDate(new Date()) },
      ],
      kpis: [
        { label: 'الإيرادات', value: formatMoney(profitLoss?.revenue, symbol), tone: 'green' },
        { label: 'المصروفات', value: formatMoney(profitLoss?.expense, symbol), tone: 'red' },
        { label: 'المشتريات', value: formatMoney(profitLoss?.purchase, symbol), tone: 'blue' },
        { label: 'صافي الربح', value: formatMoney(profitLoss?.profit, symbol), tone: Number(profitLoss?.profit) >= 0 ? 'green' : 'red' },
      ],
      sections: [
        {
          title: 'طرق الدفع',
          columns: [
            { label: 'طريقة الدفع' },
            { label: 'الإجمالي', align: 'left', nowrap: true },
            { label: 'عدد العمليات', align: 'left', nowrap: true },
          ],
          rows: paymentRows,
          emptyText: 'لا توجد عمليات دفع مسجلة',
        },
      ],
      summaryTitle: 'الملخص المالي',
      summary: [
        { label: 'الإيرادات', value: formatMoney(profitLoss?.revenue, symbol), tone: 'green' },
        { label: 'المصروفات', value: formatMoney(profitLoss?.expense, symbol), tone: 'red' },
        { label: 'منها أجور موظفين', value: formatMoney(profitLoss?.wages, symbol) },
        { label: 'المشتريات', value: formatMoney(profitLoss?.purchase, symbol) },
        { label: 'صافي الربح', value: formatMoney(profitLoss?.profit, symbol), tone: Number(profitLoss?.profit) >= 0 ? 'green' : 'red' },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'التقرير المالي',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المالية</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
            <option value="year">هذا العام</option>
          </select>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> تصدير PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="الإيرادات"
          value={formatMoney(profitLoss?.revenue, symbol)}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          color="bg-green-500"
        />
        <StatCard
          label="المصروفات"
          value={formatMoney(profitLoss?.expense, symbol)}
          icon={<TrendingDown className="w-6 h-6 text-white" />}
          color="bg-red-500"
        />
        <StatCard
          label="المشتريات"
          value={formatMoney(profitLoss?.purchase, symbol)}
          icon={<CreditCard className="w-6 h-6 text-white" />}
          color="bg-blue-500"
        />
        <StatCard
          label="صافي الربح"
          value={formatMoney(profitLoss?.profit, symbol)}
          icon={<DollarSign className="w-6 h-6 text-white" />}
          color="bg-emerald-500"
        />
      </div>

      {Number(profitLoss?.wages) > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          تشمل المصروفات أجور موظفين محتسبة على الورديات: {formatMoney(profitLoss?.wages, symbol)}
        </p>
      )}

      <Card className="dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">طرق الدفع</h2>
        <div className="space-y-3">
          {(paymentMethodStats || []).map((method) => (
            <div
              key={method.payment_method}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60"
            >
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {paymentMethods.find((m) => m.value === method.payment_method)?.label || method.payment_method}
              </span>
              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-gray-100">{formatMoney(method.total, symbol)}</p>
                <p className="text-xs text-gray-500">{Number(method.count ?? method.transactions ?? 0)} عملية</p>
              </div>
            </div>
          ))}
          {(paymentMethodStats || []).length === 0 && (
            <p className="text-sm text-gray-500">لا توجد عمليات دفع مسجلة.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
