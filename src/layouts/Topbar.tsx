import { Bell, Moon, Sun, ChevronDown, LogOut, Settings, BarChart3, Users, Menu, AlertTriangle, PackageX, Clock } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { useLangStore } from '../store/langStore'
import { useSettingsStore, mediaUrl, formatMoney } from '../store/settingsStore'
import { formatNumber, formatDate } from '../utils/format'
import { api } from '../services/api'
import type { ProductAlerts } from '../types'

interface TopbarRole {
  name: string
  permissions?: { name: string }[]
}

interface Notification {
  id: number
  title?: string
  message?: string
  is_read: boolean
  created_at: string
}

export default function Topbar() {
  const { user, logout } = useAuthStore()
  const { darkMode, toggleDarkMode, setMobileSidebarOpen } = useUiStore()
  const { lang, toggleLang } = useLangStore()
  const { restaurant, symbol } = useSettingsStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const navigate = useNavigate()

  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles')
      return (res.data.roles || res.data.data || res.data) as TopbarRole[]
    },
    enabled: ['admin', 'Super Admin', 'Admin'].includes(user?.roles?.[0]?.name || '')
      || (user?.permissions || []).includes('roles')
      || (user?.permissions || []).includes('view_roles'),
  })

  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications')
      const payload = res.data.data || res.data
      return (Array.isArray(payload) ? payload : payload?.data || []) as Notification[]
    },
    refetchInterval: 30000,
  })

  const notifications = notifData || []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const { data: alerts } = useQuery({
    queryKey: ['product-alerts'],
    queryFn: async () => {
      const res = await api.get('/product-alerts')
      return res.data as ProductAlerts
    },
    refetchInterval: 60000,
  })

  const alertSummary = alerts?.summary
  const expiredAlerts = alerts?.expired || []
  const nearExpiryAlerts = alerts?.near_expiry || []
  const lowStockAlerts = alerts?.low_stock || []
  const alertCount = alertSummary?.total_alerts || 0
  const badgeCount = unreadCount + alertCount

  const userRoleName = user?.roles?.[0]?.name
  const userRole = (Array.isArray(rolesData) ? rolesData : []).find((r: TopbarRole) => r.name === userRoleName)
  const userPerms = (userRole?.permissions || []).map((p) => p.name)
  const isAdmin = ['admin', 'Super Admin', 'Admin'].includes(userRoleName || '')

  const can = (perm: string) => isAdmin || userPerms.includes(perm) || (user?.permissions || []).includes(perm)
  const canSettings = can('edit_settings') || isAdmin
  const canReports = can('view_reports') || isAdmin
  const canUsers = can('view_users') || can('create_users') || isAdmin

  const handleLogout = async () => {
    setMenuOpen(false)
    try {
      await api.post('/auth/logout')
    } catch {
      // The local session is cleared even if the API call fails.
    }
    logout()
    navigate('/login')
  }

  const markRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`)
      refetchNotifs()
    } catch {
      // ignore
    }
  }

  const initial = (user?.name || user?.username || '?').trim().charAt(0).toUpperCase()
  const avatarSrc = user?.avatar || user?.image

  return (
    <header className="flex min-h-14 items-center border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900 sm:px-6 sm:py-3">
      <div className={lang === 'ar' ? 'mr-auto flex min-w-0 items-center gap-1.5 sm:gap-3' : 'ml-auto flex min-w-0 items-center gap-1.5 sm:gap-3'}>
        {/* Notifications bell */}
        <div className="relative order-1">
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <Bell className="w-5 h-5" />
            {badgeCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {badgeCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute end-0 mt-2 w-[min(24rem,calc(100vw-2rem))] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">التنبيهات والإشعارات</p>
                  {alertCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                      {formatNumber(alertCount)}
                    </span>
                  )}
                </div>
                <div className="max-h-[26rem] overflow-y-auto">
                  {alertCount === 0 && notifications.length === 0 && (
                    <p className="text-center py-6 text-sm text-gray-500">لا توجد تنبيهات أو إشعارات</p>
                  )}

                  {alertCount > 0 && alertSummary && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                      <div className="grid grid-cols-3 gap-2 p-3 text-center">
                        <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/40">
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatNumber(alertSummary.expired_lots)}</p>
                          <p className="text-[11px] text-red-700 dark:text-red-300">منتهي الصلاحية</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/40">
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatNumber(alertSummary.near_expiry_lots)}</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">قارب الانتهاء</p>
                        </div>
                        <div className="rounded-lg bg-orange-50 p-2 dark:bg-orange-950/40">
                          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatNumber(alertSummary.low_stock_products)}</p>
                          <p className="text-[11px] text-orange-700 dark:text-orange-300">مخزون منخفض</p>
                        </div>
                      </div>
                      {alertSummary.total_loss > 0 && (
                        <p className="px-4 pb-3 text-[11px] text-gray-500 dark:text-gray-400">
                          خسائر المنتجات منتهية الصلاحية:{' '}
                          <strong className="text-red-600 dark:text-red-400">{formatMoney(alertSummary.total_loss, symbol)}</strong>
                        </p>
                      )}

                      {expiredAlerts.slice(0, 3).map((batch) => (
                        <div key={`expired-${batch.id}`} className="flex items-start gap-2 px-4 py-2 border-t border-gray-50 dark:border-gray-800/60">
                          <PackageX className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{batch.product_name}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatNumber(batch.quantity)} وحدة · {batch.warehouse_name || '-'} · خسارة {formatMoney(batch.loss, symbol)}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium text-red-600 dark:text-red-400">منتهي</span>
                        </div>
                      ))}

                      {nearExpiryAlerts.slice(0, 3).map((batch) => (
                        <div key={`near-${batch.id}`} className="flex items-start gap-2 px-4 py-2 border-t border-gray-50 dark:border-gray-800/60">
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{batch.product_name}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatNumber(batch.quantity)} وحدة · {batch.warehouse_name || '-'} · تنتهي {batch.expiry_date ? formatDate(batch.expiry_date) : '-'}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            {batch.days_left === 0 ? 'اليوم' : `متبقي ${formatNumber(batch.days_left ?? 0)} يوم`}
                          </span>
                        </div>
                      ))}

                      {lowStockAlerts.slice(0, 3).map((product) => (
                        <div key={`low-${product.id}`} className="flex items-start gap-2 px-4 py-2 border-t border-gray-50 dark:border-gray-800/60">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              المخزون {formatNumber(product.stock)} · الحد الأدنى {formatNumber(product.threshold)}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium text-orange-600 dark:text-orange-400">نواقص</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n.id)}
                      className={`w-full text-right px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${n.is_read ? 'opacity-60' : ''}`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title || n.message}</p>
                      {n.message && n.title && (
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{n.created_at}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setNotifOpen(false); navigate('/warehouses') }}
                  className="w-full border-t border-gray-100 px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                >
                  عرض المخازن والتنبيهات
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={toggleDarkMode}
          className="order-2 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleLang}
          className="order-3 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          {lang === 'ar' ? 'EN' : 'AR'}
        </button>

        <div className="relative order-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {avatarSrc || restaurant?.logo ? (
              <img
                src={mediaUrl(avatarSrc || restaurant?.logo || '')}
                alt={user?.name || restaurant?.name}
                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                {initial}
              </div>
            )}
            <div className="hidden text-start sm:block">
              <p className="text-sm font-medium dark:text-gray-100">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.username ? `@${user?.username}` : user?.roles?.[0]?.name}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute end-0 mt-2 w-[min(15rem,calc(100vw-2rem))] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.username ? `@${user?.username}` : user?.roles?.[0]?.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {user?.roles?.[0]?.name}
                  </p>
                </div>

                {canUsers && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate('/users') }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Users className="w-4 h-4" />
                    المستخدمون
                  </button>
                )}

                {canReports && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate('/reports') }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <BarChart3 className="w-4 h-4" />
                    التقارير
                  </button>
                )}

                {canSettings && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate('/settings') }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Settings className="w-4 h-4" />
                    الإعدادات
                  </button>
                )}

                <div className="border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:text-red-400"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="order-5 rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 lg:hidden"
          aria-label={lang === 'en' ? 'Open menu' : 'فتح القائمة'}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
