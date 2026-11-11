import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Loader2, Printer, RefreshCw } from 'lucide-react'
import { api } from '../../services/api'
import Card from '../../components/common/cards/Card'
import Button from '../../components/common/buttons/Button'
import { useSettingsStore, formatMoney, mediaUrl } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { formatDate, formatTime, formatDateTime, formatNumber } from '../../utils/format'
import { printReport } from '../../utils/printReport'

interface ReportDefinition {
  id: string
  label: string
  endpoint: string
  description: string
  sections: string[]
}

interface ShiftCashier {
  shift_id: number
  user_name?: string
  user?: { name?: string }
  orders_count?: number
  total?: number
  by_payment_method?: Record<string, number>
}

interface ShiftOrder {
  id: number
  order_number?: string
  created_at: string
  type: string
  table_name?: string
  cashier_name?: string
  cashier?: { name?: string }
  warehouse_id?: number | null
  warehouse_name?: string | null
  status: string
  total_amount: number
  amount_paid: number
  payment_methods?: Record<string, number>
  items?: { name?: string; quantity: number }[]
}

interface ShiftExpense {
  id: number | string
  expense_date: string
  category?: string
  description?: string
  payment_method?: string
  user_name?: string
  amount: number
  source?: string
}

const REPORTS: ReportDefinition[] = [
  {
    id: 'sales',
    label: 'تقرير المبيعات',
    endpoint: '/reports/sales',
    description: 'إجمالي المبيعات وعدد الطلبات المدفوعة خلال الفترة المحددة.',
    sections: [],
  },
  {
    id: 'profit-loss',
    label: 'الأرباح والخسائر',
    endpoint: '/reports/profit-loss',
    description: 'الإيرادات مقابل المصروفات والمشتريات وصافي الربح.',
    sections: [],
  },
  {
    id: 'top-products',
    label: 'المنتجات الأكثر مبيعاً',
    endpoint: '/reports/top-products',
    description: 'ترتيب المنتجات حسب الكمية المباعة وقيمة الإيراد.',
    sections: ['products'],
  },
  {
    id: 'inventory',
    label: 'تقرير المخزون',
    endpoint: '/reports/inventory',
    description: 'أرصدة المخزون الحالية والحد الأدنى وقيمة المخزون.',
    sections: ['items'],
  },
  {
    id: 'expired-products',
    label: 'تقرير المنتجات منتهية الصلاحية',
    endpoint: '/reports/inventory/expired',
    description: 'الدفعات منتهية الصلاحية وكمياتها وخسائرها.',
    sections: ['expired'],
  },
  {
    id: 'purchases',
    label: 'تقرير المشتريات',
    endpoint: '/reports/purchases',
    description: 'إجمالي قيمة المشتريات خلال الفترة المحددة.',
    sections: [],
  },
  {
    id: 'expenses',
    label: 'تقرير المصروفات',
    endpoint: '/reports/expenses',
    description: 'إجمالي المصروفات المسجلة خلال الفترة المحددة.',
    sections: [],
  },
  {
    id: 'staff',
    label: 'تقرير الموظفين',
    endpoint: '/reports/staff',
    description: 'أداء الموظفين وعدد الطلبات وقيمة المبيعات لكل مستخدم.',
    sections: ['staff'],
  },
  {
    id: 'payment-methods',
    label: 'تقرير طرق الدفع',
    endpoint: '/reports/payment-methods',
    description: 'توزيع المبيعات المدفوعة حسب طريقة الدفع.',
    sections: ['methods'],
  },
  {
    id: 'tax',
    label: 'تقرير الضرائب',
    endpoint: '/reports/tax',
    description: 'إجمالي الضريبة المحتسبة على الطلبات خلال الفترة.',
    sections: [],
  },
  {
    id: 'shifts',
    label: 'تقرير الورديات',
    endpoint: '/reports/shifts',
    description: 'الورديات المفتوحة والمغلقة والنقد الافتتاحي والفعلي والفرق.',
    sections: ['shifts'],
  },
]

const SCALAR_LABELS: Record<string, string> = {
  total_sales: 'إجمالي المبيعات',
  total_orders: 'عدد الطلبات المدفوعة',
  revenue: 'الإيرادات',
  expense: 'المصروفات',
  purchase: 'المشتريات',
  profit: 'صافي الربح',
  total_purchases: 'إجمالي المشتريات',
  total_expenses: 'إجمالي المصروفات',
  total_tax: 'إجمالي الضرائب',
  total_loss: 'إجمالي الخسائر',
  total_quantity: 'إجمالي الكمية',
}

const MONEY_KEYS = new Set([
  'total_sales',
  'revenue',
  'expense',
  'purchase',
  'profit',
  'total_purchases',
  'total_expenses',
  'total_tax',
  'total',
  'sale_price',
  'stock_value',
  'total_loss',
  'opening_cash',
  'expected_cash',
  'actual_cash',
  'difference',
])

const COLUMNS: Record<string, { key: string; label: string }[]> = {
  products: [
    { key: 'name', label: 'المنتج' },
    { key: 'sales_count', label: 'الكمية المباعة' },
    { key: 'revenue', label: 'الإيراد' },
    { key: 'sale_price', label: 'سعر البيع' },
  ],
  items: [
    { key: 'name', label: 'المنتج' },
    { key: 'category', label: 'التصنيف' },
    { key: 'stock', label: 'المخزون' },
    { key: 'min_stock', label: 'الحد الأدنى' },
    { key: 'sale_unit', label: 'وحدة البيع' },
    { key: 'nearest_expiry', label: 'أقرب صلاحية' },
    { key: 'stock_value', label: 'قيمة المخزون' },
  ],
  expired: [
    { key: 'name', label: 'المنتج' },
    { key: 'warehouse', label: 'المخزن' },
    { key: 'batch_number', label: 'رقم الدفعة' },
    { key: 'quantity', label: 'الكمية' },
    { key: 'cost_price', label: 'تكلفة الوحدة' },
    { key: 'loss', label: 'الخسارة' },
    { key: 'expiry_date', label: 'تاريخ الصلاحية' },
    { key: 'days_overdue', label: 'أيام التأخر' },
  ],
  staff: [
    { key: 'name', label: 'الموظف' },
    { key: 'username', label: 'اسم المستخدم' },
    { key: 'role', label: 'الدور' },
    { key: 'orders', label: 'عدد الطلبات' },
    { key: 'revenue', label: 'المبيعات' },
  ],
  methods: [
    { key: 'payment_method_label', label: 'طريقة الدفع' },
    { key: 'total', label: 'الإجمالي' },
    { key: 'count', label: 'عدد العمليات' },
  ],
  shifts: [
    { key: 'shift_date_formatted', label: 'التاريخ' },
    { key: 'id', label: 'رقم الوردية' },
    { key: 'user_name', label: 'الكاشير' },
    { key: 'time_range', label: 'الوقت' },
    { key: 'status_label', label: 'الحالة' },
    { key: 'orders_count', label: 'عدد الطلبات' },
    { key: 'total', label: 'إيراد الكاشير' },
  ],
}

const SECTION_LABELS: Record<string, string> = {
  products: 'المنتجات',
  items: 'أصناف المخزون',
  staff: 'الموظفون',
  methods: 'طرق الدفع',
  shifts: 'الورديات',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  closed: 'مغلقة',
  pending: 'قيد الانتظار',
  confirmed: 'مؤكدة',
  preparing: 'قيد التحضير',
  ready: 'جاهزة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'داخل المطعم',
  takeaway: 'سفري',
  delivery: 'توصيل',
  pickup: 'استلام',
}

const toInputDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const defaultFrom = () => {
  const now = new Date()
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1))
}

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(() => toInputDate(new Date()))
  const { symbol, paymentMethods, load, restaurant, reportSettings } = useSettingsStore()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const reportPermissions: Record<string, string[]> = {
    'profit-loss': ['view_finance'],
    inventory: ['view_inventory'],
    purchases: ['view_purchases'],
    expenses: ['view_finance'],
    staff: ['view_employees'],
    shifts: ['view_all_shifts', 'close_shift'],
  }
  const visibleReports = REPORTS.filter((item) => {
    const required = reportPermissions[item.id]
    return required ? required.some((permission) => permissions.includes(permission)) : permissions.includes('view_reports')
  })
  const canViewShiftReports = permissions.includes('view_all_shifts') || permissions.includes('close_shift')
  const canExport = permissions.includes('export_reports')

  const report = visibleReports.find((item) => item.id === reportType) || visibleReports[0] || REPORTS[0]

  const [mode, setMode] = useState<'reports' | 'shift'>(() =>
    visibleReports.length > 0 ? 'reports' : 'shift'
  )
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)

  useEffect(() => {
    if (visibleReports.length === 0 && canViewShiftReports) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('shift')
    } else if (visibleReports.length > 0 && !canViewShiftReports) {
      setMode('reports')
    }
  }, [visibleReports.length, canViewShiftReports])

  const { data: shiftsData } = useQuery({
    queryKey: ['shifts-list-report'],
    queryFn: async () => {
      const res = await api.get('/shifts', { params: { per_page: 100 } })
      return res.data?.data || res.data || []
    },
    enabled: mode === 'shift',
  })

  const { data: shiftDetail } = useQuery({
    queryKey: ['shift-detail-report', selectedShiftId],
    queryFn: async () => {
      const res = await api.get(`/shifts/${selectedShiftId}`)
      return res.data?.shift || res.data?.data || res.data
    },
    enabled: mode === 'shift' && !!selectedShiftId,
  })

  const { data: shiftRevenueData } = useQuery({
    queryKey: ['shift-revenue-report', selectedShiftId],
    queryFn: async () => {
      const res = await api.get(`/shifts/${selectedShiftId}/revenue`)
      return res.data
    },
    enabled: mode === 'shift' && !!selectedShiftId,
  })

  const shiftTotal = Number(shiftRevenueData?.total) || 0
  const shiftByPayment = shiftRevenueData?.by_payment_method || {}
  const shiftCashiers = (Array.isArray(shiftRevenueData?.cashiers) ? shiftRevenueData.cashiers : []) as ShiftCashier[]
  const shiftOrders = (Array.isArray(shiftRevenueData?.orders) ? shiftRevenueData.orders : []) as ShiftOrder[]
  const shiftExpenses = (Array.isArray(shiftRevenueData?.expenses) ? shiftRevenueData.expenses : []) as ShiftExpense[]
  const shiftExpensesTotal = Number(shiftRevenueData?.expenses_total) || 0
  const shiftNetTotal = Number(shiftRevenueData?.net_total ?? shiftTotal - shiftExpensesTotal) || 0
  const shiftOpeningCash = Number(shiftRevenueData?.opening_cash) || 0
  const shiftExpectedCash = Number(shiftRevenueData?.expected_cash) || 0
  const shiftActualCash = Number(shiftRevenueData?.actual_cash) || 0
  const shiftCashDifference = Number(shiftRevenueData?.difference) || 0

  const { data: reportData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['report', report.id, fromDate, toDate],
    queryFn: async () => {
      void load()
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const res = await api.get(`${report.endpoint}?${params.toString()}`)
      return res.data
    },
    enabled: mode === 'reports' && visibleReports.length > 0,
  })

  const paymentLabel = (value: string) =>
    paymentMethods.find((method) => method.value === value)?.label || value || '-'

  const sections = useMemo(() => {
    if (!reportData) return []
    return report.sections
      .map((key) => {
        const raw = reportData[key]
        if (!Array.isArray(raw)) return null
        let rows = raw

        if (key === 'methods') {
          rows = raw.map((row) => ({
            ...row,
            payment_method_label: paymentLabel(row.payment_method),
          }))
        }

        if (key === 'shifts') {
          rows = raw.map((row) => ({
            ...row,
            user_name: row.user?.name || row.user_name || '-',
            shift_date_formatted: formatDate(row.shift_date || row.created_at),
            time_range: `${formatTime(row.start_time)} - ${formatTime(row.end_time)}`,
            status_label: STATUS_LABELS[row.status] || row.status || '-',
          }))
        }

        return {
          key,
          label: SECTION_LABELS[key] || key,
          columns: COLUMNS[key] || Object.keys(raw[0] || {}).map((column) => ({
            key: column,
            label: column.replace(/_/g, ' '),
          })),
          rows,
        }
      })
      .filter(Boolean) as Array<{
      key: string
      label: string
      columns: { key: string; label: string }[]
      rows: Record<string, unknown>[]
    }>
  }, [reportData, report.sections, paymentMethods])

  const metrics = useMemo(() => {
    if (!reportData) return []
    return Object.entries(reportData)
      .filter(([key, value]) => !['from', 'to'].includes(key) && !Array.isArray(value))
      .map(([key, value]) => ({
        key,
        label: SCALAR_LABELS[key] || key.replace(/_/g, ' '),
        value,
      }))
  }, [reportData])

  const formatValue = (value: unknown, key: string) => {
    if (value === null || value === undefined || value === '') return '-'
    if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())
          ? Number(value)
          : NaN
    if (!Number.isNaN(numeric)) {
      if (MONEY_KEYS.has(key)) return formatMoney(numeric, symbol)
      return formatNumber(numeric)
    }
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const buildExportRows = () => {
    const rows: { section: string; values: Record<string, string> }[] = []
    metrics.forEach((metric) => {
      rows.push({
        section: metric.label,
        values: { value: formatValue(metric.value, metric.key) },
      })
    })
    sections.forEach((section) => {
      section.rows.forEach((row) => {
        const values: Record<string, string> = {}
        section.columns.forEach((column) => {
          values[column.label] = formatValue(row[column.key], column.key)
        })
        rows.push({ section: section.label, values })
      })
    })
    return rows
  }

  const handleExportCsv = () => {
    const rows = buildExportRows()
    const headers = ['القسم', ...Array.from(new Set(rows.flatMap((row) => Object.keys(row.values))))]
    const lines = [
      headers.map(csvCell).join(','),
      ...rows.map((row) =>
        headers.map((header) => csvCell(header === 'القسم' ? row.section : row.values[header] || '')).join(',')
      ),
    ]
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.id}-${fromDate || 'all'}-${toDate || 'all'}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const rangeLabel = `${fromDate ? formatDate(fromDate) : 'كل الفترات'} — ${
      toDate ? formatDate(toDate) : 'اليوم'
    }`

    printReport({
      title: report.label,
      subtitle: report.description,
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'الفترة', value: rangeLabel },
        { label: 'نوع التقرير', value: report.label },
      ],
      kpis: metrics.map((metric) => ({
        label: metric.label,
        value: formatValue(metric.value, metric.key),
      })),
      sections: sections.map((section) => ({
        title: section.label,
        columns: section.columns.map((column) => ({ label: column.label })),
        rows: section.rows.map((row) =>
          section.columns.map((column) => formatValue(row[column.key], column.key))
        ),
      })),
      generatedAt: new Date(),
    })
  }

  const handlePrintShift = () => {
    if (!shiftDetail || !shiftRevenueData) return
    const win = window.open('', '_blank', 'width=1000,height=800')
    if (!win) return

    const methodKeys = Object.keys(shiftByPayment)
    const money = (value: unknown) => formatMoney(Number(value) || 0, symbol)

    const restaurantName = reportSettings.report_show_title !== 'false' ? (restaurant?.name || '') : ''
    const showLogo = reportSettings.report_show_logo !== 'false'
    const restaurantLogo = showLogo ? mediaUrl(restaurant?.logo) : ''
    const restaurantMeta = [
      restaurant?.address,
      reportSettings.report_show_phone !== 'false' && restaurant?.phone ? `هاتف: ${restaurant.phone}` : null,
      reportSettings.report_show_tax_number !== 'false' && restaurant?.tax_number ? `الرقم الضريبي: ${restaurant.tax_number}` : null,
    ].filter(Boolean)

    const methodHeaders = methodKeys
      .map((method) => `<th>${escapeHtml(paymentLabel(method))}</th>`)
      .join('')

    const cashierRowsHtml = shiftCashiers
      .map((cashier) => {
        const methodCells = methodKeys
          .map((method) => `<td class="num">${money(cashier.by_payment_method?.[method] || 0)}</td>`)
          .join('')
        return `<tr>
          <td>${escapeHtml(cashier.user_name || cashier.user?.name || '-')}</td>
          <td class="num">${Number(cashier.orders_count || 0)}</td>
          ${methodCells}
          <td class="num"><strong>${money(cashier.total || 0)}</strong></td>
        </tr>`
      })
      .join('')

    const paymentRowsHtml = Object.entries(shiftByPayment)
      .map(([method, amount]) => {
        const value = Number(amount) || 0
        const percent = shiftTotal > 0 ? (value / shiftTotal) * 100 : 0
        return `<tr>
          <td>${escapeHtml(paymentLabel(method))}</td>
          <td class="num">${money(value)}</td>
          <td class="num">${formatNumber(percent, { maximumFractionDigits: 1 })}%</td>
        </tr>`
      })
      .join('')

    const orderRowsHtml = shiftOrders
      .map((order, index: number) => {
        const items = (order.items || [])
          .map((item) => `${item.name || '-'} × ${Number(item.quantity) || 0}`)
          .join('، ')
        const methods = Object.entries(order.payment_methods || {})
          .map(([method, amount]) => `${paymentLabel(method)}: ${money(amount)}`)
          .join('<br/>')
        const typeLabel = ORDER_TYPE_LABELS[order.type] || order.type || '-'
        const tableLabel = order.table_name ? `<span class="sub">طاولة ${escapeHtml(order.table_name)}</span>` : ''
        return `<tr>
          <td class="num">${index + 1}</td>
          <td class="nowrap">${escapeHtml(order.order_number || '-')}</td>
          <td class="nowrap">${escapeHtml(formatTime(order.created_at))}</td>
          <td>${escapeHtml(typeLabel)}${tableLabel ? `<br/>${tableLabel}` : ''}</td>
          <td class="items">${escapeHtml(items || '-')}</td>
          <td>${escapeHtml(order.warehouse_name || '-')}</td>
          <td class="num">${money(order.total_amount)}</td>
          <td class="num">${money(order.amount_paid)}</td>
          <td class="items">${methods || '-'}</td>
          <td>${escapeHtml(order.cashier_name || order.cashier?.name || '-')}</td>
        </tr>`
      })
      .join('')

    const expenseRowsHtml = shiftExpenses
      .map((expense, index: number) => `<tr>
        <td class="num">${index + 1}</td>
        <td class="nowrap">${escapeHtml(formatDate(expense.expense_date))}</td>
        <td>${escapeHtml(expense.category || '-')}</td>
        <td class="items">${escapeHtml(expense.description || '-')}</td>
        <td>${escapeHtml(paymentLabel(expense.payment_method || 'cash'))}</td>
        <td>${escapeHtml(expense.user_name || '-')}</td>
        <td class="num">${money(expense.amount)}</td>
      </tr>`)
      .join('')

    const summaryRows = [
      ['رصيد افتتاحي للوردية', shiftOpeningCash],
      ['إجمالي المتحصلات / المبيعات', shiftTotal],
      ['إجمالي المصروفات', shiftExpensesTotal],
      ['صافي دخل الوردية', shiftNetTotal],
      ['النقدية المتوقعة', shiftExpectedCash],
      ['النقدية الفعلية', shiftActualCash],
      ['الفرق في النقدية', shiftCashDifference],
    ]
      .map(
        ([label, value]) =>
          `<tr><th>${escapeHtml(label)}</th><td class="num">${money(value)}</td></tr>`
      )
      .join('')

    win.document.write(`
      <html dir="rtl"><head><title>تقرير وردية ${escapeHtml(shiftDetail?.id || '')}</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;margin:0;padding:18px;color:#1f2937;font-size:11px;background:#fff;}
        @page{size:A4 portrait;margin:10mm;}
        .brand{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:12px;}
        .brand-main{display:flex;align-items:center;gap:12px;}
        .brand img{width:66px;height:66px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb;padding:4px;background:#fff;}
        .brand h1{margin:0;font-size:20px;color:#0f766e;}
        .brand p{margin:2px 0;color:#6b7280;font-size:10px;}
        .doc-badge{background:#0f766e;color:#fff;padding:7px 16px;border-radius:999px;font-weight:700;font-size:12px;white-space:nowrap;}
        .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:10.5px;}
        .meta span{color:#6b7280;}
        .meta b{color:#111827;font-weight:600;}
        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}
        .kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px;background:#fff;}
        .kpi .label{color:#6b7280;font-size:10px;display:block;margin-bottom:4px;}
        .kpi .value{font-size:14px;font-weight:700;color:#111827;}
        .kpi.green .value{color:#047857;}
        .kpi.red .value{color:#b91c1c;}
        h2{font-size:13px;margin:16px 0 6px;padding:6px 10px;background:#f1f5f9;border-right:4px solid #0f766e;border-radius:4px;color:#0f172a;}
        table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:4px;}
        th,td{border:1px solid #e5e7eb;padding:5px 6px;text-align:right;vertical-align:middle;}
        th{background:#0f766e;color:#fff;font-weight:600;font-size:9.5px;}
        tbody tr:nth-child(even){background:#f8fafc;}
        tfoot th{background:#e2e8f0;color:#0f172a;}
        .num{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap;}
        .nowrap{white-space:nowrap;}
        .sub{color:#6b7280;font-size:8.5px;}
        .items{color:#374151;font-size:8.5px;max-width:180px;}
        .empty{padding:8px;text-align:center;color:#9ca3af;border:1px dashed #d1d5db;border-radius:6px;margin-bottom:6px;}
        .final table th{width:58%;background:#f8fafc;color:#374151;}
        .final table td{font-weight:700;}
        .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:26px;}
        .sign div{border-top:1px solid #9ca3af;margin-top:34px;padding-top:6px;text-align:center;color:#6b7280;}
        .footer{margin-top:14px;border-top:1px solid #e5e7eb;padding-top:8px;color:#9ca3af;font-size:9px;display:flex;justify-content:space-between;}
        .avoid{page-break-inside:avoid;}
        thead{display:table-header-group;}
        tr{page-break-inside:avoid;}
        @media print{body{padding:0;font-size:10px;}}
      </style></head><body>
        <header class="brand">
          <div class="brand-main">
            ${restaurantLogo ? `<img src="${escapeHtml(restaurantLogo)}" alt="logo" />` : ''}
            <div>
              <h1>${escapeHtml(restaurantName)}</h1>
              ${restaurantMeta.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
            </div>
          </div>
          <div class="doc-badge">تقرير وردية</div>
        </header>

        <section class="meta">
          <div><span>رقم الوردية:</span> <b>${escapeHtml(shiftDetail?.id || '-')}</b></div>
          <div><span>التاريخ:</span> <b>${escapeHtml(formatDate(shiftDetail?.shift_date))}</b></div>
          <div><span>الحالة:</span> <b>${escapeHtml(STATUS_LABELS[shiftDetail?.status] || shiftDetail?.status || '-')}</b></div>
          <div><span>المستخدم المسؤول:</span> <b>${escapeHtml(shiftDetail?.user?.name || '-')}</b></div>
          <div><span>وقت الفتح:</span> <b>${escapeHtml(formatTime(shiftDetail?.start_time) || '-')}</b></div>
          <div><span>وقت الإغلاق:</span> <b>${escapeHtml(shiftDetail?.closed_at ? formatTime(shiftDetail.closed_at) : formatTime(shiftDetail?.end_time) || '-')}</b></div>
        </section>

        <section class="kpis">
          <div class="kpi green"><span class="label">إجمالي المبيعات</span><span class="value">${money(shiftTotal)}</span></div>
          <div class="kpi"><span class="label">عدد الطلبات</span><span class="value">${Number(shiftRevenueData?.orders_count || 0)}</span></div>
          <div class="kpi red"><span class="label">إجمالي المصروفات</span><span class="value">${money(shiftExpensesTotal)}</span></div>
          <div class="kpi ${shiftNetTotal >= 0 ? 'green' : 'red'}"><span class="label">صافي الوردية</span><span class="value">${money(shiftNetTotal)}</span></div>
        </section>

        <section class="avoid">
          <h2>ملخص المتحصلات حسب المستخدم</h2>
          ${
            shiftCashiers.length
              ? `<table>
                  <thead><tr><th>المستخدم</th><th>عدد الطلبات</th>${methodHeaders}<th>الإجمالي</th></tr></thead>
                  <tbody>${cashierRowsHtml}</tbody>
                  <tfoot><tr><th colspan="2">الإجمالي</th>${methodKeys.map((method) => `<th class="num">${money(shiftByPayment[method] || 0)}</th>`).join('')}<th class="num">${money(shiftTotal)}</th></tr></tfoot>
                </table>`
              : '<div class="empty">لا توجد متحصلات مسجلة</div>'
          }
        </section>

        <section class="avoid">
          <h2>تفاصيل طرق الدفع</h2>
          ${
            paymentRowsHtml
              ? `<table><thead><tr><th>طريقة الدفع</th><th>المبلغ</th><th>النسبة</th></tr></thead><tbody>${paymentRowsHtml}</tbody>
                 <tfoot><tr><th>الإجمالي</th><th class="num">${money(shiftTotal)}</th><th class="num">100%</th></tr></tfoot></table>`
              : '<div class="empty">لا توجد مدفوعات مسجلة</div>'
          }
        </section>

        <section>
          <h2>تفاصيل الطلبات</h2>
          ${
            orderRowsHtml
              ? `<table>
                  <thead><tr><th>#</th><th>رقم الطلب</th><th>الوقت</th><th>النوع / الطاولة</th><th>الأصناف</th><th>المخزن</th><th>الإجمالي</th><th>المدفوع</th><th>تفاصيل الدفع</th><th>المستخدم</th></tr></thead>
                  <tbody>${orderRowsHtml}</tbody>
                  <tfoot><tr><th colspan="6">الإجمالي (${shiftOrders.length} طلب)</th><th class="num">${money(shiftOrders.reduce((sum: number, order) => sum + (Number(order.total_amount) || 0), 0))}</th><th class="num">${money(shiftOrders.reduce((sum: number, order) => sum + (Number(order.amount_paid) || 0), 0))}</th><th colspan="2"></th></tr></tfoot>
                </table>`
              : '<div class="empty">لا توجد طلبات في هذه الوردية</div>'
          }
        </section>

        <section>
          <h2>تفاصيل المصروفات</h2>
          ${
            expenseRowsHtml
              ? `<table><thead><tr><th>#</th><th>التاريخ</th><th>البند</th><th>الوصف</th><th>طريقة الدفع</th><th>المستخدم</th><th>المبلغ</th></tr></thead>
                 <tbody>${expenseRowsHtml}</tbody>
                 <tfoot><tr><th colspan="6">إجمالي المصروفات</th><th class="num">${money(shiftExpensesTotal)}</th></tr></tfoot></table>`
              : '<div class="empty">لا توجد مصروفات مسجلة لهذه الوردية</div>'
          }
        </section>

        <section class="final avoid">
          <h2>الملخص المالي النهائي للوردية</h2>
          <table><tbody>${summaryRows}</tbody></table>
        </section>

        <section class="signatures avoid">
          <div class="sign"><div>توقيع الكاشير</div></div>
          <div class="sign"><div>توقيع المدير</div></div>
        </section>

        <footer class="footer">
          <span>تم إنشاء التقرير في ${escapeHtml(formatDateTime(new Date()))}</span>
          <span>${escapeHtml(restaurantName)} — تقرير الوردية رقم ${escapeHtml(shiftDetail?.id || '-')}</span>
        </footer>
        <script>window.onload = function(){ window.print(); };</script>
      </body></html>
    `)
    win.document.close()
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">التقارير</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            تقارير تشغيلية ومالية مبنية على بيانات النظام الفعلية
          </p>
        </div>
        {mode === 'reports' && (
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw className="w-4 h-4" />
            تحديث البيانات
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {visibleReports.length > 0 && (
          <button onClick={() => setMode('reports')} className={`px-4 py-2 border-b-2 font-medium ${mode === 'reports' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>التقارير</button>
        )}
        {canViewShiftReports && (
          <button onClick={() => setMode('shift')} className={`px-4 py-2 border-b-2 font-medium ${mode === 'shift' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>تقرير وردية</button>
        )}
      </div>

      {mode === 'shift' && (
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">اختر الوردية</label>
              <select
                value={selectedShiftId || ''}
                onChange={(e) => setSelectedShiftId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">-- اختر --</option>
                {(Array.isArray(shiftsData) ? shiftsData : []).map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} - {formatDate(s.shift_date)}
                  </option>
                ))}
              </select>
            </div>
            {shiftDetail && selectedShiftId && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                  <Card padding="sm">
                    <p className="text-sm text-gray-500">عدد الكاشيرين</p>
                    <p className="text-lg font-bold">{new Set(shiftOrders.map((o) => o.cashier_name || o.cashier?.name || o.id)).size || shiftCashiers.filter((c) => (c.orders_count || 0) > 0).length}</p>
                  </Card>
                  <Card padding="sm">
                    <p className="text-sm text-gray-500">إجمالي الوردية</p>
                    <p className="text-lg font-bold">{formatMoney(shiftTotal, symbol)}</p>
                  </Card>
                  <Card padding="sm">
                    <p className="text-sm text-gray-500">عدد الطلبات</p>
                    <p className="text-lg font-bold">{Number(shiftRevenueData?.orders_count || 0)}</p>
                  </Card>
                  <Card padding="sm">
                    <p className="text-sm text-gray-500">إجمالي المصروفات</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatMoney(shiftExpensesTotal, symbol)}</p>
                  </Card>
                  <Card padding="sm">
                    <p className="text-sm text-gray-500">صافي الوردية</p>
                    <p className={`text-lg font-bold ${shiftNetTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatMoney(shiftNetTotal, symbol)}
                    </p>
                  </Card>
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">الإيراد حسب الكاشير</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-start">الكاشير</th>
                          <th className="px-3 py-2 text-start">عدد الطلبات</th>
                          <th className="px-3 py-2 text-start">الإيراد</th>
                          <th className="px-3 py-2 text-start">طرق الدفع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftCashiers.filter((cashier) => (cashier.orders_count || 0) > 0).map((cashier) => (
                          <tr key={cashier.shift_id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2">{cashier.user_name || cashier.user?.name || '-'}</td>
                            <td className="px-3 py-2">{Number(cashier.orders_count || 0)}</td>
                            <td className="px-3 py-2">{formatMoney(Number(cashier.total || 0), symbol)}</td>
                            <td className="px-3 py-2 text-xs">
                              {Object.entries(cashier.by_payment_method || {})
                                .map(([method, amount]) => `${method}: ${formatMoney(Number(amount) || 0, symbol)}`)
                                .join(' | ') || '-'}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-semibold bg-gray-50 dark:bg-gray-800">
                          <td className="px-3 py-2" colSpan={2}>الإجمالي</td>
                          <td className="px-3 py-2">{formatMoney(shiftTotal, symbol)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">الإيرادات حسب طريقة الدفع</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[320px] text-sm">
                      <thead><tr className="bg-gray-50 dark:bg-gray-800"><th className="whitespace-nowrap px-3 py-2 text-start">طريقة الدفع</th><th className="whitespace-nowrap px-3 py-2 text-start">المبلغ</th></tr></thead>
                      <tbody>
                        {Object.entries(shiftByPayment).map(([m, amt]) => (
                          <tr key={m} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2">{paymentLabel(m)}</td>
                            <td className="px-3 py-2">{formatNumber(Number(amt))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">تفاصيل الطلبات</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-start">رقم الطلب</th>
                          <th className="px-3 py-2 text-start">الوقت</th>
                          <th className="px-3 py-2 text-start">النوع / الطاولة</th>
                          <th className="px-3 py-2 text-start">الأصناف</th>
                          <th className="px-3 py-2 text-start">المخزن</th>
                          <th className="px-3 py-2 text-start">الإجمالي</th>
                          <th className="px-3 py-2 text-start">المدفوع</th>
                          <th className="px-3 py-2 text-start">تفاصيل الدفع</th>
                          <th className="px-3 py-2 text-start">الكاشير</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftOrders.length === 0 ? (
                          <tr>
                            <td className="px-3 py-4 text-center text-gray-500" colSpan={9}>لا توجد طلبات في هذه الوردية</td>
                          </tr>
                        ) : (
                          shiftOrders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="px-3 py-2 whitespace-nowrap">{order.order_number || '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatTime(order.created_at)}</td>
                              <td className="px-3 py-2">
                                {ORDER_TYPE_LABELS[order.type] || order.type || '-'}
                                {order.table_name ? <span className="block text-xs text-gray-500">طاولة {order.table_name}</span> : null}
                              </td>
                              <td className="px-3 py-2 max-w-[220px] text-xs text-gray-600 dark:text-gray-300">
                                {(order.items || []).map((item) => `${item.name} × ${item.quantity}`).join('، ') || '-'}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">{order.warehouse_name || '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatMoney(Number(order.total_amount) || 0, symbol)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatMoney(Number(order.amount_paid) || 0, symbol)}</td>
                              <td className="px-3 py-2 text-xs">
                                {Object.entries(order.payment_methods || {})
                                  .map(([method, amount]) => `${paymentLabel(method)}: ${formatMoney(Number(amount) || 0, symbol)}`)
                                  .join(' | ') || '-'}
                              </td>
                              <td className="px-3 py-2">{order.cashier_name || order.cashier?.name || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">تفاصيل المصروفات</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-start">التاريخ</th>
                          <th className="px-3 py-2 text-start">البند</th>
                          <th className="px-3 py-2 text-start">الوصف</th>
                          <th className="px-3 py-2 text-start">طريقة الدفع</th>
                          <th className="px-3 py-2 text-start">المستخدم</th>
                          <th className="px-3 py-2 text-start">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftExpenses.length === 0 ? (
                          <tr>
                            <td className="px-3 py-4 text-center text-gray-500" colSpan={6}>لا توجد مصروفات مسجلة لهذه الوردية</td>
                          </tr>
                        ) : (
                          shiftExpenses.map((expense) => (
                            <tr key={expense.id} className={`border-b border-gray-100 dark:border-gray-800 ${expense.source === 'wage' ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
                              <td className="px-3 py-2 whitespace-nowrap">{formatDate(expense.expense_date)}</td>
                              <td className="px-3 py-2">{expense.category || '-'}</td>
                              <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{expense.description || '-'}</td>
                              <td className="px-3 py-2">{paymentLabel(expense.payment_method || 'cash')}</td>
                              <td className="px-3 py-2">{expense.user_name || '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatMoney(Number(expense.amount) || 0, symbol)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {shiftExpenses.length > 0 && (
                        <tfoot>
                          <tr className="font-semibold bg-gray-50 dark:bg-gray-800">
                            <td className="px-3 py-2" colSpan={5}>إجمالي المصروفات</td>
                            <td className="px-3 py-2 whitespace-nowrap">{formatMoney(shiftExpensesTotal, symbol)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">الملخص المالي النهائي للوردية</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      ['رصيد افتتاحي', shiftOpeningCash],
                      ['إجمالي المتحصلات', shiftTotal],
                      ['إجمالي المصروفات', shiftExpensesTotal],
                      ['صافي الوردية', shiftNetTotal],
                      ['النقدية المتوقعة', shiftExpectedCash],
                      ['النقدية الفعلية', shiftActualCash],
                      ['فرق النقدية', shiftCashDifference],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="font-semibold mt-1">{formatMoney(Number(value) || 0, symbol)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePrintShift}>
                    <Printer className="w-4 h-4" />
                    طباعة / PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {mode === 'reports' ? (
        <>
      <Card>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {visibleReports.map((item) => {
            const active = item.id === report.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id)}
                className={`whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              من تاريخ
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
          <div className="flex gap-2">
            {canExport && (
              <Button variant="outline" onClick={handleExportCsv}>
                <FileSpreadsheet className="w-4 h-4" />
                تصدير CSV / Excel
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              طباعة / PDF
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            جاري تحميل التقرير...
          </div>
        </Card>
      ) : !reportData ? (
        <Card>
          <p className="text-center py-12 text-gray-500">لا توجد بيانات لهذا التقرير</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {metrics.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric) => (
                <Card key={metric.key} padding="sm">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                    {formatValue(metric.value, metric.key)}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {sections.map((section) => (
            <Card key={section.key} padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-2 gap-3 px-2 py-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {section.label}
                </h2>
                <span className="text-sm text-gray-500">{section.rows.length} سجل</span>
              </div>
              {section.rows.length === 0 ? (
                <p className="text-center py-8 text-gray-500">لا توجد بيانات للفترة المحددة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        {section.columns.map((column) => (
                          <th
                            key={column.key}
                            className="px-3 py-2.5 text-start font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, index) => (
                        <tr
                          key={String(row.id ?? index)}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          {section.columns.map((column) => (
                            <td
                              key={column.key}
                              className="px-3 py-2.5 text-gray-700 dark:text-gray-200"
                            >
                              {formatValue(row[column.key], column.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {section.key === 'shifts' && (
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold dark:bg-gray-800">
                          {section.columns.map((column, index) => (
                            <td key={column.key} className="px-3 py-2.5">
                              {index === 0
                                ? 'الإجمالي'
                                : column.key === 'total'
                                  ? formatMoney(
                                      section.rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
                                      symbol
                                    )
                                  : column.key === 'orders_count'
                                    ? section.rows.reduce((sum, row) => sum + (Number(row.orders_count) || 0), 0)
                                    : ''}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </Card>
          ))}

          {metrics.length === 0 && sections.every((section) => section.rows.length === 0) && (
            <Card>
              <p className="text-center py-8 text-gray-500">لا توجد بيانات للفترة المحددة</p>
            </Card>
          )}
        </div>
      )}
        </>
      ) : null}
    </div>
  )
}
