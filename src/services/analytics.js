// Google Analytics 4 SOLO después de aceptar cookies. Sin VITE_GA_ID no se carga nada ni sale el banner.
import { ui } from '../store'
export const GA_ID = import.meta.env.VITE_GA_ID || ''
const KEY = 'mumu:cookies'
const get = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const set = (v) => { try { localStorage.setItem(KEY, v) } catch { /* sin almacenamiento */ } }

let loaded = false
function load() {
  if (loaded || !GA_ID) return
  loaded = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { anonymize_ip: true })
}

export function initAnalytics() {
  if (!GA_ID) return
  const c = get()
  if (c === 'si') load()
  else if (!c) ui.cookieBanner = true
}
export function consent(yes) { set(yes ? 'si' : 'no'); ui.cookieBanner = false; if (yes) load() }
export function trackView(route) { if (loaded && window.gtag) window.gtag('event', 'page_view', { page_title: route, page_location: `${location.origin}${route === 'home' ? '/' : '/' + route}` }) }
