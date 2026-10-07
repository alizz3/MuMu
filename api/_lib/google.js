// OAuth de Google con scopes mínimos + helpers para las APIs oficiales (Gmail, Calendar, Classroom).
import { HttpError } from './http.js'
import { encrypt, decrypt } from './crypto.js'
import { secrets } from './firebase.js'

export const SERVICE_SCOPES = {
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  calendar: ['https://www.googleapis.com/auth/calendar.readonly'],
  'calendar-write': ['https://www.googleapis.com/auth/calendar.events'],
  classroom: ['https://www.googleapis.com/auth/classroom.courses.readonly', 'https://www.googleapis.com/auth/classroom.coursework.me.readonly'],
}

const cfg = () => {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, APP_URL: app } = process.env
  if (!id || !secret || !app) throw new HttpError(503, 'Falta configurar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o APP_URL en el servidor')
  return { id, secret, app, redirect: `${app.replace(/\/$/, '')}/api/google/callback` }
}

export function authUrl(state, services, loginHint) {
  const c = cfg()
  const scopes = ['openid', 'email', ...new Set(services.flatMap((s) => SERVICE_SCOPES[s] || []))]
  const p = new URLSearchParams({ client_id: c.id, redirect_uri: c.redirect, response_type: 'code', scope: scopes.join(' '), access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state })
  if (loginHint) p.set('login_hint', loginHint)
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function tokenRequest(params) {
  const c = cfg()
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...params }) })
  const j = await r.json()
  if (!r.ok) throw new HttpError(400, `Google rechazó la autorización (${j.error || r.status})`)
  return j
}
export const exchangeCode = (code) => tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: cfg().redirect })

export async function userEmail(accessToken) {
  const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
  const j = await r.json()
  return j.email
}

export const accountsRef = (uid) => secrets(uid).collection('google')

// Devuelve un access token válido para la cuenta (lo renueva si venció)
export async function accessToken(uid, accountId, needService) {
  const ref = accountsRef(uid).doc(accountId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'Cuenta de Google no encontrada')
  const a = snap.data()
  if (needService && !a.services.includes(needService)) throw new HttpError(403, `Esta cuenta no tiene permiso de ${needService}. Reconéctala marcando ese permiso.`)
  const tok = decrypt(a.tokens)
  if (tok.access_token && tok.expiry > Date.now() + 60_000) return { token: tok.access_token, account: a }
  const fresh = await tokenRequest({ refresh_token: tok.refresh_token, grant_type: 'refresh_token' })
  const next = { ...tok, access_token: fresh.access_token, expiry: Date.now() + fresh.expires_in * 1000 }
  await ref.update({ tokens: encrypt(next) })
  return { token: next.access_token, account: a }
}

export async function gget(token, url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new HttpError(r.status === 403 ? 403 : 502, `Google respondió ${r.status}: ${j.error?.message || 'sin detalle'}`)
  }
  return r.json()
}

export async function revoke(uid, accountId) {
  const ref = accountsRef(uid).doc(accountId)
  const snap = await ref.get()
  if (!snap.exists) return
  try { const t = decrypt(snap.data().tokens); await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token || t.access_token)}`, { method: 'POST' }) } catch { /* ya revocado */ }
  await ref.delete()
}

// Fechas en la zona horaria del usuario
export const TZ = process.env.APP_TIMEZONE || 'America/Bogota'
export function localParts(date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

// Qué servicios quedaron realmente autorizados, según los scopes que Google devolvió
export function servicesFromScopes(granted) {
  const g = new Set(granted)
  return Object.entries(SERVICE_SCOPES).filter(([, scopes]) => scopes.every((x) => g.has(x))).map(([k]) => k)
}
