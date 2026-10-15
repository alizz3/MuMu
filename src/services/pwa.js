// App instalable: registra el service worker, avisa cuando hay versión nueva y guarda el evento de "Instalar".
import { registerSW } from 'virtual:pwa-register'
import { ui } from '../store'
import { toast } from '../engine/game'

// Versión nueva: se instala sola, sin botón y sin interrumpirte. Se aplica cuando dejas MuMu
// en segundo plano, o si llevas 3 minutos sin tocar nada (y no estás escribiendo ni en enfoque).
const busy = () => !!ui.modal || !!ui.focus || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
let lastTouch = Date.now()
;['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { lastTouch = Date.now() }, { passive: true, capture: true }))
export function initPWA() {
  let pending = false
  const apply = () => {
    if (!pending) return
    const hidden = document.visibilityState === 'hidden'
    if (!hidden && (busy() || Date.now() - lastTouch < 3 * 60e3)) return
    pending = false
    if (!hidden) { try { sessionStorage.setItem('mumu-updated', '1') } catch {} }
    updateSW(true)
  }
  const updateSW = registerSW({
    onNeedRefresh() { pending = true; apply() },
    onOfflineReady() { toast('MuMu ya funciona sin internet') },
    onRegisteredSW(_url, reg) {
      // Busca versiones nuevas cada 30 min y al volver a la app
      if (!reg) return
      setInterval(() => { if (navigator.onLine) reg.update().catch(() => {}) }, 30 * 60e3)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {}) })
    },
  })
  // Si estabas ocupada, se aplica apenas termines (o cuando dejes la app en segundo plano)
  setInterval(apply, 3000)
  document.addEventListener('visibilitychange', apply)
  try { if (sessionStorage.getItem('mumu-updated')) { sessionStorage.removeItem('mumu-updated'); setTimeout(() => toast('MuMu se actualizó'), 1200) } } catch {}
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installPrompt = e })
  window.addEventListener('appinstalled', () => { ui.installPrompt = null; ui.installed = true; toast('¡MuMu quedó instalada!') })
  ui.installed = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  ui.isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export async function installApp() {
  const p = ui.installPrompt
  if (!p) return false
  p.prompt()
  const { outcome } = await p.userChoice
  ui.installPrompt = null
  return outcome === 'accepted'
}
