import { en } from './en'
import { pl } from './pl'
import type { Lang, Strings } from './types'

export type { Lang, Strings }
export { en, pl }

const STORAGE = 'karaluch-lang'
const catalogs: Record<Lang, Strings> = { pl, en }
const listeners = new Set<() => void>()

let lang: Lang = 'pl'

export function t(): Strings {
  return catalogs[lang]
}

export function currentLang(): Lang {
  return lang
}

export function initLang(): Lang {
  lang = resolveLang()
  persist(lang)
  applyDocumentLang()
  return lang
}

export function setLang(next: Lang): void {
  if (next === lang) return
  lang = next
  persist(next)
  applyDocumentLang()
  for (const fn of listeners) fn()
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function mountLangSwitch(): void {
  if (document.getElementById('lang-switch')) return
  const root = document.createElement('div')
  root.id = 'lang-switch'
  root.setAttribute('role', 'group')
  root.append(flagButton('pl', FLAG_PL), flagButton('en', FLAG_UK))
  document.body.append(root)
  syncSwitch()
  onLangChange(syncSwitch)
}

export function setLangSwitchVisible(on: boolean): void {
  document.getElementById('lang-switch')?.classList.toggle('hidden', !on)
}

function resolveLang(): Lang {
  const params = new URLSearchParams(window.location.search)
  return parseLang(params.get('lang')) ?? parseLang(window.localStorage.getItem(STORAGE)) ?? 'pl'
}

function parseLang(raw: string | null): Lang | null {
  if (!raw) return null
  const n = raw.trim().toLowerCase()
  if (n === 'pl' || n === 'pol' || n === 'pl-pl' || n === 'polish') return 'pl'
  if (n === 'en' || n === 'eng' || n === 'en-gb' || n === 'en-us' || n === 'english') return 'en'
  return null
}

function persist(next: Lang): void {
  window.localStorage.setItem(STORAGE, next)
  const url = new URL(window.location.href)
  url.searchParams.set('lang', next === 'pl' ? 'PL' : 'ENG')
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function applyDocumentLang(): void {
  const s = t()
  document.documentElement.lang = s.meta.htmlLang
  document.title = s.meta.title
  applyDataI18n()
}

function applyDataI18n(): void {
  const s = t()
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (!key) return
    const value = lookup(s, key)
    if (typeof value === 'string') el.textContent = value
  })
}

function lookup(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return (acc as Record<string, unknown>)[part]
    return undefined
  }, source)
}

function syncSwitch(): void {
  const root = document.getElementById('lang-switch')
  if (!root) return
  const s = t()
  root.setAttribute('aria-label', s.lang.group)
  root.querySelectorAll<HTMLButtonElement>('button[data-lang]').forEach((btn) => {
    const id = btn.dataset.lang === 'en' ? 'en' : 'pl'
    const on = id === lang
    btn.classList.toggle('on', on)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.title = id === 'pl' ? s.lang.pl : s.lang.en
    btn.setAttribute('aria-label', id === 'pl' ? s.lang.pl : s.lang.en)
  })
}

function flagButton(id: Lang, svg: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.dataset.lang = id
  btn.innerHTML = svg
  btn.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  btn.addEventListener('pointerup', (event) => {
    event.preventDefault()
    event.stopPropagation()
    setLang(id)
  })
  btn.addEventListener('click', (event) => event.stopPropagation())
  return btn
}

const FLAG_PL = `<svg viewBox="0 0 640 480" aria-hidden="true"><rect width="640" height="240" fill="#fff"/><rect y="240" width="640" height="240" fill="#dc143c"/></svg>`

const FLAG_UK = `<svg viewBox="0 0 60 30" aria-hidden="true">
  <rect width="60" height="30" fill="#012169"/>
  <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" stroke-width="10"/>
  <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" stroke-width="4"/>
  <path d="M30 0 V30 M0 15 H60" stroke="#fff" stroke-width="16"/>
  <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" stroke-width="10"/>
</svg>`
