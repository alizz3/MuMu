// Dictado por voz reutilizable (Web Speech API, gratis, sin servidores propios).
// Uso:
//   const d = useDictado()
//   d.toggle('campo', (texto) => { modelo.campo = juntar(modelo.campo, texto) })
//   d.active.value === 'campo'  -> está escuchando ese campo
// Solo un campo escucha a la vez. Si el navegador no lo soporta, d.supported es false.
import { ref, onUnmounted } from 'vue'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
export const dictadoSupported = !!SR
export const DICTADO_FALLBACK = 'Tu navegador no deja dictar aquí. Usa el micrófono del teclado de Google (el iconito del micro en el teclado).'

// Pega texto nuevo al final de lo que ya había, con espacio y mayúscula al inicio si toca
export function juntar(prev, add) {
  const a = (prev || '').trimEnd(), b = (add || '').trim()
  if (!b) return prev || ''
  if (!a) return b.charAt(0).toUpperCase() + b.slice(1)
  const nb = /[.!?]$/.test(a) ? b.charAt(0).toUpperCase() + b.slice(1) : b
  return a + ' ' + nb
}

export function useDictado({ lang = 'es-CO' } = {}) {
  const active = ref(null) // id del campo que escucha
  const interim = ref('') // lo que va entendiendo (aún no confirmado)
  const error = ref('')
  let rec = null, onFinal = null, wanted = false

  function start(id, cb) {
    error.value = ''
    if (!SR) { error.value = DICTADO_FALLBACK; return false }
    stop()
    onFinal = cb; active.value = id; interim.value = ''; wanted = true
    rec = new SR()
    rec.lang = lang
    rec.interimResults = true
    try { rec.continuous = true } catch { /* algunos navegadores no lo permiten */ }
    rec.onresult = (ev) => {
      let fin = '', mid = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r.isFinal) fin += r[0].transcript; else mid += r[0].transcript
      }
      if (fin.trim()) onFinal?.(fin.trim())
      interim.value = mid
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { error.value = 'No me diste permiso del micrófono. Actívalo en el candadito de la barra, o usa el micrófono del teclado de Google.'; wanted = false }
      else if (ev.error === 'network') { error.value = 'El dictado necesita internet. Mientras tanto, usa el micrófono del teclado de Google.'; wanted = false }
    }
    // En Android se apaga solo tras un silencio: lo volvemos a prender mientras ella no lo detenga
    rec.onend = () => {
      if (wanted && rec) { try { rec.start(); return } catch { /* sigue abajo */ } }
      active.value = null; interim.value = ''; rec = null
    }
    try { rec.start() } catch { error.value = DICTADO_FALLBACK; active.value = null; return false }
    return true
  }
  function stop() {
    wanted = false
    if (rec) { try { rec.stop() } catch { /* ya parado */ } }
    active.value = null; interim.value = ''
  }
  function toggle(id, cb) { if (active.value === id) { stop(); return false } return start(id, cb) }

  onUnmounted(stop)
  return { supported: dictadoSupported, active, interim, error, start, stop, toggle }
}
