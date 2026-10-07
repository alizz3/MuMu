// Utilidades HTTP comunes: errores seguros, rate limiting y cabeceras de seguridad.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; this.expose = true }
}

// Rate limit en memoria por IP (por instancia). Para algo más estricto, usar Upstash/Redis.
const hits = new Map()
function limited(req, limit, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim()
  const key = `${ip}:${req.url?.split('?')[0]}`
  const now = Date.now()
  const h = hits.get(key) || { n: 0, t: now }
  if (now - h.t > windowMs) { h.n = 0; h.t = now }
  h.n++
  hits.set(key, h)
  if (hits.size > 5000) hits.clear()
  return h.n > limit
}

export function handler(fn, { methods = ['GET'], limit = 60, windowMs = 60_000 } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'Método no permitido')
      if (limited(req, limit, windowMs)) throw new HttpError(429, 'Demasiadas solicitudes, espera un momento')
      await fn(req, res)
    } catch (e) {
      // Nunca se registran cuerpos de petición (podrían traer contraseñas)
      console.error(`[api] ${req.method} ${req.url?.split('?')[0]} → ${e.status || 500}: ${String(e.message).slice(0, 160)}`)
      if (!res.headersSent) res.status(e.status || 500).json({ error: e.expose ? e.message : 'Error interno del servidor' })
    }
  }
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body
  try { return JSON.parse(req.body || '{}') } catch { throw new HttpError(400, 'JSON inválido') }
}

export function str(v, name, { max = 500, required = true } = {}) {
  if (v == null || v === '') { if (required) throw new HttpError(400, `Falta ${name}`); return '' }
  if (typeof v !== 'string' || v.length > max) throw new HttpError(400, `${name} no es válido`)
  return v.trim()
}

export function httpsUrl(v, name) {
  const s = str(v, name, { max: 2000 })
  let u
  try { u = new URL(s) } catch { throw new HttpError(400, `${name} no es una URL válida`) }
  if (u.protocol !== 'https:') throw new HttpError(400, `${name} debe empezar por https://`)
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) || u.hostname.endsWith('.internal')) throw new HttpError(400, `${name} no está permitida`)
  return u
}
