// Cliente del backend (/api, funciones serverless en Vercel). El navegador NUNCA ve contraseñas,
// tokens de Google ni claves: solo envía tu token de sesión de Firebase y recibe datos ya procesados.
import { state, ui } from '../store'
import { idToken } from './firebase'
import { applyAcademicChanges } from '../store/actions'
import { toast } from '../engine/game'
import { dayKey } from '../engine/time'

async function call(path, { method = 'GET', body } = {}) {
  const token = await idToken()
  if (!token) throw new Error('Primero inicia sesión con Google en Configuración → Cuentas.')
  const r = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`)
  return j
}

export const canUseBackend = () => ui.backend && !!ui.user

export async function connectGoogle(label, services, email) {
  const { url } = await call('google/start', { method: 'POST', body: { label, services, email } })
  window.location.href = url
}
export async function refreshAccounts() {
  const { accounts } = await call('google/accounts')
  state.integrations.google = accounts
  return accounts
}
export async function disconnectGoogle(id) {
  await call(`google/accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  await refreshAccounts()
  toast('Cuenta desconectada y permisos revocados')
}

export async function syncGmail() {
  const accs = state.integrations.google.filter((a) => a.services.includes('gmail'))
  state.emails = state.emails.filter((e) => !e.demo) // al conectar lo real, se van los ejemplos
  let n = 0
  for (const a of accs) {
    const { emails } = await call(`gmail/inbox?account=${a.id}`)
    for (const e of emails) {
      const ex = state.emails.find((x) => x.id === e.id)
      if (ex) Object.assign(ex, { category: ex.manualCategory ? ex.category : e.category, snippet: e.snippet })
      else { state.emails.unshift({ ...e, account: a.label, status: 'nuevo' }); n++ }
    }
  }
  toast(n ? `${n} correos nuevos clasificados 📧` : 'Correo al día ✨')
}

export async function syncCalendar() {
  const accs = state.integrations.google.filter((a) => a.services.includes('calendar'))
  for (const a of accs) {
    const { events } = await call(`calendar/events?account=${a.id}&days=21`)
    state.events = state.events.filter((e) => e.source !== `google:${a.id}`)
    state.events.push(...events.map((e) => ({ ...e, source: `google:${a.id}`, account: a.label, readonly: true })))
  }
  toast('Calendario sincronizado 🗓️')
}
export async function createCalendarBlock(accountId, ev) { return call('calendar/events', { method: 'POST', body: { account: accountId, ...ev } }) }

export async function syncClassroom() {
  const accs = state.integrations.google.filter((a) => a.services.includes('classroom'))
  let created = 0, updated = 0
  for (const a of accs) {
    const { items, courses, warnings = [] } = await call(`classroom/coursework?account=${a.id}`)
    const r = applyAcademicChanges(items, 'classroom'); created += r.created; updated += r.updated
    warnings.forEach((w) => toast(w))
    if (!courses) toast(`No encontré cursos activos en ${a.email}`)
  }
  state.integrations.classroom = { status: 'conectado', lastSync: new Date().toISOString() }
  toast(`Classroom: ${created} nuevas, ${updated} actualizadas`)
}

export async function connectAula(payload) {
  const r = await call('aula/connect', { method: 'POST', body: payload })
  state.aula = state.aula.filter((a) => !a.demo)
  state.tasks = state.tasks.filter((t) => !(t.demo && t.source === 'aula' && t.status !== 'completada'))
  state.integrations.aula = { ...state.integrations.aula, status: 'conectado', method: r.method, site: payload.site, siteName: r.siteName, lastSync: null }
  toast(`Tu Aula conectada (${r.method === 'webservice' ? 'servicio web de Moodle' : 'calendario iCal'}) 🎓`)
  return r
}
export async function syncAula() {
  const r = await call('aula/sync', { method: 'POST' })
  const res = applyAcademicChanges(r.items, 'aula')
  state.integrations.aula.lastSync = new Date().toISOString()
  state.daily[dayKey()] = { ...(state.daily[dayKey()] || {}), reviewed: true }
  toast(`Tu Aula: ${res.created} nuevas, ${res.updated} con cambios`)
  return res
}
export async function disconnectAula() { await call('aula/connect', { method: 'DELETE' }); state.integrations.aula = { status: 'no-conectado', method: null, lastSync: null, site: state.integrations.aula.site } }

export async function askAssistant(message, context) { return call('assistant', { method: 'POST', body: { message, context } }) }
export async function financeSummary() { return call('finance/summary') }
