import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useSettingsStore, formatMoney } from '../../store/settingsStore'
import { DollarSign, Plus } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import DataTable, { type Column } from '../../components/common/tables/DataTable'
import Modal from '../../components/common/modals/Modal'
import Badge from '../../components/common/data-display/Badge'
import { useAuthStore } from '../../store/authStore'
import { formatNumber, formatDate } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiError'

interface PurchaseRecord {
  id: number
  purchase_number: string
  supplier?: { name: string }
  status: string
  total_amount: number
  amount_paid: number
  account?: { name: string }
  payment_status: string
  order_date: string
}

interface PurchaseLineItem {
  inventory_item_id: string
  quantity: number | string
  unit_cost: number | string
}

interface PurchaseFormProps {
  suppliers: { id: number; name: string }[]
  items: { id: number; name: string; cost_per_unit: number }[]
  accounts: { id: number; code: string; name: string; type: string; is_active: boolean }[]
  paymentMethods: { value: string; label: string }[]
  onClose: () => void
  onSuccess: () => void
}

export default function PurchasesPage() {
  const { symbol, paymentMethods } = useSettingsStore()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreate = permissions.includes('create_purchases')
  const [showModal, setShowModal] = useState(false)
  const [payingPurchase, setPayingPurchase] = useState<PurchaseRecord | null>(null)
  const queryClient = useQueryClient()

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const res = await api.get('/purchases')
      const payload = res.data.data || res.data
      return (Array.isArray(payload) ? payload : payload?.data || []) as PurchaseRecord[]
    },
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/suppliers')
      return (res.data.suppliers || []) as PurchaseFormProps['suppliers']
    },
  })

  const { data: items } = useQuery({
    queryKey: ['inventory-items-all'],
    queryFn: async () => {
      const res = await api.get('/inventory-items')
      return (res.data.data || []) as PurchaseFormProps['items']
    },
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => ((await api.get('/accounts')).data?.accounts || []) as PurchaseFormProps['accounts'],
  })

  const paymentMutation = useMutation({
    mutationFn: async ({ purchaseId, amount, method }: { purchaseId: number; amount: number; method: string }) =>
      api.post(`/purchases/${purchaseId}/payment`, { amount, method }),
    onSuccess: () => {
      setPayingPurchase(null)
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      toast.success('تم تسجيل الدفعة وقيدها')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر تسجيل الدفعة')),
  })

  const columns: Column<PurchaseRecord>[] = [
    { key: 'purchase_number', header: 'رقم الطلب' },
    { key: 'supplier', header: 'المورد', render: (p) => p.supplier?.name || '-' },
    { key: 'status', header: 'الحالة', render: (p) => <Badge variant={p.status === 'received' ? 'success' : 'warning'}>{p.status}</Badge> },
    { key: 'total_amount', header: 'المبلغ', render: (p) => formatMoney(p.total_amount, symbol) },
    { key: 'amount_paid', header: 'المدفوع', render: (p) => formatMoney(p.amount_paid, symbol) },
    { key: 'account', header: 'حساب الشراء', render: (p) => p.account?.name || '-' },
    { key: 'payment_status', header: 'الدفع' },
    { key: 'order_date', header: 'التاريخ', render: (p) => formatDate(p.order_date) },
    {
      key: 'payment_action',
      header: 'الإجراء',
      render: (p) => !canCreate || p.payment_status === 'paid' ? '-' : (
        <button onClick={() => setPayingPurchase(p)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/40">
          <DollarSign className="h-4 w-4" /> تسجيل دفعة
        </button>
      ),
    },
  ]

  const list = purchases || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">المشتريات</h1>
        {canCreate && <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> إضافة مشترى</Button>}
      </div>
      <Card>
        <DataTable data={list} columns={columns} loading={isLoading} emptyMessage="لا توجد مشتريات" />
      </Card>
      {canCreate && <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="إضافة طلب شراء" size="lg">
        <PurchaseForm suppliers={suppliers || []} items={items || []} accounts={accounts || []} paymentMethods={paymentMethods} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ['purchases'] }); queryClient.invalidateQueries({ queryKey: ['journal-entries'] }); queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }) }} />
      </Modal>}
      {canCreate && <Modal isOpen={!!payingPurchase} onClose={() => setPayingPurchase(null)} title="تسجيل دفعة مشتريات">
        {payingPurchase && (
          <PurchasePaymentForm
            purchase={payingPurchase}
            paymentMethods={paymentMethods}
            loading={paymentMutation.isPending}
            onClose={() => setPayingPurchase(null)}
            onSubmit={(amount: number, method: string) => paymentMutation.mutate({
              purchaseId: payingPurchase.id,
              amount,
              method,
            })}
          />
        )}
      </Modal>}
    </div>
  )
}

function PurchasePaymentForm({ purchase, paymentMethods, loading, onClose, onSubmit }: {
  purchase: PurchaseRecord
  paymentMethods: PurchaseFormProps['paymentMethods']
  loading: boolean
  onClose: () => void
  onSubmit: (amount: number, method: string) => void
}) {
  const remaining = Math.max(0, Number(purchase.total_amount) - Number(purchase.amount_paid))
  const [amount, setAmount] = useState(formatNumber(remaining))
  const [method, setMethod] = useState(paymentMethods[0]?.value || '')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit(Number(amount), method)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="المبلغ المستحق" type="number" value={formatNumber(remaining)} readOnly />
      <Input label="مبلغ الدفعة" type="number" min={0.01} max={remaining} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع</label>
        <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2" required>
          {paymentMethods.map((paymentMethod) => <option key={paymentMethod.value} value={paymentMethod.value}>{paymentMethod.label}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={loading}>تسجيل الدفعة</Button>
      </div>
    </form>
  )
}

function PurchaseForm({ suppliers, items, accounts, paymentMethods, onClose, onSuccess }: PurchaseFormProps) {
  const [formData, setFormData] = useState({
    supplier_id: '',
    account_id: '',
    // eslint-disable-next-line react-hooks/purity
    purchase_number: `PO-${Date.now()}`,
    order_date: new Date().toISOString().split('T')[0],
    status: 'ordered',
    tax_amount: 0,
    amount_paid: 0,
    payment_method: paymentMethods[0]?.value || '',
    notes: '',
  })
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([{ inventory_item_id: '', quantity: 1, unit_cost: 0 }])
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0)
  const totalAmount = subtotal + Number(formData.tax_amount || 0)

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await api.post('/purchases', data)
    },
    onSuccess,
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حفظ طلب الشراء')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...formData,
      account_id: Number(formData.account_id),
      subtotal,
      tax_amount: Number(formData.tax_amount),
      total_amount: totalAmount,
      amount_paid: Number(formData.amount_paid),
      items: lineItems.map(li => ({
        inventory_item_id: Number(li.inventory_item_id),
        quantity: Number(li.quantity),
        unit_cost: Number(li.unit_cost),
      })),
    }
    mutation.mutate(payload)
  }

  const addLine = () => setLineItems([...lineItems, { inventory_item_id: '', quantity: 1, unit_cost: 0 }])
  const removeLine = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx))
  const updateLine = (idx: number, field: keyof PurchaseLineItem, value: string | number) => {
    const next = [...lineItems]
    next[idx] = { ...next[idx], [field]: value }
    if (field === 'inventory_item_id') {
      const it = items.find((i) => i.id === Number(value))
      if (it) next[idx].unit_cost = it.cost_per_unit
    }
    setLineItems(next)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المورد</label>
          <select value={formData.supplier_id} onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
            <option value="">اختر المورد</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <Input label="رقم الطلب" value={formData.purchase_number} onChange={(e) => setFormData({ ...formData, purchase_number: e.target.value })} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="تاريخ الطلب" type="date" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} required />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الحالة</label>
          <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
            <option value="draft">مسودة</option>
            <option value="ordered">تم الطلب</option>
            <option value="received">مستلم</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حساب المشتريات</label>
          <select value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
            <option value="">اختر حساب المشتريات</option>
            {accounts.filter((a) => ['asset', 'expense'].includes(a.type) && a.is_active).map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </select>
        </div>
        <Input label="الضريبة" type="number" min={0} step="0.01" value={formData.tax_amount} onChange={(e) => setFormData({ ...formData, tax_amount: Number(e.target.value) || 0 })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="الإجمالي" type="number" value={formatNumber(totalAmount)} readOnly />
        <Input label="المبلغ المدفوع الآن" type="number" min={0} max={totalAmount} step="0.01" value={formData.amount_paid} onChange={(e) => setFormData({ ...formData, amount_paid: Number(e.target.value) || 0 })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">طريقة الدفع</label>
        <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg" required>
          {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
        </select>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">المنتجات</label>
          <Button type="button" size="sm" variant="secondary" onClick={addLine}>+ إضافة</Button>
        </div>
        <div className="space-y-2">
          {lineItems.map((li, idx) => (
            <div key={idx} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
              <div className="col-span-2">
                <select value={li.inventory_item_id} onChange={(e) => updateLine(idx, 'inventory_item_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm" required>
                  <option value="">اختر الصنف</option>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </div>
              <Input type="number" value={li.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} />
              <div className="flex gap-1">
                <Input type="number" value={li.unit_cost} onChange={(e) => updateLine(idx, 'unit_cost', e.target.value)} />
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLine(idx)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded">×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={mutation.isPending}>حفظ</Button>
      </div>
    </form>
  )
}