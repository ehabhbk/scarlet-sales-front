import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}

const variants = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
}

export default function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full font-medium',
      variants[variant],
      sizes[size]
    )}>
      {children}
    </span>
  )
}
