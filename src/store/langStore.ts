import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'ar' | 'en'

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: 'ar',
      setLang: (lang) => {
        document.documentElement.lang = lang
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
        set({ lang })
      },
      toggleLang: () => {
        const next = get().lang === 'ar' ? 'en' : 'ar'
        document.documentElement.lang = next
        document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
        set({ lang: next })
      },
    }),
    { name: 'lang-storage' }
  )
)

// Apply on load
const initial = (typeof window !== 'undefined' && localStorage.getItem('lang-storage'))
  ? JSON.parse(localStorage.getItem('lang-storage') as string)?.state?.lang || 'ar'
  : 'ar'
if (typeof document !== 'undefined') {
  document.documentElement.lang = initial
  document.documentElement.dir = initial === 'ar' ? 'rtl' : 'ltr'
}