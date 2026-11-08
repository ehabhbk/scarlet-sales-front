import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'

import Card from '../../components/common/cards/Card'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import { formatMoney } from '../../store/settingsStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'

interface TableItem {
  id: number
  name: string
  capacity: number
  status: string
  area?: { id: number; name: string }
  orders?: TableOrder[]
}

interface TableOrder {
  id: number
  created_at?: string
  status: string
  order_number?: string
  total_amount?: number
  payment_status?: string
  items?: TableOrderItem[]
}

interface TableOrderItem {
  id: number
  kitchen_status?: string
  product?: { name?: string }
  quantity: number
  total_price?: number
}

const STATUS_LABELS: Record<string, string> = {
  available: 'متاحة',
  occupied: 'مشغولة',
  reserved: 'محجوزة',
  cleaning: 'قيد التنظيف',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'تم الاستلام',
  confirmed: 'تم الاستلام',
  preparing: 'في المطبخ',
  ready: 'جاهز',
  served: 'تم التسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const orderDisplayStatus = (order: TableOrder) => {
  if (order.status === 'served' || order.status === 'completed') return order.status
  const items = order.items || []
  if (items.length > 0 && items.every((item) => item.kitchen_status === 'ready')) {
    return 'ready'
  }
  if (items.some((item) => item.kitchen_status === 'preparing')) {
    return 'preparing'
  }
  return order.status || 'pending'
}

const orderStatusVariant = (status: string) => {
  if (status === 'served' || status === 'completed') return 'success'
  if (status === 'ready') return 'warning'
  if (status === 'preparing') return 'danger'
  return 'warning'
}

const isOccupied = (table: TableItem) => {
  return (
    table.status === 'occupied' ||
    table.status === 'reserved' ||
    (table.orders || []).some((order) => !['completed', 'cancelled'].includes(order.status))
  )
}

function TableVisual({ table, onClick }: { table: TableItem; onClick: () => void }) {
  const occupied = isOccupied(table)
  const chairs = Math.max(1, Number(table.capacity) || 4)
  const radius = 46
  const chairSize = 12

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center gap-2 rounded-2xl p-4 transition-transform hover:scale-[1.02] focus:outline-none"
      title={`${table.name} - ${STATUS_LABELS[table.status] || table.status}`}
    >
      <div className="relative" style={{ width: 120, height: 120 }}>
        {Array.from({ length: chairs }).map((_, index) => {
          const angle = (index / chairs) * Math.PI * 2 - Math.PI / 2
          const x = 60 + radius * Math.cos(angle) - chairSize / 2
          const y = 60 + radius * Math.sin(angle) - chairSize / 2
          return (
            <span
              key={index}
              className={`absolute rounded-full border-2 ${
                occupied
                  ? 'bg-red-500 border-red-600'
                  : 'bg-green-500 border-green-600'
              }`}
              style={{
                left: x,
                top: y,
                width: chairSize,
                height: chairSize,
              }}
            />
          )
        })}
        <span
          className={`absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-4 text-center text-xs font-bold text-white shadow-lg ${
            occupied
              ? 'border-red-700 bg-red-500'
              : 'border-green-700 bg-green-500'
          }`}
        >
          {table.name}
        </span>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          occupied
            ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
            : 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300'
        }`}
      >
        {STATUS_LABELS[table.status] || table.status} • {table.capacity} كرسي
      </span>
    </button>
  )
}

export default function TablesPage() {
  const { symbol } = useSettingsStore()
  const canReleaseTable = useAuthStore((state) => state.user?.permissions?.includes('edit_tables') || false)
  const queryClient = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null)

  const releaseMutation = useMutation({
    mutationFn: async (tableId: number) => {
      await api.put(`/tables/${tableId}`, { status: 'available' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables-all'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['table-details'] })
      setSelectedTable(null)
    },
  })

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables-all'],
    queryFn: async () => {
      const res = await api.get('/tables', { params: { per_page: 100 } })
      const payload = res.data
      return (Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []) as TableItem[]
    },
  })

  const { data: tableDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['table-details', selectedTable?.id],
    queryFn: async () => {
      const res = await api.get(`/tables/${selectedTable!.id}`)
      return (res.data?.table || res.data?.data || res.data) as TableItem
    },
    enabled: !!selectedTable?.id,
  })

  const grouped = (tables || []).reduce<Record<string, TableItem[]>>((acc, table) => {
    const areaName = table.area?.name || 'بدون منطقة'
    acc[areaName] = acc[areaName] || []
    acc[areaName].push(table)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">الطاولات</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          إدارة الطاولات (الإضافة والتعديل والحذف) تتم من الإعدادات ← الطاولات
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}

      {Object.keys(grouped).length === 0 && !isLoading && (
        <Card>
          <p className="text-sm text-gray-500">لا توجد طاولات. أضفها من الإعدادات ← الطاولات.</p>
        </Card>
      )}

      {Object.entries(grouped).map(([areaName, areaTables]) => (
        <Card key={areaName}>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{areaName}</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {areaTables.map((table) => (
              <TableVisual
                key={table.id}
                table={table}
                onClick={() => setSelectedTable(table)}
              />
            ))}
          </div>
        </Card>
      ))}

      <Modal
        isOpen={!!selectedTable}
        onClose={() => setSelectedTable(null)}
        title={`طلبات ${selectedTable?.name || ''}`}
        size="lg"
      >
        {selectedTable && (
          <div className="space-y-4">
            {detailsLoading && <p className="text-sm text-gray-500">جاري تحميل الطلبات...</p>}
            {!detailsLoading && (tableDetails?.status === 'available' || !(tableDetails?.orders || []).length) && (
              <p className="text-sm text-gray-500">لا توجد طلبات نشطة لهذه الطاولة.</p>
            )}
            {tableDetails?.status !== 'available' && [...(tableDetails?.orders || [])]
              .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
              .map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                {(() => {
                  const displayStatus = orderDisplayStatus(order)
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{order.order_number}</p>
                        <p className="text-xs text-gray-500">
                          {ORDER_STATUS_LABELS[displayStatus] || displayStatus} • {formatMoney(order.total_amount, symbol)} • {order.payment_status}
                        </p>
                      </div>
                      <Badge variant={orderStatusVariant(displayStatus)}>
                        {ORDER_STATUS_LABELS[displayStatus] || displayStatus}
                      </Badge>
                    </div>
                  )
                })()}
                {(order.items || []).length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-sm dark:border-gray-800">
                    {(order.items || []).map((item, index: number) => (
                      <div key={item.id || index} className="flex justify-between gap-2">
                        <span>{item.product?.name || 'منتج'} × {item.quantity}</span>
                        <span>{formatMoney(item.total_price ?? 0, symbol)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {canReleaseTable && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => selectedTable && releaseMutation.mutate(selectedTable.id)}
              disabled={releaseMutation.isPending}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {releaseMutation.isPending ? 'جاري التفريغ...' : 'تفريغ الطاولة'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}