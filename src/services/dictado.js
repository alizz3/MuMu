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
  let rec = null, onFinal = null, wanted = false, pending = '', heard = false
  // En Android el modo continuo falla (no entrega el texto final): ahí se escucha por frases y se reinicia solo
  const android = /android/i.test(navigator.userAgent)
  const commit = () => { const t = pending.trim(); pending = ''; interim.value = ''; if (t) onFinal?.(t) }

  function start(id, cb) {
    error.value = ''
    if (!SR) { error.value = DICTADO_FALLBACK; return false }
    stop()
    onFinal = cb; active.value = id; interim.value = ''; wanted = true; pending = ''; heard = false
    const listen = () => {
      rec = new SR()
      rec.lang = lang
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.continuous = !android
      rec.onresult = (ev) => {
        heard = true
        let fin = '', mid = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i]
          if (r.isFinal) fin += r[0].transcript + ' '; else mid += r[0].transcript
        }
        if (fin.trim()) { pending = ''; interim.value = ''; onFinal?.(fin.trim()) }
        if (mid.trim()) { pending = mid; interim.value = mid }
      }
      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { error.value = 'MuMu no tiene permiso del micrófono. Dale permiso cuando te lo pida (o en Ajustes de la app), o usa el micrófono del teclado de Google.'; wanted = false }
        else if (ev.error === 'network') { error.value = 'El dictado necesita internet. Mientras tanto, usa el micrófono del teclado de Google.'; wanted = false }
        else if (ev.error === 'audio-capture') { error.value = 'Otro programa está usando el micrófono. Ciérralo e intenta de nuevo.'; wanted = false }
      }
      // Se apaga tras un silencio: guarda lo que entendió y vuelve a escuchar mientras no lo detengas
      rec.onend = () => {
        commit()
        if (wanted) { try { listen(); return } catch { /* sigue abajo */ } }
        active.value = null; rec = null
      }
      rec.start()
    }
    try { listen() } catch { error.value = DICTADO_FALLBACK; active.value = null; return false }
    // Si en 8 segundos no entendió nada, avisa (algunos celulares no dejan dictar dentro de apps)
    setTimeout(() => { if (wanted && !heard && active.value === id) error.value = 'No te estoy escuchando. Revisa el permiso del micrófono, o usa el micrófono del teclado de Google.' }, 8000)
    return true
  }
  function stop() {
    wanted = false
    commit()
    if (rec) { const r = rec; rec = null; r.onend = null; r.onresult = null; try { r.abort() } catch { /* ya parado */ } }
    active.value = null; interim.value = ''
  }
  function toggle(id, cb) { if (active.value === id) { stop(); return false } return start(id, cb) }

  onUnmounted(stop)
  return { supported: dictadoSupported, active, interim, error, start, stop, toggle }
}
