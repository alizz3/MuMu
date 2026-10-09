// Tiempo de pantalla: qué apps cuentan como redes y cómo leer "2 h 40 min".
export const APPS = [
  ['whatsapp', 'WhatsApp', 'social'], ['facebook', 'Facebook', 'social'], ['instagram', 'Instagram', 'social'], ['tiktok', 'TikTok', 'social'], ['threads', 'Threads', 'social'],
  ['youtube', 'YouTube', 'ocio'], ['chrome', 'Chrome', 'util'], ['claude', 'Claude', 'util'], ['chatgpt', 'ChatGPT', 'util'],
]
const SOCIAL = new Set(APPS.filter((a) => a[2] === 'social').map((a) => a[0]))
export const socialMinutes = (sc) => (sc ? Object.entries(sc.apps || {}).reduce((a, [k, v]) => a + (SOCIAL.has(k) ? Number(v) || 0 : 0), 0) : 0)
// "6 h 51 min", "2h40", "49", "1:30" → minutos
export function parseMin(v) {
  const s = String(v ?? '').toLowerCase().replace(',', '.').trim()
  if (!s) return 0
  const hm = s.match(/^(\d+):(\d{1,2})$/); if (hm) return +hm[1] * 60 + +hm[2]
  const h = s.match(/(\d+(?:\.\d+)?)\s*h[a-z]*\s*(\d+)?/), m = s.match(/(\d+)\s*m/)
  if (h) return Math.round(+h[1] * 60 + (h[2] ? +h[2] : 0))
  if (m) return +m[1]
  const n = s.match(/(\d+(?:\.\d+)?)/); if (n) return Math.round(+n[1])
  return 0
}
export const showMin = (m) => (!m ? '' : m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`)
