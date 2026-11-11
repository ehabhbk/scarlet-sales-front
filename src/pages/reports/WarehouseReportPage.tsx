import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { Printer } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import { formatNumber, formatDate } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'

interface WarehouseOption {
  id: number
  name: string
  type: string
}

interface BatchRow {
  batch_id: number
  product_id: number
  name: string
  sku?: string
  barcode?: string
  batch_number?: string | null
  quantity: number
  cost_price: number
  sale_price: number
  min_stock: number
  expiry_date?: string | null
  stock_value: number
}

interface WarehouseReportData {
  warehouse: { id: number; name: string; type: string; address?: string | null; phone?: string | null }
  from: string
  to: string
  summary: {
    products_count: number
    total_quantity: number
    stock_value: number
    expired_count: number
    near_expiry_count: number
    low_stock_count: number
  }
  batches: BatchRow[]
  expired: { name: string; batch_number?: string | null; quantity: number; expiry_date?: string; loss: number }[]
  near_expiry: { name: string; batch_number?: string | null; quantity: number; expiry_date?: string }[]
  low_stock: { product_id: number; name: string; quantity: number; min_stock: number }[]
}

export default function WarehouseReportPage() {
  const { symbol } = useSettingsStore()
  const [warehouseId, setWarehouseId] = useState('')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [enabled, setEnabled] = useState(false)

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses')
      return (res.data.warehouses || []) as WarehouseOption[]
    },
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['warehouse-report', warehouseId, fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/warehouse', {
        params: { warehouse_id: warehouseId, from: fromDate, to: toDate },
      })
      return res.data as WarehouseReportData
    },
    enabled: enabled && !!warehouseId,
  })

  const handlePrint = () => window.print()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تقرير المخزن / المتجر</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">تقرير شامل ومفصل عن المخزون والتنبيهات</p>
        </div>
        {data && (
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> طباعة PDF
          </Button>
        )}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">المخزن / المتجر</label>
            <select
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); setEnabled(false) }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">اختر موقعاً</option>
              {(warehouses || []).map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.type === 'store' ? 'متجر' : 'مخزن'})</option>
              ))}
            </select>
          </div>
          <Input label="من تاريخ" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="إلى تاريخ" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={() => setEnabled(true)} disabled={!warehouseId} className="w-full">عرض التقرير</Button>
          </div>
        </div>
      </Card>

      {isLoading && <Card><p className="py-6 text-center text-gray-500">جاري تحميل التقرير...</p></Card>}
      {isError && <Card><p className="py-6 text-center text-red-600">{getApiErrorMessage(error, 'تعذر تحميل التقرير')}</p></Card>}

      {data && (
        <>
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{data.warehouse.name}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Stat value={formatNumber(data.summary.products_count)} label="عدد المنتجات" />
              <Stat value={formatNumber(data.summary.total_quantity)} label="إجمالي الكمية" />
              <Stat value={formatMoney(data.summary.stock_value, symbol)} label="قيمة المخزون" />
              <Stat value={formatNumber(data.summary.expired_count)} label="منتهية الصلاحية" />
              <Stat value={formatNumber(data.summary.near_expiry_count)} label="قاربت على الانتهاء" />
              <Stat value={formatNumber(data.summary.low_stock_count)} label="قاربت على النفاد" />
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">تفاصيل المخزون</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-start">المنتج</th>
                    <th className="px-3 py-2 text-start">SKU</th>
                    <th className="px-3 py-2 text-start">رقم الدفعة</th>
                    <th className="px-3 py-2 text-start">الكمية</th>
                    <th className="px-3 py-2 text-start">تكلفة</th>
                    <th className="px-3 py-2 text-start">سعر البيع</th>
                    <th className="px-3 py-2 text-start">الحد الأدنى</th>
                    <th className="px-3 py-2 text-start">تاريخ الصلاحية</th>
                    <th className="px-3 py-2 text-start">قيمة المخزون</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batches.length === 0 ? (
                    <tr><td className="px-3 py-4 text-center text-gray-500" colSpan={9}>لا توجد منتجات</td></tr>
                  ) : (
                    data.batches.map((b) => (
                      <tr key={b.batch_id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">{b.name}</td>
                        <td className="px-3 py-2">{b.sku || '-'}</td>
                        <td className="px-3 py-2">{b.batch_number || '-'}</td>
                        <td className="px-3 py-2">{formatNumber(b.quantity)}</td>
                        <td className="px-3 py-2">{formatMoney(b.cost_price, symbol)}</td>
                        <td className="px-3 py-2">{formatMoney(b.sale_price, symbol)}</td>
                        <td className="px-3 py-2">{formatNumber(b.min_stock)}</td>
                        <td className="px-3 py-2">{b.expiry_date ? formatDate(b.expiry_date) : '-'}</td>
                        <td className="px-3 py-2">{formatMoney(b.stock_value, symbol)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {data.expired.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-red-700 dark:text-red-300">منتجات منتهية الصلاحية</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-start">المنتج</th>
                      <th className="px-3 py-2 text-start">رقم الدفعة</th>
                      <th className="px-3 py-2 text-start">الكمية</th>
                      <th className="px-3 py-2 text-start">تاريخ الانتهاء</th>
                      <th className="px-3 py-2 text-start">الخسارة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expired.map((e, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">{e.name}</td>
                        <td className="px-3 py-2">{e.batch_number || '-'}</td>
                        <td className="px-3 py-2">{formatNumber(e.quantity)}</td>
                        <td className="px-3 py-2">{e.expiry_date ? formatDate(e.expiry_date) : '-'}</td>
                        <td className="px-3 py-2">{formatMoney(e.loss, symbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {data.near_expiry.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-amber-700 dark:text-amber-300">منتجات قاربت على الانتهاء</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-start">المنتج</th>
                      <th className="px-3 py-2 text-start">رقم الدفعة</th>
                      <th className="px-3 py-2 text-start">الكمية</th>
                      <th className="px-3 py-2 text-start">تاريخ الانتهاء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.near_expiry.map((e, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">{e.name}</td>
                        <td className="px-3 py-2">{e.batch_number || '-'}</td>
                        <td className="px-3 py-2">{formatNumber(e.quantity)}</td>
                        <td className="px-3 py-2">{e.expiry_date ? formatDate(e.expiry_date) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {data.low_stock.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">منتجات قاربت على النفاد</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-start">المنتج</th>
                      <th className="px-3 py-2 text-start">الكمية</th>
                      <th className="px-3 py-2 text-start">الحد الأدنى</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.low_stock.map((e, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">{e.name}</td>
                        <td className="px-3 py-2">{formatNumber(e.quantity)}</td>
                        <td className="px-3 py-2">{formatNumber(e.min_stock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800/40">
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
