import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { Bell, AlertTriangle, PackageX, Clock } from 'lucide-react'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Pagination from '../../components/common/Pagination'
import { formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import type { ProductAlerts } from '../../types'

interface Notification {
  id: number
  title?: string
  message?: string
  type: string
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const queryClient = useQueryClient()
  const { symbol } = useSettingsStore()

  const { data: notifRes, isLoading } = useQuery({
    queryKey: ['notifications', page, unreadOnly],
    queryFn: async () => {
      const res = await api.get(`/notifications?unread_only=${unreadOnly}&page=${page}`)
      return res.data
    },
  })
  const notifications = notifRes?.data as Notification[] | undefined
  const meta = notifRes ? { current_page: notifRes.current_page, last_page: notifRes.last_page, total: notifRes.total, per_page: notifRes.per_page } : null

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['product-alerts'],
    queryFn: async () => {
      const res = await api.get('/product-alerts')
      return res.data as ProductAlerts
    },
    refetchInterval: 60000,
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => { await api.post(`/notifications/${id}/read`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const columns: Column<Notification>[] = [
    { key: 'title', header: 'العنوان', render: (n) => n.title || n.message || '-' },
    { key: 'type', header: 'النوع' },
    { key: 'is_read', header: 'مقروء', render: (n) => n.is_read ? 'نعم' : 'لا' },
    { key: 'created_at', header: 'التاريخ', render: (n) => formatDateTime(n.created_at) },
    { key: 'actions', header: 'الإجراءات', render: (n) => (
      !n.is_read && (
        <button onClick={() => markReadMutation.mutate(n.id)} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded">تعليم كمقروء</button>
      )
    )},
  ]

  const summary = alerts?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">التنبيهات والإشعارات</h1>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            غير مقروءة فقط
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <PackageX className="h-5 w-5" />
            <span className="text-sm font-medium">منتهي الصلاحية</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-300">
            {formatNumber(summary?.expired_lots ?? 0)}
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            {formatNumber(summary?.expired_quantity ?? 0)} وحدة · خسارة {formatMoney(summary?.total_loss ?? 0, symbol)}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">قارب الانتهاء</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
            {formatNumber(summary?.near_expiry_lots ?? 0)}
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
            {formatNumber(summary?.near_expiry_quantity ?? 0)} وحدة
            {alerts?.settings ? ` · خلال ${formatNumber(alerts.settings.near_expiry_days)} يوم` : ''}
          </p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">مخزون منخفض</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-orange-700 dark:text-orange-300">
            {formatNumber(summary?.low_stock_products ?? 0)}
          </p>
          <p className="text-xs text-orange-600/80 dark:text-orange-400/80">
            الحد الافتراضي {formatNumber(alerts?.settings.low_stock_threshold ?? 0)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Bell className="h-5 w-5" />
            <span className="text-sm font-medium">إجمالي التنبيهات</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(summary?.total_alerts ?? 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            آخر تحديث {alerts?.generated_at ? formatDateTime(alerts.generated_at) : '-'}
          </p>
        </div>
      </div>

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
            <PackageX className="h-4 w-4" /> منتجات منتهية الصلاحية
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2">المنتج</th>
                <th className="px-4 py-2">المخزن</th>
                <th className="px-4 py-2">الكمية</th>
                <th className="px-4 py-2">الخسارة</th>
                <th className="px-4 py-2">الصلاحية</th>
              </tr>
            </thead>
            <tbody>
              {(alerts?.expired || []).map((batch) => (
                <tr key={batch.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {batch.product_name}
                    {batch.batch_number ? <span className="ms-1 text-xs text-gray-400">({batch.batch_number})</span> : null}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{batch.warehouse_name || '-'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatNumber(batch.quantity)}</td>
                  <td className="px-4 py-2 font-medium text-red-600 dark:text-red-400">{formatMoney(batch.loss, symbol)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {batch.expiry_date ? formatDate(batch.expiry_date) : '-'}
                    {batch.days_overdue ? <span className="ms-1 text-xs text-red-500">(متأخر {formatNumber(batch.days_overdue)} يوم)</span> : null}
                  </td>
                </tr>
              ))}
              {!alertsLoading && (alerts?.expired || []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">لا توجد منتجات منتهية الصلاحية</td></tr>
              )}
              {alertsLoading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">جاري التحميل...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
            <Clock className="h-4 w-4" /> منتجات قاربت على الانتهاء
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2">المنتج</th>
                <th className="px-4 py-2">المخزن</th>
                <th className="px-4 py-2">الكمية</th>
                <th className="px-4 py-2">القيمة</th>
                <th className="px-4 py-2">الصلاحية</th>
                <th className="px-4 py-2">المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {(alerts?.near_expiry || []).map((batch) => (
                <tr key={batch.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {batch.product_name}
                    {batch.batch_number ? <span className="ms-1 text-xs text-gray-400">({batch.batch_number})</span> : null}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{batch.warehouse_name || '-'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatNumber(batch.quantity)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatMoney(batch.value, symbol)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{batch.expiry_date ? formatDate(batch.expiry_date) : '-'}</td>
                  <td className="px-4 py-2 font-medium text-amber-600 dark:text-amber-400">
                    {batch.days_left === 0 ? 'اليوم' : `${formatNumber(batch.days_left ?? 0)} يوم`}
                  </td>
                </tr>
              ))}
              {!alertsLoading && (alerts?.near_expiry || []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">لا توجد منتجات قاربت على الانتهاء</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-orange-700 dark:text-orange-300">
            <AlertTriangle className="h-4 w-4" /> منتجات قاربت على النفاد
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2">المنتج</th>
                <th className="px-4 py-2">الباركود</th>
                <th className="px-4 py-2">المخزون</th>
                <th className="px-4 py-2">الحد الأدنى</th>
                <th className="px-4 py-2">النقص</th>
              </tr>
            </thead>
            <tbody>
              {(alerts?.low_stock || []).map((product) => (
                <tr key={product.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{product.name}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{product.barcode || product.sku || '-'}</td>
                  <td className="px-4 py-2 font-medium text-orange-600 dark:text-orange-400">{formatNumber(product.stock)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatNumber(product.threshold)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatNumber(product.shortage)}</td>
                </tr>
              ))}
              {!alertsLoading && (alerts?.low_stock || []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">لا توجد منتجات قاربت على النفاد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">الإشعارات العامة</h2>
        </div>
        <DataTable data={notifications || []} columns={columns} loading={isLoading} emptyMessage="لا توجد إشعارات" />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>
    </div>
  )
}
