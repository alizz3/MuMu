// Cifrado AES-256-GCM para tokens guardados en Firestore y firmas HMAC para el "state" de OAuth.
// TOKEN_ENC_KEY: 32 bytes en base64 (genera uno con: openssl rand -base64 32)
import crypto from 'node:crypto'
import { HttpError } from './http.js'

function key() {
  const k = Buffer.from(process.env.TOKEN_ENC_KEY || '', 'base64')
  if (k.length !== 32) throw new HttpError(503, 'El servidor no tiene TOKEN_ENC_KEY válida (32 bytes en base64)')
  return k
}

export function encrypt(value) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()])
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${data.toString('base64url')}`
}

export function decrypt(payload) {
  const [v, iv, tag, data] = String(payload).split('.')
  if (v !== 'v1') throw new Error('Formato de cifrado desconocido')
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8'))
}

export function sign(obj) {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url')
  const s = crypto.createHmac('sha256', key()).update(p).digest('base64url')
  return `${p}.${s}`
}
export function verify(token) {
  const [p, s] = String(token || '').split('.')
  const exp = crypto.createHmac('sha256', key()).update(p || '').digest('base64url')
  if (!s || s.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) throw new HttpError(400, 'Solicitud inválida (state)')
  const obj = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  if (obj.exp && Date.now() > obj.exp) throw new HttpError(400, 'La solicitud expiró, inténtalo de nuevo')
  return obj
}

export const hash = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16)
export const randomId = (n = 9) => crypto.randomBytes(n).toString('base64url')
