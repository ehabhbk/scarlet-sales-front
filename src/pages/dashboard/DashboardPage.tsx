import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Clock,
  DollarSign,
  Package,
  PiggyBank,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Tags,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import StatCard from '../../components/common/data-display/StatCard'
import Card from '../../components/common/cards/Card'
import Button from '../../components/common/buttons/Button'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { formatDate, formatNumber } from '../../utils/format'
import type { ProductAlerts } from '../../types'

const CHART_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
  '#64748b',
  '#84cc16',
  '#0ea5e9',
]

const SALE_TYPE_LABELS: Record<string, string> = {
  dine_in: 'داخل المطعم',
  takeaway: 'سفري',
  delivery: 'توصيل',
}

const FALLBACK_PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  wallet: 'محفظة',
  bank: 'تحويل بنكي',
}

type Slice = { name: string; value: number; count: number }
type DashboardSliceRow = { name: string; value: number | string; count?: number | string }
type TopProduct = { id: number; name: string; revenue: number; sales_count: number; orders_count?: number }
type LowStockItem = { id: number; name: string; current_stock: number }

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const monthStartInput = () => {
  const now = new Date()
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1))
}

const todayInput = () => toInputDate(new Date())

function ChartTooltip({
  active,
  payload,
  symbol,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; payload?: Slice }>
  symbol: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]
  const label = point.name ?? point.payload?.name ?? ''
  const count = Number(point.payload?.count) || 0
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1 font-medium text-gray-700 dark:text-gray-200">{label}</p>
      <p className="text-gray-900 dark:text-gray-100">
        {formatMoney(Number(point.value) || 0, symbol)}
      </p>
      {count > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(count)} سجل</p>
      )}
    </div>
  )
}

function PieCard({
  title,
  icon,
  data,
  symbol,
  countLabel = 'عدد',
}: {
  title: string
  icon: ReactNode
  data: Slice[]
  symbol: string
  countLabel?: string
}) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0)

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      </div>
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip symbol={symbol} />} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-3 space-y-1.5">
            {data.map((item, index) => {
              const percent = total > 0 ? (Number(item.value) / total) * 100 : 0
              return (
                <li key={item.name} className="flex flex-wrap items-center justify-between gap-2 gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="truncate text-gray-600 dark:text-gray-300">{item.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(item.value, symbol)}{' '}
                    <span className="text-gray-400 dark:text-gray-500">
                      ({formatNumber(percent)}% · {formatNumber(Number(item.count) || 0)} {countLabel})
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="flex h-[260px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          لا توجد بيانات للفترة المحددة
        </div>
      )}
    </Card>
  )
}

const RANGE_PRESETS = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'آخر 7 أيام' },
  { id: 'month', label: 'هذا الشهر' },
  { id: '30d', label: 'آخر 30 يوم' },
] as const

export default function DashboardPage() {
  const { symbol, load, paymentMethods } = useSettingsStore()
  const queryClient = useQueryClient()

  const [from, setFrom] = useState(monthStartInput)
  const [to, setTo] = useState(todayInput)

  useEffect(() => {
    void load()
  }, [load])

  const rangeKey = `${from}:${to}`

  const { data: stats, isFetching: statsFetching } = useQuery({
    queryKey: ['dashboard', 'stats', rangeKey],
    queryFn: async () => {
      const res = await api.get(`/dashboard/stats?from=${from}&to=${to}`)
      return res.data
    },
    enabled: Boolean(from && to),
  })

  const { data: salesChart, isFetching: chartFetching } = useQuery({
    queryKey: ['dashboard', 'sales-chart', rangeKey],
    queryFn: async () => {
      const res = await api.get(`/dashboard/sales-chart?from=${from}&to=${to}`)
      return res.data
    },
    enabled: Boolean(from && to),
  })

  const { data: breakdowns, isFetching: breakdownsFetching } = useQuery({
    queryKey: ['dashboard', 'breakdowns', rangeKey],
    queryFn: async () => {
      const res = await api.get(`/dashboard/breakdowns?from=${from}&to=${to}`)
      return res.data
    },
    enabled: Boolean(from && to),
  })

  const { data: topProducts } = useQuery({
    queryKey: ['dashboard', 'top-products', rangeKey],
    queryFn: async () => {
      const res = await api.get(`/dashboard/top-products?limit=5&from=${from}&to=${to}`)
      return res.data
    },
    enabled: Boolean(from && to),
  })

  const { data: staffPerformance } = useQuery({
    queryKey: ['dashboard', 'staff-performance', rangeKey],
    queryFn: async () => {
      const res = await api.get(`/dashboard/staff-performance?from=${from}&to=${to}`)
      return res.data
    },
    enabled: Boolean(from && to),
  })

  const { data: inventoryAlerts } = useQuery({
    queryKey: ['dashboard', 'inventory-alerts'],
    queryFn: async () => {
      const res = await api.get('/dashboard/inventory-alerts')
      return res.data
    },
  })

  const { data: productAlerts } = useQuery({
    queryKey: ['product-alerts'],
    queryFn: async () => {
      const res = await api.get('/product-alerts')
      return res.data as ProductAlerts
    },
    refetchInterval: 60000,
  })

  const { data: warehouseStats } = useQuery({
    queryKey: ['dashboard', 'warehouse-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/warehouse-stats')
      return res.data as {
        warehouses_count: number
        stores_count: number
        expired_products: number
        near_expiry_products: number
        low_stock_products: number
      }
    },
    refetchInterval: 60000,
  })

  const isFetching = statsFetching || chartFetching || breakdownsFetching

  const paymentLabel = (value: string) =>
    paymentMethods.find((method) => method.value === value)?.label ||
    FALLBACK_PAYMENT_LABELS[value] ||
    value ||
    'غير محدد'

  const salesSlices = useMemo<Slice[]>(
    () =>
      (breakdowns?.sales || []).map((row: DashboardSliceRow) => ({
        name: SALE_TYPE_LABELS[row.name] || row.name,
        value: Number(row.value) || 0,
        count: Number(row.count) || 0,
      })),
    [breakdowns]
  )

  const purchaseSlices = useMemo<Slice[]>(
    () =>
      (breakdowns?.purchases || []).map((row: DashboardSliceRow) => ({
        name: row.name,
        value: Number(row.value) || 0,
        count: Number(row.count) || 0,
      })),
    [breakdowns]
  )

  const expenseSlices = useMemo<Slice[]>(
    () =>
      (breakdowns?.expenses || []).map((row: DashboardSliceRow) => ({
        name: row.name,
        value: Number(row.value) || 0,
        count: Number(row.count) || 0,
      })),
    [breakdowns]
  )

  const productSlices = useMemo<Slice[]>(
    () =>
      (breakdowns?.products || []).map((row: DashboardSliceRow) => ({
        name: row.name,
        value: Number(row.value) || 0,
        count: Number(row.count) || 0,
      })),
    [breakdowns]
  )

  const categorySlices = useMemo<Slice[]>(
    () =>
      (breakdowns?.categories || []).map((row: DashboardSliceRow) => ({
        name: row.name,
        value: Number(row.value) || 0,
        count: Number(row.count) || 0,
      })),
    [breakdowns]
  )

  const employeeSlices = useMemo<Slice[]>(
    () =>
      (breakdowns?.employees || []).map((row: DashboardSliceRow) => ({
        name: row.name,
        value: Number(row.value) || 0,
        count: Number(row.count) || 0,
      })),
    [breakdowns]
  )

  const paymentSlices = useMemo<Slice[]>(
    () =>
      (breakdowns?.payment_methods || []).map((row: DashboardSliceRow) => ({
        name: paymentLabel(row.name),
        value: Number(row.value) || 0,
        count: Number(row.count) || 0,
      })),
    // paymentLabel is derived from paymentMethods.
    [breakdowns, paymentMethods]
  )

  const chartData = useMemo(
    () =>
      (salesChart?.labels || []).map((label: string, index: number) => ({
        name: label,
        value: Number(salesChart?.data?.[index]) || 0,
      })),
    [salesChart]
  )

  const topProductsTotal = useMemo(
    () =>
      (topProducts?.products || []).reduce(
        (sum: number, product: TopProduct) => sum + (Number(product.revenue) || 0),
        0,
      ),
    [topProducts],
  )
  const period = stats?.period
  const bestCashier = staffPerformance?.staff?.[0]
  const lowStockAlerts = Array.isArray(inventoryAlerts?.low_stock) ? inventoryAlerts.low_stock : []
  const expiredAlerts = productAlerts?.expired || []
  const nearExpiryAlerts = productAlerts?.near_expiry || []
  const lowStockProducts = productAlerts?.low_stock || []
  const alertSummary = productAlerts?.summary

  const applyPreset = (preset: (typeof RANGE_PRESETS)[number]['id']) => {
    const now = new Date()
    let start = new Date(now)
    if (preset === 'week') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    if (preset === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1)
    if (preset === '30d') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
    setFrom(toInputDate(start))
    setTo(toInputDate(now))
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const money = (value: unknown) => formatMoney(Number(value) || 0, symbol)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            نظرة شاملة على مبيعات ومشتريات ومصروفات المتجر
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(from)} — {formatDate(to)}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            <CalendarDays className="h-5 w-5 text-primary dark:text-accent" />
            <span>تحديد الفترة</span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              من تاريخ
            </label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={refresh}
            loading={isFetching}
            className="ms-auto"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          ملخص الفترة المحددة
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="إيرادات الفترة"
            value={money(period?.revenue)}
            icon={<DollarSign className="h-6 w-6 text-white" />}
            color="bg-green-600"
          />
          <StatCard
            label="مشتريات الفترة"
            value={money(period?.purchases)}
            icon={<Package className="h-6 w-6 text-white" />}
            color="bg-amber-600"
          />
          <StatCard
            label="مصروفات الفترة"
            value={money(period?.expenses)}
            icon={<Receipt className="h-6 w-6 text-white" />}
            color="bg-red-600"
          />
          <StatCard
            label="صافي ربح الفترة"
            value={money(period?.profit)}
            icon={<PiggyBank className="h-6 w-6 text-white" />}
            color="bg-emerald-600"
          />
          <StatCard
            label="طلبات الفترة"
            value={formatNumber(period?.orders)}
            icon={<ShoppingCart className="h-6 w-6 text-white" />}
            color="bg-sky-600"
          />
        </div>
        {Number(period?.wages) > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            تشمل مصروفات الفترة أجور موظفين محتسبة على الورديات: {money(period?.wages)}
          </p>
        )}
      </section>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            المبيعات اليومية خلال الفترة
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(from)} — {formatDate(to)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.2} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={70} />
            <Tooltip content={<ChartTooltip symbol={symbol} />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
            <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          الرسوم البيانية الإحصائية
        </h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PieCard
            title="المبيعات حسب نوع الطلب"
            icon={<TrendingUp className="h-5 w-5" />}
            data={salesSlices}
            symbol={symbol}
            countLabel="طلب"
          />
          <PieCard
            title="طرق الدفع"
            icon={<Wallet className="h-5 w-5" />}
            data={paymentSlices}
            symbol={symbol}
            countLabel="عملية"
          />
          <PieCard
            title="المشتريات حسب المورد"
            icon={<Package className="h-5 w-5" />}
            data={purchaseSlices}
            symbol={symbol}
            countLabel="عملية شراء"
          />
          <PieCard
            title="المصروفات حسب الفئة"
            icon={<Receipt className="h-5 w-5" />}
            data={expenseSlices}
            symbol={symbol}
            countLabel="مصروف"
          />
          <PieCard
            title="المنتجات الأكثر مبيعاً"
            icon={<Boxes className="h-5 w-5" />}
            data={productSlices}
            symbol={symbol}
            countLabel="قطعة"
          />
          <PieCard
            title="المبيعات حسب الصنف"
            icon={<Tags className="h-5 w-5" />}
            data={categorySlices}
            symbol={symbol}
            countLabel="قطعة"
          />
          <PieCard
            title="الموظفون حسب المبيعات"
            icon={<Users className="h-5 w-5" />}
            data={employeeSlices}
            symbol={symbol}
            countLabel="طلب"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              أكثر المنتجات مبيعاً
            </h2>
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-3">
            {topProducts?.products?.length ? (
              topProducts.products.map((product: TopProduct, index: number) => (
                <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                        index === 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {money(product.revenue)}{' '}
                        <span className="text-gray-400 dark:text-gray-500">
                          ({formatNumber(topProductsTotal > 0 ? (Number(product.revenue) / topProductsTotal) * 100 : 0)}%)
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatNumber(product.sales_count)} قطعة · {formatNumber(Number(product.orders_count) || 0)} طلب
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                لا توجد مبيعات في الفترة المحددة
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              أفضل أداء للكاشير
            </h2>
            <Users className="h-5 w-5 text-primary dark:text-accent" />
          </div>
          {bestCashier ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary dark:bg-accent/15 dark:text-accent">
                  {bestCashier.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{bestCashier.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {bestCashier.username ? `@${bestCashier.username}` : bestCashier.role}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className="font-bold text-primary dark:text-accent">
                  {money(bestCashier.revenue)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatNumber(bestCashier.orders_completed)} طلب
                </p>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              لا توجد بيانات
            </p>
          )}
        </Card>
      </div>

      {(expiredAlerts.length > 0 || nearExpiryAlerts.length > 0 || lowStockProducts.length > 0) && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">تنبيهات المنتجات</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
                منتهي: {formatNumber(expiredAlerts.length)}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                قارب الانتهاء: {formatNumber(nearExpiryAlerts.length)}
              </span>
              <span className="rounded-full bg-orange-100 px-2 py-1 font-medium text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                منخفض: {formatNumber(lowStockProducts.length)}
              </span>
            </div>
          </div>

          {expiredAlerts.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" /> منتجات منتهية الصلاحية
                {alertSummary && alertSummary.total_loss > 0 && (
                  <span className="ms-auto text-xs font-normal">خسارة {formatMoney(alertSummary.total_loss, symbol)}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {expiredAlerts.slice(0, 6).map((batch) => (
                  <span key={batch.id} className="rounded-full bg-white/70 px-2 py-1 text-xs text-red-800 dark:bg-red-500/15 dark:text-red-200">
                    {batch.product_name} ({formatNumber(batch.quantity)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {nearExpiryAlerts.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <Clock className="h-4 w-4" /> منتجات قاربت على الانتهاء
              </p>
              <div className="flex flex-wrap gap-2">
                {nearExpiryAlerts.slice(0, 6).map((batch) => (
                  <span key={batch.id} className="rounded-full bg-white/70 px-2 py-1 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                    {batch.product_name} ({batch.days_left === 0 ? 'اليوم' : `${formatNumber(batch.days_left ?? 0)} يوم`})
                  </span>
                ))}
              </div>
            </div>
          )}

          {lowStockProducts.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/30">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300">
                <Package className="h-4 w-4" /> منتجات قاربت على النفاد
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.slice(0, 6).map((product) => (
                  <span key={product.id} className="rounded-full bg-white/70 px-2 py-1 text-xs text-orange-800 dark:bg-orange-500/15 dark:text-orange-200">
                    {product.name} ({formatNumber(product.stock)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {warehouseStats && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">المخازن والمتاجر وتنبيهات المخزون</h2>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PieCard
              title="المخازن والمتاجر"
              icon={<Warehouse className="h-5 w-5" />}
              data={[
                { name: 'المخازن', value: warehouseStats.warehouses_count, count: warehouseStats.warehouses_count },
                { name: 'المتاجر', value: warehouseStats.stores_count, count: warehouseStats.stores_count },
              ]}
              symbol={symbol}
              countLabel="موقع"
            />
            <PieCard
              title="تنبيهات المنتجات"
              icon={<AlertTriangle className="h-5 w-5" />}
              data={[
                { name: 'منتهية الصلاحية', value: warehouseStats.expired_products, count: warehouseStats.expired_products },
                { name: 'قاربت على الانتهاء', value: warehouseStats.near_expiry_products, count: warehouseStats.near_expiry_products },
                { name: 'قاربت على النفاد', value: warehouseStats.low_stock_products, count: warehouseStats.low_stock_products },
              ]}
              symbol={symbol}
              countLabel="منتج"
            />
          </div>
        </section>
      )}

      {lowStockAlerts.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-amber-800 dark:text-amber-200">
              يوجد {formatNumber(lowStockAlerts.length)} صنف بمخزون منخفض. يرجى التحقق من المخزون.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lowStockAlerts.slice(0, 6).map((item: LowStockItem) => (
                <span
                  key={item.id}
                  className="rounded-full bg-white/70 px-2 py-1 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                >
                  {item.name} ({formatNumber(item.current_stock)})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
