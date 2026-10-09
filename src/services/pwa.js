// App instalable: registra el service worker, avisa cuando hay versión nueva y guarda el evento de "Instalar".
import { registerSW } from 'virtual:pwa-register'
import { ui } from '../store'
import { toast } from '../engine/game'

// Versión nueva: se instala sola, sin botón. Solo espera a que no estés en medio de algo
// (escribiendo, con una ventanita abierta o en una sesión de enfoque) para no perder nada.
const busy = () => !!ui.modal || !!ui.focus || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
export function initPWA() {
  let pending = false
  const apply = () => { if (!pending) return; if (busy() && document.visibilityState === 'visible') return; pending = false; try { sessionStorage.setItem('mumu-updated', '1') } catch {} ; updateSW(true) }
  const updateSW = registerSW({
    onNeedRefresh() { pending = true; apply() },
    onOfflineReady() { toast('MuMu ya funciona sin internet 🐮') },
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
  try { if (sessionStorage.getItem('mumu-updated')) { sessionStorage.removeItem('mumu-updated'); setTimeout(() => toast('MuMu se actualizó ✨'), 1200) } } catch {}
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installPrompt = e })
  window.addEventListener('appinstalled', () => { ui.installPrompt = null; ui.installed = true; toast('¡MuMu quedó instalada! 💗') })
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
