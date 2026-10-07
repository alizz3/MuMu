export const pad = (n) => String(n).padStart(2, '0')
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const keyPlus = (n, from = new Date()) => dayKey(addDays(from, n))
export const hm = (s) => { if (!s) return 0; const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0) }
export const toHM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min % 60))}`
export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes()

export const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fmt12(min) {
  const h = Math.floor(min / 60) % 24, m = Math.round(min % 60)
  const s = h < 12 ? 'a. m.' : 'p. m.'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${pad(m)} ${s}`
}
export const fmt12s = (s) => fmt12(hm(s))

export function fmtDur(min) {
  min = Math.max(0, Math.round(min))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

export function daysUntil(k) {
  if (!k) return Infinity
  return Math.round((parseDay(k) - parseDay(dayKey())) / 864e5)
}

export function relDay(k) {
  const d = daysUntil(k)
  if (d === 0) return 'hoy'
  if (d === 1) return 'mañana'
  if (d === -1) return 'ayer'
  if (d > 1 && d < 7) return WEEKDAYS_LONG[parseDay(k).getDay()]
  if (d < 0) return `hace ${-d} días`
  return `en ${d} días`
}

export function longDate(d = new Date()) {
  const s = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
  return s[0].toUpperCase() + s.slice(1)
}

export const shortDate = (k) => { const d = parseDay(k); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}` }

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'Hola, trasnochadora'
  if (h < 12) return '¡Buenos días'
  if (h < 19) return '¡Buenas tardes'
  return '¡Buenas noches'
}

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`

// PRNG determinista para datos de ejemplo
export function rng(seed = 7) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}
