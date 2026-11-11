import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { RefreshCw } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Card from '../../components/common/cards/Card'
import Badge from '../../components/common/data-display/Badge'
import { formatNumber } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'

interface RequestRecord {
  id: number
  from_warehouse_id: number
  to_warehouse_id: number
  product_id: number
  requested_quantity: number
  approved_quantity?: number | null
  status: string
  requested_by?: number
  approved_by?: number
  received_by?: number
  notes?: string | null
  fromWarehouse?: { id: number; name: string }
  toWarehouse?: { id: number; name: string }
  product?: { id: number; name: string; barcode?: string | null }
  requester?: { id: number; name: string }
  approver?: { id: number; name: string }
  receiver?: { id: number; name: string }
}

export default function StockRequestsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canManageStock = permissions.includes('manage_stock')
  const canRequestStock = permissions.includes('request_stock_for_store')
  const canView = canManageStock || canRequestStock || permissions.includes('view_stores')
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('')

  const { data: requests, isLoading } = useQuery({
    queryKey: ['stock-requests', statusFilter],
    queryFn: async () => {
      let url = '/stock-requests'
      if (statusFilter) url += `?status=${statusFilter}`
      const res = await api.get(url)
      return (res.data.data || []) as RequestRecord[]
    },
    enabled: canView,
  })

  const approveMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/stock-requests/${id}/approve`),
    onSuccess: () => {
      toast.success('تمت الموافقة على الطلب')
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر الموافقة على الطلب')),
  })

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/stock-requests/${id}/reject`),
    onSuccess: () => {
      toast.success('تم رفض الطلب')
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر رفض الطلب')),
  })

  const receiveMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/stock-requests/${id}/receive`),
    onSuccess: () => {
      toast.success('تم استلام الكمية وترحيلها إلى المتجر')
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر استلام الطلب')),
  })

  const filtered = useMemo(() => {
    if (!requests) return []
    if (!statusFilter) return requests
    return requests.filter((r) => r.status === statusFilter)
  }, [requests, statusFilter])

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'معلق'
      case 'approved': return 'معتمد'
      case 'completed': return 'مكتمل'
      case 'rejected': return 'مرفوض'
      default: return status
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'approved': return 'info'
      case 'completed': return 'success'
      case 'rejected': return 'danger'
      default: return 'default'
    }
  }

  if (!canView) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-red-500">لا يوجد لديك صلاحية عرض الطلبات</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إدارة الطلبات</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            طلبات المخزون الواردة من المتاجر إلى المخازن.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">جميع الحالات</option>
            <option value="pending">معلق</option>
            <option value="approved">معتمد</option>
            <option value="completed">مكتمل</option>
            <option value="rejected">مرفوض</option>
          </select>
          <Button onClick={() => { setStatusFilter(''); queryClient.invalidateQueries({ queryKey: ['stock-requests'] }) }}>
            <RefreshCw className="w-4 h-4" /> تحديث
          </Button>
        </div>
      </div>

      <Card className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">طلبات المخزون</h2>
          <Badge variant="info">{filtered.length} طلب</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-start">المتجر</th>
                <th className="px-3 py-2 text-start">المنتج</th>
                <th className="px-3 py-2 text-start">الكمية المطلوبة</th>
                <th className="px-3 py-2 text-start">مقدم الطلب</th>
                <th className="px-3 py-2 text-start">الحالة</th>
                <th className="px-3 py-2 text-start">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-gray-500">جارٍ تحميل الطلبات...</td></tr>
              ) : (
                <>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">لا توجد طلبات</td></tr>
                  )}
                  {filtered.map((req) => (
                    <tr key={req.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{req.toWarehouse?.name || req.to_warehouse_id}</td>
                      <td className="px-3 py-2">{req.product?.name || req.product_id}</td>
                      <td className="px-3 py-2">{formatNumber(req.requested_quantity)}</td>
                      <td className="px-3 py-2">{req.requester?.name || '-'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(req.status)}>{statusLabel(req.status)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {req.status === 'pending' && canManageStock && (
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="success" onClick={() => approveMutation.mutate(req.id)}>قبول</Button>
                            <Button size="sm" variant="danger" onClick={() => rejectMutation.mutate(req.id)}>رفض</Button>
                          </div>
                        )}
                        {req.status === 'approved' && canManageStock && (
                          <Button size="sm" variant="primary" onClick={() => receiveMutation.mutate(req.id)}>تأكيد استلام</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
