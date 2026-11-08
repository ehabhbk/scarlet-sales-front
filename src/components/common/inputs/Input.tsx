import { clsx } from 'clsx'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: ReactNode
  trailing?: ReactNode
}

export default function Input({ 
  label, 
  error, 
  hint,
  icon, 
  trailing,
  className, 
  ...props 
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          className={clsx(
            'w-full px-4 py-2 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent transition-colors dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500',
            icon && 'ps-10',
            trailing && 'pe-10',
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700',
            className
          )}
          {...props}
        />
        {trailing && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center">
            {trailing}
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
