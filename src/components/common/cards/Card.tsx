import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

const paddings = {
  sm: 'p-3',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export default function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={clsx(
      'bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800',
      paddings[padding],
      className
    )}>
      {children}
    </div>
  )
}
