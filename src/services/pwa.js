// App instalable: registra el service worker, avisa cuando hay versión nueva y guarda el evento de "Instalar".
import { registerSW } from 'virtual:pwa-register'
import { ui } from '../store'
import { toast } from '../engine/game'

export function initPWA() {
  const updateSW = registerSW({
    onNeedRefresh() { toast('Hay una versión nueva de MuMu ✨', 'info', { label: 'Actualizar', fn: () => updateSW(true) }) },
    onOfflineReady() { toast('MuMu ya funciona sin internet 🐮') },
  })
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
