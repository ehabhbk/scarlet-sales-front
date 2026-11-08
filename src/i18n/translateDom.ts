import dictionary from './ar-en.json'

type Dictionary = Record<string, string>

const sourceDictionary = dictionary as Dictionary

const ARABIC_CHAR = /[\u0600-\u06FF]/
const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const

const normalize = (value: string) => value.replace(/[\s\u00A0]+/g, ' ').trim()

const EXCLUDED_SELECTOR =
  'script, style, textarea, code, pre, [translate="no"], [data-no-translate], .notranslate, [contenteditable="true"]'

interface TrackedText {
  source: string
  translated: string
}

interface TrackedAttribute {
  source: string
  translated: string
}

const textOriginals = new WeakMap<Text, TrackedText>()
const attributeOriginals = new WeakMap<Element, Map<string, TrackedAttribute>>()
const trackedTexts = new Set<Text>()
const trackedElements = new Set<Element>()

let observer: MutationObserver | null = null
let scheduled = false
let pendingRoots: Node[] = []

function translateContent(value: string): string | null {
  const normalized = normalize(value)
  if (!normalized || !ARABIC_CHAR.test(normalized)) return null

  const exact = sourceDictionary[normalized]
  if (exact) return exact === normalized ? null : exact

  return null
}

function preserveWhitespace(value: string, translated: string): string {
  const leading = value.match(/^\s+/)?.[0] ?? ''
  const trailing = value.match(/\s+$/)?.[0] ?? ''
  return `${leading}${translated}${trailing}`
}

function translateTextNode(node: Text) {
  const value = node.data
  const tracked = textOriginals.get(node)
  if (tracked && value === tracked.translated) return
  if (!ARABIC_CHAR.test(value)) return

  const translated = translateContent(value)
  if (!translated) return

  const output = preserveWhitespace(value, translated)
  if (output === value) return

  if (tracked) {
    tracked.source = value
    tracked.translated = output
  } else {
    textOriginals.set(node, { source: value, translated: output })
    trackedTexts.add(node)
  }
  node.data = output
}

function translateAttributes(element: Element) {
  for (const name of TRANSLATED_ATTRIBUTES) {
    const value = element.getAttribute(name)
    if (!value || !ARABIC_CHAR.test(value)) continue

    let attributes = attributeOriginals.get(element)
    const tracked = attributes?.get(name)
    if (tracked && value === tracked.translated) continue

    const translated = translateContent(value)
    if (!translated) continue

    if (!attributes) {
      attributes = new Map()
      attributeOriginals.set(element, attributes)
    }
    attributes.set(name, { source: value, translated })
    trackedElements.add(element)
    element.setAttribute(name, translated)
  }
}

function translateElement(element: Element) {
  if (element.matches(EXCLUDED_SELECTOR)) return
  if (element.closest('[translate="no"], [data-no-translate], .notranslate')) return

  translateAttributes(element)
  for (const child of Array.from(element.childNodes)) {
    translateNode(child)
  }
}

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement
    if (parent && !parent.matches(EXCLUDED_SELECTOR) && !parent.closest(EXCLUDED_SELECTOR)) {
      translateTextNode(node as Text)
    }
    return
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    if (element.isConnected) translateElement(element)
  }
}

function processPendingRoots() {
  scheduled = false
  const roots = pendingRoots
  pendingRoots = []
  for (const root of roots) translateNode(root)
}

function scheduleTranslation(root: Node) {
  pendingRoots.push(root)
  if (scheduled) return
  scheduled = true
  // A microtask keeps new React output translated even when the tab is in the
  // background, where requestAnimationFrame callbacks are paused.
  queueMicrotask(processPendingRoots)
}

function restoreOriginals() {
  for (const node of trackedTexts) {
    const tracked = textOriginals.get(node)
    if (!tracked) continue
    if (node.data === tracked.translated) {
      node.data = tracked.source
    } else if (!ARABIC_CHAR.test(node.data)) {
      node.data = tracked.source
    }
  }
  trackedTexts.clear()

  for (const element of trackedElements) {
    const attributes = attributeOriginals.get(element)
    if (!attributes) continue
    for (const [name, tracked] of attributes) {
      if (element.getAttribute(name) === tracked.translated) {
        element.setAttribute(name, tracked.source)
      } else if (!ARABIC_CHAR.test(element.getAttribute(name) || '')) {
        element.setAttribute(name, tracked.source)
      }
    }
  }
  trackedElements.clear()
}

export function startDomTranslation() {
  stopDomTranslation()
  if (typeof document === 'undefined' || !document.body) return

  translateElement(document.body)

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' || mutation.type === 'attributes') {
        scheduleTranslation(mutation.target)
      } else {
        for (const node of Array.from(mutation.addedNodes)) scheduleTranslation(node)
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRIBUTES],
  })
}

export function stopDomTranslation() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  scheduled = false
  pendingRoots = []
  restoreOriginals()
}
