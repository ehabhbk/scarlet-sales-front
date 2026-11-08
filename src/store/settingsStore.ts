import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'
import { formatNumber } from '@/utils/format'

export interface RestaurantSettings {
  id?: number
  name: string
  slug?: string
  phone?: string
  email?: string
  address?: string
  currency: string
  symbol: string
  tax_number?: string
  tax_rate: number
  timezone?: string
  locale?: string
  logo?: string
  favicon?: string
  primary_color?: string
}

export interface CurrencyOption {
  code: string
  symbol: string
  name: string
}

export interface PaymentMethod {
  value: string
  label: string
  account_id?: number
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'SAR', symbol: 'ر.س', name: 'ريال سعودي' },
  { code: 'AED', symbol: 'د.إ', name: 'درهم إماراتي' },
  { code: 'EGP', symbol: 'ج.م', name: 'جنيه مصري' },
  { code: 'KWD', symbol: 'د.ك', name: 'دينار كويتي' },
  { code: 'QAR', symbol: 'ر.ق', name: 'ريال قطري' },
  { code: 'BHD', symbol: 'د.ب', name: 'دينار بحريني' },
  { code: 'OMR', symbol: 'ر.ع', name: 'ريال عماني' },
  { code: 'JOD', symbol: 'د.أ', name: 'دينار أردني' },
  { code: 'USD', symbol: '$', name: 'دولار أمريكي' },
  { code: 'EUR', symbol: '€', name: 'يورو' },
  { code: 'GBP', symbol: '£', name: 'جنيه إسترليني' },
  { code: 'TRY', symbol: '₺', name: 'ليرة تركية' },
  { code: 'MAD', symbol: 'د.م', name: 'درهم مغربي' },
  { code: 'TND', symbol: 'د.ت', name: 'دينار تونسي' },
  { code: 'DZD', symbol: 'د.ج', name: 'دينار جزائري' },
  { code: 'IQD', symbol: 'ع.د', name: 'دينار عراقي' },
  { code: 'LBP', symbol: 'ل.ل', name: 'ليرة لبنانية' },
  { code: 'SYP', symbol: 'ل.س', name: 'ليرة سورية' },
  { code: 'YER', symbol: 'ر.ي', name: 'ريال يمني' },
  { code: 'SDG', symbol: 'ج.س', name: 'جنيه سوداني' },
  { code: 'LYD', symbol: 'د.ل', name: 'دينار ليبي' },
]

export const symbolForCurrency = (code?: string, list: CurrencyOption[] = CURRENCIES): string =>
  list.find((c) => c.code === code)?.symbol || 'ر.س'

const DEFAULT_CURRENCY = 'SAR'
const DEFAULT_SYMBOL = symbolForCurrency(DEFAULT_CURRENCY)
const DEFAULT_TAX_RATE = 0.15

export const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://server/scarlet-resta-app/public/api').replace(
  /\/api\/?$/,
  ''
)

export function mediaUrl(path?: string | null): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}

function mergeCurrencies(custom: CurrencyOption[]): CurrencyOption[] {
  const map = new Map<string, CurrencyOption>()
  for (const currency of CURRENCIES) map.set(currency.code, currency)
  for (const currency of custom) {
    if (!currency?.code) continue
    map.set(currency.code, {
      code: currency.code,
      symbol: currency.symbol || symbolForCurrency(currency.code),
      name: currency.name || currency.code,
    })
  }
  return Array.from(map.values())
}

type SettingRow = { group: string; key: string; value: unknown; type?: string }

function readJsonSetting<T>(rows: SettingRow[], group: string, key: string): T | null {
  const row = rows.find((r) => r.group === group && r.key === key)
  if (!row) return null
  const raw = row.value
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  return raw as T
}

interface SettingsState {
  restaurant: RestaurantSettings | null
  currency: string
  symbol: string
  taxRate: number
  currencies: CurrencyOption[]
  customCurrencies: CurrencyOption[]
  paymentMethods: PaymentMethod[]
  reportSettings: Record<string, string>
  settingsError: string | null
  loaded: boolean
  loading: boolean
  load: (force?: boolean) => Promise<void>
  applyRestaurant: (restaurant: Partial<RestaurantSettings> | null | undefined) => void
  setCustomCurrencies: (currencies: CurrencyOption[]) => void
  setPaymentMethods: (methods: PaymentMethod[]) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      currency: DEFAULT_CURRENCY,
      symbol: DEFAULT_SYMBOL,
      taxRate: DEFAULT_TAX_RATE,
      currencies: CURRENCIES,
      customCurrencies: [],
      paymentMethods: [],
      reportSettings: {},
      settingsError: null,
      loaded: false,
      loading: false,
      load: async (force = false) => {
        if (get().loading) return
        if (get().loaded && !force) return
        set({ loading: true })

        const [restaurantResult, settingsResult] = await Promise.allSettled([
          api.get('/auth/restaurant'),
          api.get('/settings'),
        ])

        if (restaurantResult.status === 'fulfilled') {
          get().applyRestaurant(restaurantResult.value.data?.restaurant)
        }

        if (settingsResult.status === 'fulfilled') {
          const rows = (settingsResult.value.data?.settings || []) as SettingRow[]
          const custom = readJsonSetting<CurrencyOption[]>(rows, 'currency', 'custom_currencies')
          if (Array.isArray(custom)) {
            const cleaned = custom.filter((c) => c && c.code)
            set({
              customCurrencies: cleaned,
              currencies: mergeCurrencies(cleaned),
            })
          }
          const methods = readJsonSetting<PaymentMethod[]>(rows, 'pos', 'payment_methods')
          if (Array.isArray(methods) && methods.length > 0) {
            set({
              paymentMethods: methods
                .filter((m) => m && m.value)
                .map((m) => ({ value: m.value, label: m.label || m.value, account_id: m.account_id })),
            })
          } else {
            set({ paymentMethods: [] })
          }
        } else {
          set({ paymentMethods: [] })
        }

        const reportRows = settingsResult.status === 'fulfilled'
          ? ((settingsResult.value.data?.settings || []) as SettingRow[]).filter((r) => r.group === 'reports')
          : []
        const reportSettings: Record<string, string> = {}
        for (const row of reportRows) {
          reportSettings[row.key] = String(row.value ?? '')
        }
        set({ reportSettings })

        const errors = [restaurantResult, settingsResult]
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason)
        set({
          loading: false,
          loaded: errors.length === 0,
          settingsError: errors.length
            ? 'تعذر تحميل بيانات المطعم أو الإعدادات من الخادم.'
            : null,
        })
      },
      applyRestaurant: (restaurant) => {
        if (!restaurant) return
        const current = get()
        const currency = restaurant.currency || current.currency
        const symbol =
          restaurant.symbol ||
          symbolForCurrency(currency, current.currencies) ||
          current.symbol
        const taxRate =
          restaurant.tax_rate !== undefined && restaurant.tax_rate !== null
            ? Number(restaurant.tax_rate)
            : current.taxRate
        set({
          restaurant: { ...(current.restaurant || {}), ...restaurant } as RestaurantSettings,
          currency,
          symbol,
          taxRate: Number.isFinite(taxRate) ? taxRate : current.taxRate,
        })
      },
      setCustomCurrencies: (custom) => {
        const cleaned = custom.filter((c) => c && c.code)
        const merged = mergeCurrencies(cleaned)
        const current = get()
        const stillExists = merged.some((c) => c.code === current.currency)
        const currency = stillExists ? current.currency : 'SAR'
        const symbol = stillExists
          ? symbolForCurrency(currency, merged)
          : symbolForCurrency('SAR', merged)
        set({
          customCurrencies: cleaned,
          currencies: merged,
          currency,
          symbol,
        })
      },
      setPaymentMethods: (methods) => set({ paymentMethods: methods, settingsError: null }),
    }),
    {
      name: 'restaurant-settings',
      partialize: (state) => ({
        restaurant: state.restaurant,
        currency: state.currency,
        symbol: state.symbol,
        taxRate: state.taxRate,
        currencies: state.currencies,
        customCurrencies: state.customCurrencies,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<SettingsState>),
        paymentMethods: [],
        loaded: false,
        loading: false,
        settingsError: null,
      }),
    }
  )
)

export function formatMoney(
  value: number | string | null | undefined,
  symbol: string,
  withSymbol = true
): string {
  const formatted = formatNumber(value)
  return withSymbol ? `${formatted} ${symbol}` : formatted
}

export function useCurrency() {
  const currency = useSettingsStore((s) => s.currency)
  const symbol = useSettingsStore((s) => s.symbol)
  const taxRate = useSettingsStore((s) => s.taxRate)
  const format = (value: number | string | null | undefined, withSymbol = true) =>
    formatMoney(value, symbol, withSymbol)
  return { currency, symbol, taxRate, format }
}
