import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { Search, Eye, XCircle, Trash2 } from 'lucide-react'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import Pagination from '../../components/common/Pagination'
import { mediaUrl } from '../../store/settingsStore'
import { formatDateTime } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'

interface OrderItemModifier {
  modifier?: string
  option?: string
  name?: string
}

interface OrderItem {
  id: number
  product?: { image?: string; name?: string }
  quantity: number
  size?: { name?: string }
  modifiers?: OrderItemModifier[]
  total_price: number
}

interface OrderRecord {
  id: number
  order_number: string
  cashier?: { name?: string }
  type: string
  status: string
  total_amount: number
  payment_status: string
  created_at: string
  items?: OrderItem[]
  payments?: { amount: number; method?: string }[]
  payment_method?: string
  amount_paid?: number
}

interface OrderPayload {
  id?: number
  order?: { data?: OrderRecord } | OrderRecord
  data?: { order?: OrderRecord } | OrderRecord
}

export default function OrdersPage() {
  const { symbol, paymentMethods, load } = useSettingsStore()
  const user = useAuthStore((state) => state.user)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [paymentDraftRows, setPaymentDraftRows] = useState<{ method: string; amount: string }[]>([])
  const queryClient = useQueryClient()
  const can = (permission: string) => user?.permissions?.includes(permission) ?? false

  useEffect(() => {
    void load()
  }, [load])

  const paymentMethod = paymentMethods.some((method) => method.value === selectedPaymentMethod)
    ? selectedPaymentMethod
    : paymentMethods[0]?.value || ''

  const unwrapOrder = (payload: unknown): OrderRecord | null => {
    if (typeof payload !== 'object' || payload === null) return null
    const data = payload as OrderPayload
    if (data.order) {
      if ('data' in data.order) return data.order.data || null
      return data.order as OrderRecord
    }
    if (data.data) {
      if ('order' in data.data) return data.data.order || null
      return data.data as OrderRecord
    }
    return typeof data.id === 'number' ? data as OrderRecord : null
  }

  const buildPaymentRows = (order: OrderRecord) => {
    const defaultMethod = order?.payment_method || paymentMethods[0]?.value || ''
    const payments = (order?.payments || []).filter((payment) => Number(payment.amount) > 0)
    if (payments.length > 0) {
      return payments.map((payment) => ({
        method: payment.method || defaultMethod,
        amount: String(Number(payment.amount)),
      }))
    }
    if (Number(order?.amount_paid) > 0) {
      return [{ method: defaultMethod, amount: String(Number(order.amount_paid)) }]
    }
    return [{ method: defaultMethod, amount: '' }]
  }

  const openOrderDetails = async (order: OrderRecord) => {
    setSelectedOrder(order)
    setPaymentDraftRows(buildPaymentRows(order))
    try {
      const res = await api.get(`/orders/${order.id}`)
      const details = unwrapOrder(res.data)
      if (details?.id) {
        setSelectedOrder(details)
        setPaymentDraftRows(buildPaymentRows(details))
      }
    } catch {
      // Keep the row data we already have from the list response.
    }
  }

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ['orders', search, statusFilter, page],
    queryFn: async () => {
      let url = `/orders?search=${search}&page=${page}`
      if (statusFilter) url += `&status=${statusFilter}`
      const res = await api.get(url)
      return { ...res.data, data: res.data.data as OrderRecord[] }
    },
  })
  const orders = ordersRes?.data as OrderRecord[] | undefined
  const ordersMeta = ordersRes ? { current_page: ordersRes.current_page, last_page: ordersRes.last_page, total: ordersRes.total, per_page: ordersRes.per_page } : null

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await api.post(`/orders/${id}/cancel`, { reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelectedOrder(null)
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await api.post(`/orders/${id}/status`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const paymentMutation = useMutation({
    mutationFn: async ({ id, amount, method }: { id: number; amount: number; method: string }) => {
      await api.post(`/orders/${id}/payment`, { amount, method })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const updatePaymentsMutation = useMutation({
    mutationFn: async ({ id, payments }: { id: number; payments: { method: string; amount: number }[] }) => {
      const res = await api.put(`/orders/${id}/payments`, { payments })
      return res.data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      const fresh = unwrapOrder(data)
      if (fresh?.id) {
        setSelectedOrder(fresh)
        setPaymentDraftRows(buildPaymentRows(fresh))
      } else if (selectedOrder) {
        const res = await api.get(`/orders/${selectedOrder.id}`)
        const details = unwrapOrder(res.data)
        if (details?.id) {
          setSelectedOrder(details)
          setPaymentDraftRows(buildPaymentRows(details))
        }
      }
      toast.success('تم تحديث دفعات الطلب')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر تحديث دفعات الطلب')),
  })

  const refundMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/orders/${id}/refund`, { reason: 'استرداد من إدارة الطلبات' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelectedOrder(null)
      toast.success('تم استرداد المبلغ')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر استرداد الطلب')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/orders/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelectedOrder(null)
      toast.success('تم حذف الطلب')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حذف الطلب')),
  })

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    pending: 'warning',
    confirmed: 'info',
    preparing: 'info',
    ready: 'success',
    served: 'success',
    completed: 'success',
    cancelled: 'danger',
  }

  const columns: Column<OrderRecord>[] = [
    { key: 'order_number', header: 'رقم الطلب' },
    { key: 'cashier', header: 'الكاشير', render: (item) => item.cashier?.name || '-' },
    { key: 'type', header: 'النوع', render: (item) => 
      item.type === 'dine_in' ? 'داخل المطعم' : item.type === 'takeaway' ? 'سفري' : 'توصيل'
    },
    { key: 'status', header: 'الحالة', render: (item) => (
      <Badge variant={statusColors[item.status] || 'default'}>
        {item.status}
      </Badge>
    )},
    { key: 'total_amount', header: 'المبلغ', render: (item) => formatMoney(item.total_amount, symbol) },
    { key: 'payment_status', header: 'الدفع', render: (item) => (
      <Badge variant={item.payment_status === 'paid' ? 'success' : 'warning'}>
        {item.payment_status}
      </Badge>
    )},
    { key: 'created_at', header: 'التاريخ', render: (item) => formatDateTime(item.created_at) },
    { key: 'actions', header: 'الإجراءات', render: (item) => (
      <div className="flex gap-2">
        <button onClick={() => openOrderDetails(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded dark:text-blue-400 dark:hover:bg-blue-950/40">
          <Eye className="w-4 h-4" />
        </button>
        {can('cancel_orders') && !['completed', 'cancelled'].includes(item.status) && (
          <button onClick={() => cancelMutation.mutate({ id: item.id, reason: 'إلغاء من قبل الكاشير' })} className="p-1 text-red-600 hover:bg-red-50 rounded dark:text-red-400 dark:hover:bg-red-950/40">
            <XCircle className="w-4 h-4" />
          </button>
        )}
        {can('delete_orders') && (
          <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-red-700 hover:bg-red-50 rounded dark:hover:bg-red-950/40" title="حذف الطلب">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الطلبات</h1>
      </div>

      <Card>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="بحث عن طلب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-5 h-5" />}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700"
          >
            <option value="">جميع الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="confirmed">مؤكد</option>
            <option value="preparing">قيد التحضير</option>
            <option value="ready">جاهز</option>
            <option value="served">تم التقديم</option>
            <option value="completed">مكتمل</option>
            <option value="cancelled">ملغى</option>
          </select>
        </div>

        <DataTable
          data={orders || []}
          columns={columns}
          loading={isLoading}
          emptyMessage="لا توجد طلبات"
        />
        <Pagination meta={ordersMeta} onPageChange={setPage} />
      </Card>

      <Modal
        isOpen={!!selectedOrder}
        onClose={() => {
          setSelectedOrder(null)
          setPaymentDraftRows([])
        }}
        title={`تفاصيل الطلب ${selectedOrder?.order_number}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">الحالة</p>
                <Badge variant={statusColors[selectedOrder.status] || 'default'}>{selectedOrder.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">المبلغ الإجمالي</p>
                <p className="font-bold">{formatMoney(selectedOrder.total_amount, symbol)}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">المنتجات</h3>
              <div className="space-y-2">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 gap-3 p-2 bg-gray-50 rounded dark:bg-gray-800/40">
                    <div className="flex min-w-0 items-center gap-3">
                      {item.product?.image && (
                        <img src={mediaUrl(item.product.image)} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate">
                          {item.product?.name} × {item.quantity}
                          {item.size?.name && <span className="text-xs text-gray-400"> ({item.size.name})</span>}
                        </p>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <p className="truncate text-xs text-gray-500">
                            {item.modifiers
                              .map((modifier) =>
                                [modifier.modifier, modifier.option].filter(Boolean).join(': ') || modifier.name
                              )
                              .join('، ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0">{formatMoney(item.total_price, symbol)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">تغيير الحالة</h3>
              <div className="flex flex-wrap gap-2">
                {['confirmed','preparing','ready','served','completed'].map((s) => (
                    can('edit_orders') && (
                      <button
                        key={s}
                        onClick={() => statusMutation.mutate({ id: selectedOrder.id, status: s })}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        {s}
                      </button>
                    )
                  ))}
              </div>
            </div>

            {(can('edit_orders') || can('edit_order_payment')) && selectedOrder.payment_status !== 'paid' && (
              <div>
                <h3 className="font-semibold mb-2">تسجيل دفعة</h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="المبلغ"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700"
                  />
                  <select
                    value={paymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                  <button
                    disabled={!paymentMethod || paymentMethods.length === 0}
                    onClick={() => paymentMutation.mutate({ id: selectedOrder.id, amount: Number(paymentAmount), method: paymentMethod })}
                    className="px-4 py-2 bg-primary text-white rounded-lg"
                  >
                    تسجيل
                  </button>
                </div>
              </div>
            )}
            {can('edit_order_payment') && (() => {
              const total = Number(selectedOrder.total_amount) || 0
              const rowsTotal = paymentDraftRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
              const remaining = Number((total - rowsTotal).toFixed(2))
              const validRows = paymentDraftRows.length > 0
                && paymentDraftRows.every((row) => row.method && Number(row.amount) > 0)
              const canEditPayments = selectedOrder.status !== 'cancelled'
                && selectedOrder.payment_status !== 'refunded'
              return (
                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <h3 className="font-semibold mb-1">تعديل دفعات الطلب</h3>
                  <p className="mb-3 text-xs text-gray-500">
                    يمكنك إضافة أكثر من دفعة بأكثر من طريقة دفع. إجمالي الدفعات يُحدّث المدفوع وحالة الدفع تلقائياً.
                  </p>
                  <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-2 text-sm dark:bg-gray-800 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-gray-500">الإجمالي</p>
                      <p className="font-semibold">{formatMoney(total, symbol)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">الدفعات</p>
                      <p className="font-semibold">{formatMoney(rowsTotal, symbol)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">المتبقي</p>
                      <p className={`font-semibold ${remaining > 0 ? 'text-amber-600 dark:text-amber-400' : remaining < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                        {formatMoney(Math.abs(remaining), symbol)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {paymentDraftRows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={row.method}
                          onChange={(e) => setPaymentDraftRows((current) => current.map((line, lineIndex) =>
                            lineIndex === index ? { ...line, method: e.target.value } : line
                          ))}
                          className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900"
                          aria-label="طريقة الدفع"
                        >
                          {!paymentMethods.some((method) => method.value === row.method) && row.method && (
                            <option value={row.method}>{row.method}</option>
                          )}
                          {paymentMethods.map((method) => (
                            <option key={method.value} value={method.value}>{method.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => setPaymentDraftRows((current) => current.map((line, lineIndex) =>
                            lineIndex === index ? { ...line, amount: e.target.value } : line
                          ))}
                          placeholder="المبلغ"
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900"
                          aria-label="مبلغ الدفعة"
                        />
                        <button
                          type="button"
                          onClick={() => setPaymentDraftRows((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                          disabled={paymentDraftRows.length === 1}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40 dark:text-red-400"
                          aria-label="حذف الدفعة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentDraftRows((current) => [
                        ...current,
                        {
                          method: current[current.length - 1]?.method || paymentMethods[0]?.value || '',
                          amount: '',
                        },
                      ])}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      + إضافة دفعة
                    </button>
                    <button
                      type="button"
                      disabled={!canEditPayments || !validRows || updatePaymentsMutation.isPending}
                      onClick={() => updatePaymentsMutation.mutate({
                        id: Number(selectedOrder.id),
                        payments: paymentDraftRows.map((row) => ({
                          method: row.method,
                          amount: Number(row.amount) || 0,
                        })),
                      })}
                      className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
                    >
                      {updatePaymentsMutation.isPending ? 'جاري الحفظ...' : 'حفظ الدفعات'}
                    </button>
                  </div>
                  {paymentMethods.length === 0 && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">لا توجد طرق دفع مهيأة في الإعدادات.</p>
                  )}
                </div>
              )
            })()}
            {can('refund_orders') && ['paid', 'partial'].includes(selectedOrder.payment_status) && (
              <button
                onClick={() => refundMutation.mutate(selectedOrder.id)}
                disabled={refundMutation.isPending}
                className="rounded-lg bg-amber-600 px-4 py-2 text-white disabled:opacity-50"
              >
                استرداد الطلب
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
