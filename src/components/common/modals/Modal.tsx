import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-transparent bg-white text-gray-900 shadow-2xl dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 sm:max-h-[90vh] sm:rounded-xl ${sizes[size]}`}>
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 sm:p-6">
            <h2 className="min-w-0 truncate text-lg font-semibold sm:text-xl">{title}</h2>
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
