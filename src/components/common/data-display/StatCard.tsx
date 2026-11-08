import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  color?: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

export default function StatCard({ label, value, icon, color = 'bg-primary', trend }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 break-words text-xl font-bold sm:text-2xl">{value}</p>
          {trend && (
            <p className={clsx(
              'text-sm mt-1',
              trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={`${color} flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
