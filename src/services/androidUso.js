// La app de Android abre MuMu con …#uso=<datos>: el uso del celular de los últimos días (Bienestar digital).
// Aquí se guarda en "Celular y redes" sin que tengas que hacer nada.
import { watch } from 'vue'
import { state, ui } from '../store'
import { toast } from '../engine/game'

const PKG = {
  'com.whatsapp': 'whatsapp', 'com.whatsapp.w4b': 'whatsapp', 'com.facebook.katana': 'facebook', 'com.facebook.lite': 'facebook',
  'com.instagram.android': 'instagram', 'com.zhiliaoapp.musically': 'tiktok', 'com.ss.android.ugc.trill': 'tiktok', 'com.instagram.barcelona': 'threads',
  'com.google.android.youtube': 'youtube', 'com.android.chrome': 'chrome', 'com.anthropic.claude': 'claude', 'com.openai.chatgpt': 'chatgpt',
}
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

function decode(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decodeURIComponent(escape(s)))
}

export function importUso(data) {
  state.settings.android = { at: new Date().toISOString(), permiso: !!data.permiso }
  if (!data.permiso) return 0
  let days = 0
  for (const [date, d] of Object.entries(data.d || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const apps = {}, names = {}
    for (const [pkg, min] of Object.entries(d.a || {})) {
      const m = Math.max(0, Math.min(1440, Number(min) || 0)); if (!m) continue
      const k = PKG[pkg] || slug(data.l?.[pkg] || pkg)
      if (!k) continue
      apps[k] = (apps[k] || 0) + m
      if (!PKG[pkg]) names[k] = String(data.l?.[pkg] || pkg).slice(0, 40)
    }
    const prev = state.screen.find((s) => s.date === date)
    state.screen = state.screen.filter((s) => s.date !== date)
    state.screen.unshift({ id: prev?.id || 'sc_' + date, date, total: Math.min(1440, Number(d.t) || 0), notifications: prev?.notifications || null, apps, names, source: 'android' })
    days++
  }
  state.screen.sort((a, b) => (a.date < b.date ? 1 : -1))
  return days
}

// Al abrir desde la app: espera a que carguen tus datos y guarda el uso
export function initAndroidUso() {
  const m = location.hash.match(/^#uso=([\w-]+)/)
  if (!m) return
  history.replaceState(null, '', location.pathname + location.search)
  let data
  try { data = decode(m[1]) } catch { return }
  ui.inAndroid = true
  let done = false
  let late = false
  setTimeout(() => { late = true }, 15000)
  watch(() => ui.synced || (late && ui.authReady), (ready) => {
    if (!ready || done) return
    done = true
    const n = importUso(data)
    if (!data.permiso) toast('Para leer tu tiempo de pantalla, dale permiso a MuMu en Celular y redes.')
    else if (n) toast(`Tiempo de pantalla actualizado (${n} días)`)
  }, { immediate: true })
  setTimeout(() => { if (!done && ui.authReady) { done = true; importUso(data) } }, 16000)
}
