import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  emptyMessage?: string
}

export default function DataTable<T extends { id: number }>({ 
  data, 
  columns, 
  loading = false,
  emptyMessage = 'لا توجد بيانات' 
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto sm:mx-0 sm:w-full">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            {columns.map((column) => (
              <th 
                key={column.key} 
                className={clsx(
                  'whitespace-nowrap px-3 py-3 text-start text-sm font-medium text-gray-600 dark:text-gray-400 sm:px-4',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr 
              key={item.id} 
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              {columns.map((column) => (
                <td 
                  key={column.key} 
                  className={clsx('px-3 py-3 text-sm text-gray-700 dark:text-gray-300 sm:px-4', column.className)}
                >
                  {column.render
                    ? column.render(item)
                    : (() => {
                        const value = item[column.key as keyof T]
                        return typeof value === 'string' || typeof value === 'number' ? value : null
                      })()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
