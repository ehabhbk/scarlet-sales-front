import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import type { ReactNode } from 'react'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { sidebarOpen, darkMode, mobileSidebarOpen, setMobileSidebarOpen } = useUiStore()
  const user = useAuthStore((state) => state.user)
  const location = useLocation()
  const loadSettings = useSettingsStore((state) => state.load)

  const routeRules: Record<string, { all?: string[]; any?: string[] }> = {
    '/': { all: ['view_dashboard'] },
    '/dashboard': { all: ['view_dashboard'] },
    '/notifications': { all: ['view_notifications'] },
    '/pos': { any: ['create_orders', 'view_pos'] },
    '/orders': { all: ['view_orders'] },
    '/products': { all: ['view_products'] },
    '/categories': { all: ['view_categories'] },
    '/warehouses': { any: ['view_warehouses', 'view_inventory', 'view_products', 'manage_stock'] },
    '/employees': { all: ['view_employees'] },
    '/attendance': { all: ['view_employees'] },
    '/inventory': { all: ['view_inventory'] },
    '/stock-movements': { all: ['view_inventory'] },
    '/purchases': { all: ['view_purchases'] },
    '/customers': { all: ['view_customers'] },
    '/finance': { all: ['view_finance'] },
    '/finance/chart-of-accounts': { all: ['view_finance'] },
    '/finance/income-statement': { all: ['view_finance'] },
    '/finance/balance-sheet': { all: ['view_finance'] },
    '/finance/ledger': { all: ['view_finance'] },
    '/finance/journal-entries': { all: ['view_finance'] },
    '/expenses': { all: ['view_finance'] },
    '/reports': { any: ['view_reports', 'view_finance', 'view_inventory', 'view_purchases', 'view_employees', 'view_all_shifts', 'close_shift'] },
    '/settings': { all: ['edit_settings'] },
    '/users': { all: ['view_users'] },
    '/shifts': { any: ['view_all_shifts', 'close_shift'] },
    '/roles': { all: ['view_roles'] },
  }
  const routeRule = routeRules[location.pathname]
  const userPermissions = user?.permissions || []
  const canAccessRoute = !routeRule || (
    (routeRule.all || []).every((permission) => userPermissions.includes(permission))
    && (!routeRule.any || routeRule.any.some((permission) => userPermissions.includes(permission)))
  )

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Close the mobile drawer whenever the user navigates or the layout mounts.
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname, setMobileSidebarOpen])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [setMobileSidebarOpen])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/*
        The sidebar always sits on the physical right so the Topbar control
        group can stay pinned to the far left in both Arabic (RTL) and English
        (LTR). In LTR the row is reversed to mirror the RTL shell.
      */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          mobileOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {canAccessRoute ? children : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 dark:bg-amber-950/40 dark:border-amber-900">
                لا تملك الصلاحية اللازمة لعرض هذه الصفحة.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
