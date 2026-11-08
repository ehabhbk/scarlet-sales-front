import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Package,
  Truck,
  Activity,
  Bell,
  Users,
  DollarSign,
  Receipt,
  Landmark,
  FileText,
  Book,
  List,
  TrendingUp,
} from 'lucide-react'
import { useLangStore } from '../store/langStore'
import { useSettingsStore, mediaUrl } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import { t } from '../i18n'

interface SidebarProps {
  open: boolean
  mobileOpen: boolean
  onClose: () => void
}

interface NavChild {
  label: string
  path: string
  icon: typeof LayoutDashboard
  permissions?: string[]
}

interface NavItem {
  icon: typeof LayoutDashboard
  label: string
  path: string
  children?: NavChild[]
  permissions?: string[]
  anyPermissions?: string[]
}

export default function Sidebar({ open, mobileOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  )

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  // The drawer is always fully expanded on phones/tablets.
  const expanded = isDesktop ? open : true
  const { lang } = useLangStore()
  const isRtl = lang === 'ar'
  const { restaurant } = useSettingsStore()
  const permissions = useAuthStore((state) => state.user?.permissions || [])
  const can = (required: string[] = [], any: string[] = []) =>
    required.every((permission) => permissions.includes(permission))
    && (!any.length || any.some((permission) => permissions.includes(permission)))

  const menuItems: NavItem[] = [
    {
      icon: LayoutDashboard,
      label: t('dashboard', lang),
      path: '/dashboard',
      permissions: ['view_dashboard'],
      children: [{ label: 'الإشعارات', path: '/notifications', icon: Bell, permissions: ['view_notifications'] }],
    },
    { icon: ShoppingCart, label: t('pos', lang), path: '/pos', anyPermissions: ['create_orders', 'view_pos'] },
    {
      icon: Warehouse,
      label: 'المخزون',
      path: '/warehouses',
      anyPermissions: ['view_warehouses', 'view_inventory', 'view_products', 'manage_stock'],
      children: [
        { label: 'المخازن والمنتجات', path: '/warehouses', icon: Warehouse, permissions: ['view_warehouses'] },
        { label: 'المنتجات', path: '/inventory', icon: Package, permissions: ['view_inventory'] },
        { label: 'حركات المخزون', path: '/stock-movements', icon: Activity, permissions: ['view_inventory'] },
        { label: 'المشتريات', path: '/purchases', icon: Truck, permissions: ['view_purchases'] },
        { label: 'الموردون', path: '/suppliers', icon: Truck, permissions: ['view_suppliers'] },
        { label: 'وحدات القياس', path: '/inventory-units', icon: List, permissions: ['view_inventory'] },
        { label: 'جرد المخزون', path: '/stocktaking', icon: Package, permissions: ['view_inventory'] },
      ],
    },
    { icon: Users, label: 'الموظفون', path: '/employees', permissions: ['view_employees'] },
    {
      icon: DollarSign,
      label: 'المالية',
      path: '/finance',
      permissions: ['view_finance'],
      children: [
        { label: 'شجرة الحسابات', path: '/finance/chart-of-accounts', icon: List, permissions: ['view_finance'] },
        { label: 'ميزان المراجعة', path: '/finance/trial-balance', icon: List, permissions: ['view_finance'] },
        { label: 'كشف حساب', path: '/finance/account-statement', icon: Book, permissions: ['view_finance'] },
        { label: 'قيود اليومية', path: '/finance/journal-entries', icon: FileText, permissions: ['view_finance'] },
        { label: 'دفتر الأستاذ', path: '/finance/ledger', icon: Book, permissions: ['view_finance'] },
        { label: 'قائمة الدخل', path: '/finance/income-statement', icon: TrendingUp, permissions: ['view_finance'] },
        { label: 'الميزانية العمومية', path: '/finance/balance-sheet', icon: Landmark, permissions: ['view_finance'] },
        { label: 'المصروفات', path: '/expenses', icon: Receipt, permissions: ['view_finance'] },
      ],
    },
  ]

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 z-50 flex h-full w-64 shrink-0 flex-col overflow-hidden border-e border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          isRtl ? 'right-0' : 'left-0'
        } ${open ? 'lg:w-64' : 'lg:w-20'} ${
          mobileOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'
        }`}
      >
      <div className="px-4 py-5 border-b border-white/10">
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-3">
          {restaurant?.logo ? (
            <img
              src={mediaUrl(restaurant.logo)}
              alt={restaurant.name}
              className="w-11 h-11 rounded-xl object-cover bg-white/10 shrink-0 ring-1 ring-white/15"
            />
          ) : (
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg">
              {(restaurant?.name || 'S').trim().charAt(0).toUpperCase()}
            </div>
          )}
          {expanded && (
            <div className="min-w-0">
              <h1 className="font-bold text-base text-white truncate">
                {restaurant?.name || 'Scarlet Store'}
              </h1>
              <p className="text-[11px] text-slate-400 truncate">نظام سكارلت لإدارة المبيعات والمخازن</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const visibleChildren = (item.children || []).filter((child) => can(child.permissions))
          const showItem = can(item.permissions, item.anyPermissions) || visibleChildren.length > 0
          if (!showItem) return null
          const Icon = item.icon
          const canOpenItem = can(item.permissions, item.anyPermissions)
          const isActive = canOpenItem && location.pathname === item.path
          const isSectionActive =
            isActive || (item.children || []).some((child) => location.pathname === child.path)

          return (
            <div key={item.path}>
              {canOpenItem ? (
                <Link
                  to={item.path}
                  onClick={onClose}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isSectionActive
                      ? 'bg-blue-500/25 text-white ring-1 ring-blue-400/40 shadow-md scale-[1.03]'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 hover:scale-[1.02]'
                  }`}
                >
                  {isSectionActive && (
                    <span className="absolute start-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-e-full bg-sky-300" />
                  )}
                  <Icon className={`w-5 h-5 shrink-0 transition-colors ${isSectionActive ? 'text-sky-200' : 'group-hover:text-sky-200'}`} />
                  {expanded && (
                    <span className={`truncate transition-all duration-200 ${
                      isSectionActive ? 'text-base font-bold' : 'text-sm font-medium group-hover:text-base'
                    }`}>
                      {item.label}
                    </span>
                  )}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 text-slate-400">
                  <Icon className="w-5 h-5 shrink-0" />
                  {expanded && <span className="text-sm font-medium">{item.label}</span>}
                </div>
              )}

              {expanded && isSectionActive && visibleChildren.length > 0 && (
                <div className="mt-1 ms-5 space-y-1 border-s border-white/10 ps-3">
                  {visibleChildren.map((child) => {
                    const ChildIcon = child.icon
                    const childActive = location.pathname === child.path
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={onClose}
                        aria-current={childActive ? 'page' : undefined}
                        className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 ${
                          childActive
                            ? 'text-sky-200 bg-sky-500/20 font-bold scale-[1.02]'
                            : 'text-slate-200 hover:text-white hover:bg-white/10 hover:scale-[1.02]'
                        }`}
                      >
                        <ChildIcon className="w-4 h-4 shrink-0 transition-colors group-hover:text-sky-200" />
                        <span className={`truncate transition-all duration-200 ${
                          childActive ? 'text-sm font-bold' : 'text-[13px] group-hover:text-sm'
                        }`}>{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {expanded && (
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-[11px] text-slate-500">
            {new Date().getFullYear()} © {restaurant?.name || 'Scarlet Store'}
          </p>
        </div>
      )}
      </aside>
    </>
  )
}