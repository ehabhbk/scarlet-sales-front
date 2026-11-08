import { useEffect } from 'react'
import { useLangStore } from '../store/langStore'
import { startDomTranslation, stopDomTranslation } from './translateDom'

/**
 * Applies the Arabic → English UI dictionary to the whole rendered app.
 * The app is authored in Arabic, so translating the live DOM keeps every
 * page, modal, table, toast and attribute in sync without duplicating each
 * string in the component tree.
 */
export default function AutoTranslate() {
  const lang = useLangStore((state) => state.lang)

  useEffect(() => {
    if (lang === 'en') {
      startDomTranslation()
      return () => stopDomTranslation()
    }
    stopDomTranslation()
    return undefined
  }, [lang])

  return null
}
