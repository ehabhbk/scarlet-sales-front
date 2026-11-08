import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Save,
  Settings as SettingsIcon,
  DollarSign,
  FileText,
  Printer,
  Users,
  ShoppingCart,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  Shield,
  Bell,
  Package,
} from 'lucide-react'
import { api } from '../../services/api'
import {
  useSettingsStore,
  mediaUrl,
  symbolForCurrency,
  type CurrencyOption,
  type PaymentMethod,
} from '../../store/settingsStore'
import Card from '../../components/common/cards/Card'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Modal from '../../components/common/modals/Modal'
import { useAuthStore } from '../../store/authStore'
import { getApiErrorMessage } from '../../utils/apiError'

type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'textarea'

interface PermissionRecord {
  id: number
  name: string
  group: string
  label?: string
}

interface SettingsAccount {
  id: number
  code: string
  name: string
  type: string
  is_active: boolean
}

interface RoleRecord {
  id: number
  name: string
  permissions?: PermissionRecord[]
}

interface PermissionGroup {
  name: string
  items: PermissionRecord[]
}

interface SettingField {
  key: string
  label: string
  type: FieldType
  defaultValue: string
  options?: { value: string; label: string }[]
  hint?: string
  disabled?: boolean
}

const GROUPS: Record<string, SettingField[]> = {
  invoice: [
    { key: 'invoice_prefix', label: 'بادئة رقم الفاتورة', type: 'text', defaultValue: 'INV' },
    { key: 'invoice_footer', label: 'نص أسفل الفاتورة', type: 'text', defaultValue: 'شكراً لزيارتكم' },
    { key: 'invoice_notes', label: 'ملاحظات الفاتورة', type: 'textarea', defaultValue: '' },
    { key: 'show_logo', label: 'إظهار شعار المتجر', type: 'boolean', defaultValue: 'true' },
    { key: 'show_tax_number', label: 'إظهار الرقم الضريبي', type: 'boolean', defaultValue: 'true' },
    { key: 'show_cashier', label: 'إظهار اسم الكاشير', type: 'boolean', defaultValue: 'true' },
  ],
  printing: [
    { key: 'printer_name', label: 'اسم الطابعة', type: 'text', defaultValue: '', hint: 'اتركه فارغاً لاستخدام الطابعة الافتراضية' },
    { key: 'receipt_width', label: 'عرض الإيصال', type: 'select', defaultValue: '80', options: [
      { value: '58', label: '58 مم (إيصال صغير)' },
      { value: '80', label: '80 مم (إيصال عريض)' },
    ] },
    { key: 'copies', label: 'عدد نسخ الطباعة', type: 'number', defaultValue: '1' },
    { key: 'auto_print', label: 'طباعة الإيصال تلقائياً بعد كل طلب', type: 'boolean', defaultValue: 'true' },
    { key: 'print_logo', label: 'طباعة الشعار على الإيصال', type: 'boolean', defaultValue: 'true' },
    { key: 'print_warehouse_copy', label: 'طباعة نسخة للمخزن', type: 'boolean', defaultValue: 'false' },
  ],

  reports: [
    { key: 'report_logo_position', label: 'موقع اللوقو', type: 'select', defaultValue: 'top', options: [
      { value: 'top', label: 'أعلى' },
      { value: 'left', label: 'يسار' },
      { value: 'right', label: 'يمين' },
      { value: 'center', label: 'وسط' },
    ] },
    { key: 'report_logo_method', label: 'طريقة عرض اللوقو', type: 'select', defaultValue: 'contain', options: [
      { value: 'contain', label: 'احتواء' },
      { value: 'cover', label: 'تغطية' },
      { value: 'fill', label: 'ملء' },
    ] },
    { key: 'report_logo_size', label: 'حجم اللوقو', type: 'select', defaultValue: 'medium', options: [
      { value: 'small', label: 'صغير' },
      { value: 'medium', label: 'متوسط' },
      { value: 'large', label: 'كبير' },
    ] },
    { key: 'report_show_logo', label: 'عرض اللوقو', type: 'boolean', defaultValue: 'true' },
    { key: 'report_show_title', label: 'عرض اسم المتجر', type: 'boolean', defaultValue: 'true' },
    { key: 'report_show_phone', label: 'عرض الهاتف', type: 'boolean', defaultValue: 'true' },
    { key: 'report_show_tax_number', label: 'عرض الرقم الضريبي', type: 'boolean', defaultValue: 'true' },
    { key: 'report_show_cashier', label: 'عرض الكاشير', type: 'boolean', defaultValue: 'true' },
  ],
  pos: [
    { key: 'require_shift', label: 'إجبار فتح وردية قبل البيع', type: 'boolean', defaultValue: 'true', disabled: true, hint: 'مفعّل دائماً لضمان ربط المبيعات بالوردية والكاشير' },
    { key: 'enable_customer_name', label: 'السماح بإدخال اسم العميل', type: 'boolean', defaultValue: 'true' },
    { key: 'allow_discount', label: 'السماح بالخصم', type: 'boolean', defaultValue: 'true' },
    { key: 'max_discount_percent', label: 'أقصى نسبة خصم %', type: 'number', defaultValue: '20' },
    { key: 'pos_sale_source', label: 'مصدر البيع (نقطة البيع)', type: 'select', defaultValue: 'both', options: [
      { value: 'store', label: 'المتجر فقط (نقاط البيع)' },
      { value: 'pos', label: 'المخزن فقط' },
      { value: 'both', label: 'كلاهما' },
    ] },
    {
      key: 'close_shift_anyone',
      label: 'السماح لأي مستخدم لديه صلاحية إغلاق الوردية بإغلاق وردية فتحها غيره',
      type: 'boolean',
      defaultValue: 'false',
      hint: 'عند التعطيل: فقط من فتح الوردية يمكنه إغلاقها. عند التفعيل: أي مستخدم يملك صلاحية إغلاق الوردية يمكنه إغلاقها.',
    },
  ],
  users: [
    { key: 'allow_registration', label: 'السماح بإنشاء حسابات جديدة', type: 'boolean', defaultValue: 'false' },
    { key: 'default_role', label: 'الدور الافتراضي للمستخدم الجديد', type: 'text', defaultValue: 'Cashier' },
    { key: 'min_password_length', label: 'الحد الأدنى لطول كلمة المرور', type: 'number', defaultValue: '6' },
    { key: 'session_timeout', label: 'مدة انتهاء الجلسة (دقيقة)', type: 'number', defaultValue: '120' },
  ],
  alerts: [
    { key: 'enable_expiry_alerts', label: 'تنبيهات المنتجات منتهية الصلاحية', type: 'boolean', defaultValue: 'true' },
    { key: 'enable_near_expiry_alerts', label: 'تنبيهات المنتجات القريبة من الانتهاء', type: 'boolean', defaultValue: 'true' },
    { key: 'enable_low_stock_alerts', label: 'تنبيهات المنتجات منخفضة المخزون', type: 'boolean', defaultValue: 'true' },
    { key: 'near_expiry_days', label: 'عدد الأيام لاعتبار المنتج قريباً من الانتهاء', type: 'number', defaultValue: '30', hint: 'يظهر المنتج في تنبيهات قرب الانتهاء عند بقاء هذه المدة أو أقل.' },
    { key: 'low_stock_threshold', label: 'الحد الأدنى الافتراضي للمخزون', type: 'number', defaultValue: '5', hint: 'يُستخدم عندما يكون الحد الأدنى الخاص بالمنتج صفراً أو أقل من هذه القيمة.' },
  ],
  inventory: [
    { key: 'default_expiry_alert_days', label: 'المدة الافتراضية للتنبيه قبل انتهاء الصلاحية (أيام)', type: 'number', defaultValue: '30' },
    { key: 'default_low_stock_threshold', label: 'القيمة الافتراضية للتنبيه قبل نفاذ الكمية', type: 'number', defaultValue: '5' },
  ],
}

const TABS = [
  { id: 'general', label: 'عام', icon: SettingsIcon },
  { id: 'currency', label: 'العملات', icon: DollarSign },
  { id: 'payments', label: 'طرق الدفع', icon: CreditCard },
  { id: 'invoice', label: 'الفواتير', icon: FileText },
  { id: 'printing', label: 'الطباعة', icon: Printer },
  { id: 'reports', label: 'التقارير', icon: FileText },
  { id: 'pos', label: 'نقطة البيع', icon: ShoppingCart },
  { id: 'alerts', label: 'التنبيهات', icon: Bell },
  { id: 'inventory', label: 'المخزون', icon: Package },
  { id: 'users', label: 'المستخدمون', icon: Users },
  { id: 'roles', label: 'الأدوار والصلاحيات', icon: Shield },
] as const

type TabId = (typeof TABS)[number]['id']

interface RestaurantForm {
  name: string
  phone: string
  address: string
  tax_number: string
  currency: string
  symbol: string
  tax_rate: number
  timezone: string
  locale: string
  logo: string
}

const EMPTY_FORM: RestaurantForm = {
  name: '',
  phone: '',
  address: '',
  tax_number: '',
  currency: 'SAR',
  symbol: 'ر.س',
  tax_rate: 0.15,
  timezone: 'Asia/Riyadh',
  locale: 'ar',
  logo: '',
}

const EMPTY_CURRENCY: CurrencyOption = { code: '', symbol: '', name: '' }
const EMPTY_PAYMENT: PaymentMethod = { value: '', label: '' }

export default function SettingsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === 'roles') return permissions.includes('view_roles')
    if (tab.id === 'alerts') return permissions.includes('edit_settings') || permissions.includes('manage_stock')
    return true
  })
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [form, setForm] = useState<RestaurantForm>(EMPTY_FORM)
  const [kv, setKv] = useState<Record<string, string>>({})
  const [savingGroup, setSavingGroup] = useState<string | null>(null)
  const [currencyDraft, setCurrencyDraft] = useState<CurrencyOption>(EMPTY_CURRENCY)
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null)
  const [paymentDraft, setPaymentDraft] = useState<PaymentMethod>(EMPTY_PAYMENT)
  const { data: accountsList, isLoading: accountsLoading, isError: accountsError, refetch: refetchAccounts } = useQuery({
    queryKey: ['settings-accounts'],
    queryFn: async () => {
      const res = await api.get('/accounts')
      if (!Array.isArray(res.data?.accounts)) {
        throw new Error('استجابة الحسابات غير صالحة')
      }
      return res.data.accounts as SettingsAccount[]
    },
    enabled: activeTab === 'payments',
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const [editingPayment, setEditingPayment] = useState<string | null>(null)
  const [savingList, setSavingList] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()

  const applyRestaurant = useSettingsStore((s) => s.applyRestaurant)
  const currencies = useSettingsStore((s) => s.currencies)
  const customCurrencies = useSettingsStore((s) => s.customCurrencies)
  const paymentMethods = useSettingsStore((s) => s.paymentMethods)
  const settingsError = useSettingsStore((s) => s.settingsError)
  const loadSettings = useSettingsStore((s) => s.load)
  const setCustomCurrencies = useSettingsStore((s) => s.setCustomCurrencies)
  const setPaymentMethods = useSettingsStore((s) => s.setPaymentMethods)

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant'],
    queryFn: async () => {
      const res = await api.get('/auth/restaurant')
      return res.data.restaurant
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings')
      return (res.data.settings || []) as Array<{
        group: string
        key: string
        value: string | null
        type: string
      }>
    },
  })

  useEffect(() => {
    if (!restaurant) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: restaurant.name || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      tax_number: restaurant.tax_number || '',
      currency: restaurant.currency || 'SAR',
      symbol: restaurant.symbol || symbolForCurrency(restaurant.currency),
      tax_rate:
        restaurant.tax_rate !== undefined && restaurant.tax_rate !== null
          ? Number(restaurant.tax_rate)
          : 0.15,
      timezone: restaurant.timezone || 'Asia/Riyadh',
      locale: restaurant.locale || 'ar',
      logo: restaurant.logo || '',
    })
    applyRestaurant(restaurant)
  }, [restaurant, applyRestaurant])

  useEffect(() => {
    if (!settings) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKv((prev) => {
      const next = { ...prev }
      settings.forEach((setting) => {
        next[`${setting.group}.${setting.key}`] = setting.value ?? ''
      })
      return next
    })
  }, [settings])

  const saveSetting = (group: string, key: string, value: string, type = 'string') =>
    api.post('/settings', { group, key, value, type })

  const updateRestaurantMutation = useMutation({
    mutationFn: async (data: RestaurantForm) => {
      const res = await api.put('/auth/restaurant', data)
      return res.data
    },
    onSuccess: (res) => {
      applyRestaurant(res?.restaurant || form)
      queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success('تم حفظ إعدادات المتجر')
    },
    onError: () => toast.error('تعذر حفظ الإعدادات'),
  })

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const data = new FormData()
      data.append('logo', file)
      const res = await api.post('/auth/restaurant/logo', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (res) => {
      applyRestaurant(res.restaurant)
      setForm((current) => ({ ...current, logo: res.restaurant.logo || '' }))
      queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success('تم تحديث شعار المتجر')
    },
    onError: () => toast.error('تعذر رفع الشعار'),
  })

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/auth/restaurant/logo')
      return res.data
    },
    onSuccess: (res) => {
      applyRestaurant(res.restaurant)
      setForm((current) => ({ ...current, logo: '' }))
      queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success('تم حذف الشعار')
    },
    onError: () => toast.error('تعذر حذف الشعار'),
  })

  const handleSaveRestaurant = (e: React.FormEvent) => {
    e.preventDefault()
    updateRestaurantMutation.mutate(form)
  }

  const handleSaveGroup = async (group: string) => {
    const fields = GROUPS[group]
    setSavingGroup(group)
    try {
      await Promise.all(
        fields.map((field) => {
          const raw = kv[`${group}.${field.key}`] ?? field.defaultValue
          return saveSetting(
            group,
            field.key,
            raw,
            field.type === 'boolean' ? 'boolean' : field.type === 'number' ? 'number' : 'string'
          )
        })
      )
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم حفظ الإعدادات')
    } catch {
      toast.error('تعذر حفظ الإعدادات')
    } finally {
      setSavingGroup(null)
    }
  }

  const setKvValue = (group: string, key: string, value: string) => {
    setKv((prev) => ({ ...prev, [`${group}.${key}`]: value }))
  }

  const persistCurrencies = async (list: CurrencyOption[]) => {
    setSavingList('currency')
    try {
      await saveSetting('currency', 'custom_currencies', JSON.stringify(list), 'json')
      setCustomCurrencies(list)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم حفظ قائمة العملات')
    } catch {
      toast.error('تعذر حفظ قائمة العملات')
    } finally {
      setSavingList(null)
    }
  }

  const handleCurrencySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = currencyDraft.code.trim().toUpperCase()
    const symbol = currencyDraft.symbol.trim()
    const name = currencyDraft.name.trim()
    if (!code || !symbol || !name) {
      toast.error('أدخل رمز العملة والرمز النصي والاسم')
      return
    }
    if (!/^[A-Z]{2,8}$/.test(code)) {
      toast.error('رمز العملة يجب أن يكون أحرفاً إنجليزية (مثال: SAR)')
      return
    }

    let next: CurrencyOption[]
    if (editingCurrency) {
      next = customCurrencies.map((currency) =>
        currency.code === editingCurrency ? { code, symbol, name } : currency
      )
      if (!next.some((currency) => currency.code === editingCurrency)) {
        next.push({ code, symbol, name })
      }
    } else {
      if (currencies.some((currency) => currency.code === code)) {
        toast.error('هذه العملة موجودة مسبقاً')
        return
      }
      next = [...customCurrencies, { code, symbol, name }]
    }

    await persistCurrencies(next)
    setCurrencyDraft(EMPTY_CURRENCY)
    setEditingCurrency(null)
  }

  const handleDeleteCurrency = async (code: string) => {
    const next = customCurrencies.filter((currency) => currency.code !== code)
    await persistCurrencies(next)
    if (form.currency === code) {
      setForm((current) => ({ ...current, currency: 'SAR', symbol: 'ر.س' }))
    }
  }

  const persistPaymentMethods = async (list: PaymentMethod[]) => {
    setSavingList('payments')
    try {
      await saveSetting('pos', 'payment_methods', JSON.stringify(list), 'json')
      setPaymentMethods(list)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم حفظ طرق الدفع')
    } catch {
      toast.error('تعذر حفظ طرق الدفع')
    } finally {
      setSavingList(null)
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = paymentDraft.value.trim().toLowerCase().replace(/\s+/g, '_')
    const label = paymentDraft.label.trim()
    if (!value || !label) {
      toast.error('أدخل اسم طريقة الدفع')
      return
    }
    if (!paymentDraft.account_id) {
      toast.error('اربط طريقة الدفع بحساب نشط من شجرة الحسابات')
      return
    }

    let next: PaymentMethod[]
    if (editingPayment) {
      next = paymentMethods.map((method) =>
        method.value === editingPayment ? { value, label, account_id: paymentDraft.account_id } : method
      )
    } else {
      if (paymentMethods.some((method) => method.value === value)) {
        toast.error('طريقة الدفع موجودة مسبقاً')
        return
      }
      next = [...paymentMethods, { value, label, account_id: paymentDraft.account_id }]
    }

    await persistPaymentMethods(next)
    setPaymentDraft(EMPTY_PAYMENT)
    setEditingPayment(null)
  }

  const handleDeletePayment = async (value: string) => {
    if (paymentMethods.length <= 1) {
      toast.error('يجب أن تبقى طريقة دفع واحدة على الأقل')
      return
    }
    await persistPaymentMethods(paymentMethods.filter((method) => method.value !== value))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إعدادات النظام</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            إدارة بيانات المتجر والعملات وطرق الدفع والفواتير والطباعة ونقطة البيع
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'general' && (
        <Card>
          <form onSubmit={handleSaveRestaurant} className="space-y-4">
            <h2 className="text-lg font-semibold dark:text-gray-100">معلومات المتجر</h2>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800 shrink-0">
                {form.logo ? (
                  <img
                    src={mediaUrl(form.logo)}
                    alt="شعار المتجر"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">شعار المتجر</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PNG أو JPG أو WEBP بحجم أقصى 4MB. يظهر في الشريط الجانبي والفاتورة.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadLogoMutation.mutate(file)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploadLogoMutation.isPending}
                  >
                    <Upload className="w-4 h-4" />
                    رفع شعار
                  </Button>
                  {form.logo && (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => removeLogoMutation.mutate()}
                      loading={removeLogoMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف الشعار
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="اسم المتجر"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="رقم الهاتف"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                label="الرقم الضريبي"
                value={form.tax_number}
                onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
              />
              <Input
                label="العنوان"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="المنطقة الزمنية"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
              <Input
                label="لغة النظام (ar / en)"
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" loading={updateRestaurantMutation.isPending}>
                <Save className="w-4 h-4" />
                حفظ التغييرات
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'currency' && (
        <div className="space-y-6">
          <Card>
            <form onSubmit={handleSaveRestaurant} className="space-y-4">
              <h2 className="text-lg font-semibold dark:text-gray-100">العملة الافتراضية والضرائب</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    العملة
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => {
                      const code = e.target.value
                      setForm({
                        ...form,
                        currency: code,
                        symbol: symbolForCurrency(code, currencies),
                      })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name} ({currency.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="رمز العملة (يظهر بجانب كل مبلغ)"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                />
                <Input
                  label="نسبة الضريبة (0.15 = 15%)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={form.tax_rate}
                  onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
                />
                <Input
                  label="الرقم الضريبي"
                  value={form.tax_number}
                  onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                />
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  سيتم تطبيق العملة والضريبة المعتمدة هنا على نقطة البيع والفواتير وجميع المبالغ في النظام.
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" loading={updateRestaurantMutation.isPending}>
                  <Save className="w-4 h-4" />
                  حفظ العملة والضريبة
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold dark:text-gray-100">إدارة العملات</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  أضف أي عملة جديدة أو عدّل رمزها، وستظهر فوراً في قائمة العملات وفي نقطة البيع.
                </p>
              </div>

              <form onSubmit={handleCurrencySubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <Input
                  label="رمز العملة"
                  placeholder="SAR"
                  value={currencyDraft.code}
                  onChange={(e) => setCurrencyDraft({ ...currencyDraft, code: e.target.value.toUpperCase() })}
                  maxLength={8}
                />
                <Input
                  label="الرمز النصي"
                  placeholder="ر.س"
                  value={currencyDraft.symbol}
                  onChange={(e) => setCurrencyDraft({ ...currencyDraft, symbol: e.target.value })}
                />
                <Input
                  label="اسم العملة"
                  placeholder="ريال سعودي"
                  value={currencyDraft.name}
                  onChange={(e) => setCurrencyDraft({ ...currencyDraft, name: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button type="submit" loading={savingList === 'currency'} className="flex-1">
                    <Plus className="w-4 h-4" />
                    {editingCurrency ? 'تحديث' : 'إضافة'}
                  </Button>
                  {editingCurrency && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingCurrency(null)
                        setCurrencyDraft(EMPTY_CURRENCY)
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </form>

              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {currencies.map((currency) => {
                  const isCustom = customCurrencies.some((item) => item.code === currency.code)
                  return (
                    <div
                      key={currency.code}
                      className="flex flex-wrap items-center justify-between gap-2 gap-3 px-4 py-3 bg-white dark:bg-gray-900"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-12 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {currency.symbol}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {currency.name}
                          </p>
                          <p className="text-xs text-gray-500">{currency.code}</p>
                        </div>
                        {isCustom && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            مضافة
                          </span>
                        )}
                      </div>
                      {isCustom && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCurrency(currency.code)
                              setCurrencyDraft(currency)
                            }}
                            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                            title="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCurrency(currency.code)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg dark:text-red-400"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'payments' && (
        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold dark:text-gray-100">طرق الدفع</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                اربط كل طريقة دفع بأي حساب نشط من شجرة الحسابات؛ يستخدم الحساب تلقائيًا في القيود المحاسبية.
              </p>
            </div>
            {settingsError && (
              <div className="flex flex-wrap items-center justify-between gap-2 gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40">
                <span>{settingsError}</span>
                <button type="button" className="underline" onClick={() => void loadSettings(true)}>إعادة تحميل الإعدادات</button>
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Input
                label="الاسم الظاهر"
                placeholder="نقدي"
                value={paymentDraft.label}
                onChange={(e) => setPaymentDraft({ ...paymentDraft, label: e.target.value })}
              />
              <Input
                label="المعرّف (اختياري)"
                placeholder="cash"
                value={paymentDraft.value}
                onChange={(e) => setPaymentDraft({ ...paymentDraft, value: e.target.value })}
                hint="حروف إنجليزية بدون مسافات"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">حساب الربط</label>
                {accountsError && (
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 gap-2 text-sm text-red-600 dark:text-red-400">
                    <span>تعذر تحميل حسابات المتجر.</span>
                    <button type="button" className="underline" onClick={() => void refetchAccounts()}>إعادة المحاولة</button>
                  </div>
                )}
                <select
                  value={paymentDraft.account_id || ''}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, account_id: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                  required
                  disabled={accountsLoading || accountsError}
                >
                  <option value="">{accountsLoading ? 'جارٍ تحميل الحسابات...' : 'اختر حسابًا'}</option>
                  {(accountsList || []).map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                      disabled={!account.is_active}
                    >
                      {account.code} - {account.name} ({account.type}{account.is_active ? '' : ' - غير نشط'})
                    </option>
                  ))}
                </select>
                {!accountsLoading && !accountsError && !(accountsList || []).length && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">لا توجد حسابات للمتجر في قاعدة البيانات؛ أنشئ حسابًا من شجرة الحسابات.</p>
                )}
                {!accountsLoading && !accountsError && (accountsList || []).length > 0
                  && !(accountsList || []).some((account) => account.is_active) && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">الحسابات ظاهرة، لكن جميعها غير نشطة ولا يمكن ربطها بطريقة الدفع.</p>
                )}
              </div>
              <div className="flex gap-2 md:col-span-1">
                <Button type="submit" loading={savingList === 'payments'} className="flex-1">
                  <Plus className="w-4 h-4" />
                  {editingPayment ? 'تحديث طريقة الدفع' : 'إضافة طريقة دفع'}
                </Button>
                {editingPayment && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingPayment(null)
                      setPaymentDraft(EMPTY_PAYMENT)
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.value}
                  className="flex flex-wrap items-center justify-between gap-2 gap-3 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{method.label}</p>
                      <p className="text-xs text-gray-500">{method.value}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPayment(method.value)
                        setPaymentDraft(method)
                      }}
                      className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      title="تعديل"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(method.value)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg dark:text-red-400"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {(activeTab === 'invoice' ||
        activeTab === 'printing' ||
        activeTab === 'pos' ||
        activeTab === 'alerts' ||
        activeTab === 'inventory' ||
        activeTab === 'users' ||
        activeTab === 'reports') && (
        <Card>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold dark:text-gray-100">
              {TABS.find((tab) => tab.id === activeTab)?.label}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GROUPS[activeTab]?.map((field) => {
                const value = kv[`${activeTab}.${field.key}`] ?? field.defaultValue
                const onChange = (next: string) => setKvValue(activeTab, field.key, next)

                if (field.type === 'boolean') {
                  const checked = value === 'true' || value === '1'
                  return (
                    <div key={field.key} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <Toggle
                        checked={checked}
                        disabled={field.disabled}
                        label={field.label}
                        hint={field.hint}
                        onChange={(next) => onChange(next ? 'true' : 'false')}
                      />
                    </div>
                  )
                }

                if (field.type === 'select') {
                  return (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        {field.label}
                      </label>
                      <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {field.hint && <p className="mt-1 text-xs text-gray-500">{field.hint}</p>}
                    </div>
                  )
                }

                if (field.type === 'textarea') {
                  return (
                    <div key={field.key} className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        {field.label}
                      </label>
                      <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  )
                }

                return (
                  <Input
                    key={field.key}
                    label={field.label}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={value}
                    disabled={field.disabled}
                    onChange={(e) => onChange(e.target.value)}
                  />
                )
              })}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSaveGroup(activeTab)} loading={savingGroup === activeTab}>
                <Save className="w-4 h-4" />
                حفظ التغييرات
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'roles' && <RolesPermissionsPanel />}
    </div>
  )
}

const PERMISSION_LABELS: Record<string, string> = {
  // لوحة التحكم
  view_dashboard: 'عرض لوحة التحكم',
  // المنتجات
  view_products: 'عرض المنتجات',
  create_products: 'إضافة منتج',
  edit_products: 'تعديل منتج',
  delete_products: 'حذف منتج',
  // التصنيفات
  view_categories: 'عرض التصنيفات',
  create_categories: 'إضافة تصنيف',
  edit_categories: 'تعديل تصنيف',
  delete_categories: 'حذف تصنيف',
  // الوصفات
  view_recipes: 'عرض الوصفات',
  create_recipes: 'إضافة وصفة',
  edit_recipes: 'تعديل وصفة',
  delete_recipes: 'حذف وصفة',
  // الطلبات
  view_orders: 'عرض الطلبات',
  view_all_orders: 'عرض جميع الطلبات',
  create_orders: 'إنشاء طلب',
  edit_orders: 'تعديل طلب',
  edit_order_payment: 'تعديل طريقة دفع الطلب',
  cancel_orders: 'إلغاء طلب',
  delete_orders: 'حذف طلب',
  refund_orders: 'استرداد طلبات',
  // الطاولات
  view_tables: 'عرض الطاولات',
  create_tables: 'إضافة طاولة',
  edit_tables: 'تعديل طاولة',
  delete_tables: 'حذف طاولة',
  // المطبخ
  view_kitchen: 'عرض المطبخ',
  view_all_kitchen_orders: 'عرض جميع طلبات المطبخ',
  view_station_kitchen_orders: 'عرض طلبات محطة المطبخ',
  update_kitchen_order: 'تحديث حالة طلب المطبخ',
  // المخزون
  view_inventory: 'عرض المخزون',
  create_inventory: 'إضافة صنف مخزون',
  edit_inventory: 'تعديل صنف مخزون',
  delete_inventory: 'حذف صنف مخزون',
  // المخازن
  view_warehouses: 'عرض المخازن',
  view_stock_requests: 'عرض طلبات المخزون',
  create_stock_requests: 'إنشاء طلب مخزون',
  approve_stock_requests: 'الموافقة على طلب مخزون',
  reject_stock_requests: 'رفض طلب مخزون',
  create_warehouses: 'إضافة مخزن',
  edit_warehouses: 'تعديل مخزن',
  delete_warehouses: 'حذف مخزن',
  manage_stock: 'إدارة أرصدة المخازن',
  // المشتريات والموردون
  view_purchases: 'عرض المشتريات',
  create_purchases: 'إضافة مشتريات',
  edit_purchases: 'تعديل مشتريات',
  delete_purchases: 'حذف مشتريات',
  view_suppliers: 'عرض الموردين',
  create_suppliers: 'إضافة مورد',
  edit_suppliers: 'تعديل مورد',
  delete_suppliers: 'حذف مورد',
  // العملاء
  view_customers: 'عرض العملاء',
  create_customers: 'إضافة عميل',
  edit_customers: 'تعديل عميل',
  delete_customers: 'حذف عميل',
  // الموظفون
  view_employees: 'عرض الموظفين',
  create_employees: 'إضافة موظف',
  edit_employees: 'تعديل موظف',
  delete_employees: 'حذف موظف',
  // المالية والمحاسبة
  view_finance: 'عرض المالية',
  manage_chart_of_accounts: 'إدارة شجرة الحسابات',
  create_expenses: 'إضافة مصروف',
  edit_expenses: 'تعديل مصروف',
  delete_expenses: 'حذف مصروف',
  view_payments: 'عرض المدفوعات',
  create_payments: 'إضافة دفعة',
  edit_payments: 'تعديل دفعة',
  delete_payments: 'حذف دفعة',
  // التقارير
  view_reports: 'عرض التقارير',
  export_reports: 'تصدير التقارير',
  // الإعدادات
  view_settings: 'عرض الإعدادات',
  edit_settings: 'تعديل الإعدادات',
  // المستخدمون والأدوار
  view_users: 'عرض المستخدمين',
  create_users: 'إضافة مستخدم',
  edit_users: 'تعديل مستخدم',
  delete_users: 'حذف مستخدم',
  view_roles: 'عرض الأدوار',
  create_roles: 'إضافة دور',
  edit_roles: 'تعديل دور',
  delete_roles: 'حذف دور',
  // الورديات ونقطة البيع
  view_pos: 'عرض نقطة البيع',
  open_shift: 'فتح وردية',
  close_shift: 'إغلاق وردية',
  manage_multi_cashier_shifts: 'إدارة الورديات المشتركة',
  manage_shift_employees: 'تحديد موظفي الوردية',
  pay_employee_wages: 'صرف أجور الوردية',
  view_all_shifts: 'عرض جميع الورديات',
  // الإشعارات
  view_notifications: 'عرض الإشعارات',
}

function permissionLabel(name: string) {
  return PERMISSION_LABELS[name] || name
}

function RolesPermissionsPanel() {
  const queryClient = useQueryClient()
  const [newRoleName, setNewRoleName] = useState('')
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [permSearch, setPermSearch] = useState('')
  const currentPermissions = useAuthStore((state) => state.user?.permissions || [])
  const canCreateRole = currentPermissions.includes('create_roles')
  const canEditRole = currentPermissions.includes('edit_roles')
  const canDeleteRole = currentPermissions.includes('delete_roles')

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles')
      return (res.data.roles || []) as RoleRecord[]
    },
  })

  const { data: permissions } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const res = await api.get('/admin/permissions')
      return (res.data.permissions || []) as PermissionRecord[]
    },
  })

  const createRole = useMutation({
    mutationFn: async (name: string) => {
      await api.post('/admin/roles', { name, permissions: [] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setNewRoleName('')
      toast.success('تم إضافة الدور')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر إضافة الدور')),
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, permissions }: { id: number; permissions: string[] }) => {
      await api.put(`/admin/roles/${id}`, { permissions })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setEditingRole(null)
      toast.success('تم تحديث صلاحيات الدور')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر تحديث الدور')),
  })

  const deleteRole = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/roles/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      toast.success('تم حذف الدور')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر حذف الدور')),
  })

  const roleList: RoleRecord[] = roles || []
  const permList: PermissionRecord[] = permissions || []
  const permTerm = permSearch.trim().toLowerCase()
  const filteredPerms = permTerm
    ? permList.filter(
        (p) =>
          permissionLabel(p.name).toLowerCase().includes(permTerm) ||
          String(p.label || '').toLowerCase().includes(permTerm) ||
          String(p.group || '').toLowerCase().includes(permTerm) ||
          String(p.name).toLowerCase().includes(permTerm)
      )
    : permList

  const groupedPerms = useMemo(() => {
    const groups: PermissionGroup[] = []
    const groupIndex = new Map<string, number>()
    filteredPerms.forEach((permission) => {
      const groupName = permission.group || 'صلاحيات إضافية'
      if (!groupIndex.has(groupName)) {
        groupIndex.set(groupName, groups.length)
        groups.push({ name: groupName, items: [] })
      }
      groups[groupIndex.get(groupName)!].items.push(permission)
    })
    return groups
  }, [filteredPerms])

  const openEdit = (role: RoleRecord) => {
    setEditingRole(role)
    setSelectedPerms((role.permissions || []).map((p) => p.name))
    setPermSearch('')
  }

  const togglePerm = (name: string) => {
    setSelectedPerms((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    )
  }

  return (
    <div className="space-y-6">
      {canCreateRole && <Card>
        <h2 className="text-lg font-semibold dark:text-gray-100 mb-4">إضافة دور جديد</h2>
        <div className="flex gap-2">
          <Input
            placeholder="اسم الدور"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <Button
            onClick={() => newRoleName.trim() && createRole.mutate(newRoleName.trim())}
            loading={createRole.isPending}
            disabled={!newRoleName.trim()}
          >
            <Plus className="w-4 h-4" /> إضافة
          </Button>
        </div>
      </Card>}

      <Card>
        <h2 className="text-lg font-semibold dark:text-gray-100 mb-4">الأدوار والصلاحيات</h2>
        <div className="space-y-3">
          {roleList.map((role) => (
            <div key={role.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 gap-3 mb-2">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{role.name}</p>
                  <p className="text-xs text-gray-500">{(role.permissions || []).length} صلاحية</p>
                </div>
                {(canEditRole || canDeleteRole) && <div className="flex gap-2">
                  {canEditRole && (
                    <Button size="sm" variant="secondary" onClick={() => openEdit(role)}>
                      <Pencil className="w-4 h-4" /> تعديل الصلاحيات
                    </Button>
                  )}
                  {canDeleteRole && !['admin', 'Super Admin'].includes(role.name) && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`حذف الدور ${role.name}؟`)) deleteRole.mutate(role.id)
                      }}
                      loading={deleteRole.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>}
              </div>
            </div>
          ))}
          {roleList.length === 0 && (
            <p className="text-center py-6 text-gray-500">لا توجد أدوار</p>
          )}
        </div>
      </Card>

      {canEditRole && <Modal isOpen={!!editingRole} onClose={() => setEditingRole(null)} title={`صلاحيات: ${editingRole?.name}`}>
        {editingRole && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[14rem]">
                <Input
                  placeholder="ابحث عن صلاحية بالاسم العربي أو الإنجليزي..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                />
              </div>
              <span className="text-xs text-gray-500">
                {filteredPerms.length} من {permList.length} صلاحية
              </span>
            </div>
            <div className="max-h-96 space-y-4 overflow-y-auto pe-1">
              {groupedPerms.map((group) => (
                <div key={group.name} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-1 dark:border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.name}</h4>
                    <span className="text-xs text-gray-500">
                      {group.items.filter((p) => selectedPerms.includes(p.name)).length} / {group.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {group.items.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input
                          type="checkbox"
                          checked={selectedPerms.includes(p.name)}
                          onChange={() => togglePerm(p.name)}
                          className="rounded border-gray-300 dark:border-gray-700"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{permissionLabel(p.name)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {filteredPerms.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-gray-500">لا توجد صلاحيات مطابقة للبحث.</p>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="secondary" onClick={() => setEditingRole(null)}>
                إلغاء
              </Button>
              <Button
                onClick={() => updateRole.mutate({ id: editingRole.id, permissions: selectedPerms })}
                loading={updateRole.isPending}
              >
                حفظ
              </Button>
            </div>
          </div>
        )}
      </Modal>}
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}

function Toggle({ checked, onChange, label, hint, disabled }: ToggleProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
