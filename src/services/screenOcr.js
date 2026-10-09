// Leer capturas de Bienestar digital en el propio equipo (sin IA de pago, sin subir la imagen a ningún servidor).
// Usa Tesseract (reconocimiento de texto gratuito que corre en el navegador).
import { APPS } from '../engine/screen'

const NAMES = [...APPS.map(([k, n]) => [k, n]), ['camscanner', 'CamScanner'], ['spotify', 'Spotify'], ['netflix', 'Netflix'], ['telegram', 'Telegram'], ['gmail', 'Gmail'], ['messenger', 'Messenger'], ['pinterest', 'Pinterest'], ['twitter', 'Twitter'], ['capcut', 'CapCut'], ['canva', 'Canva'], ['fotos', 'Fotos'], ['drive', 'Drive'], ['classroom', 'Classroom'], ['nequi', 'Nequi Colombia'], ['health', 'Health']]
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim()
// "2 h 40 min", "2h 40 min", "49 min", "1 h"
const DUR = /(\d{1,2})\s*h(?:\s*(\d{1,2})\s*m(?:in)?)?|(\d{1,3})\s*m(?:in)?\b/
const durOf = (line) => { const m = line.match(DUR); if (!m) return null; return m[1] ? +m[1] * 60 + (m[2] ? +m[2] : 0) : +m[3] }

// Las capturas en modo oscuro se leen mejor invertidas y en grande
async function prepare(file) {
  const img = await createImageBitmap(file)
  const scale = img.width < 1000 ? 2 : 1
  const c = document.createElement('canvas'); c.width = img.width * scale; c.height = img.height * scale
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height)
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data
  let lum = 0; for (let i = 0; i < p.length; i += 40) lum += p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11
  const dark = lum / (p.length / 40) < 110
  for (let i = 0; i < p.length; i += 4) { let g = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11; if (dark) g = 255 - g; p[i] = p[i + 1] = p[i + 2] = g }
  x.putImageData(d, 0, 0)
  return c
}

export async function readScreenshots(files, onProgress = () => {}) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, { logger: (m) => m.status === 'recognizing text' && onProgress(m.progress) })
  const out = { total: 0, notifications: 0, apps: {}, names: {} }
  try {
    for (const f of files) {
      const { data } = await worker.recognize(await prepare(f))
      parseText(data.text, out)
    }
  } finally { await worker.terminate() }
  return out
}

// Saca total, notificaciones y minutos por app del texto leído
export function parseText(text, out = { total: 0, notifications: 0, apps: {}, names: {} }) {
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      lines.forEach((raw, i) => {
        const l = norm(raw)
        // Total del día
        if (!out.total && /tiempo total|total de pantalla/.test(l)) { const prev = durOf(norm(lines[i - 1] || '')); if (prev) out.total = prev }
        if (!out.total && /^\d{1,2}\s*h\s*\d{1,2}\s*min$/.test(l) && i < 6) out.total = durOf(l)
        // Notificaciones
        const n = l.match(/(\d[\d ]{0,5}\d)\s*notificaciones/); if (n) out.notifications = +n[1].replace(/ /g, '')
        // Apps: el nombre y el tiempo pueden estar en la misma línea o en la siguiente
        const hit = NAMES.find(([, name]) => new RegExp(`(^|\\s)${norm(name)}(\\s|$)`).test(l))
        if (hit) {
          const d = durOf(l.replace(norm(hit[1]), '')) ?? durOf(norm(lines[i + 1] || ''))
          if (d != null && !(hit[0] in out.apps)) { out.apps[hit[0]] = d; if (!APPS.some((a) => a[0] === hit[0])) out.names[hit[0]] = hit[1] }
        }
      })
  return out
}
