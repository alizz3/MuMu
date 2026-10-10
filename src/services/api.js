// Cliente del backend (/api, funciones serverless en Vercel). El navegador NUNCA ve contraseñas,
// tokens de Google ni claves: solo envía tu token de sesión de Firebase y recibe datos ya procesados.
import { state, ui } from '../store'
import { idToken } from './firebase'
import { applyAcademicChanges, addTask, subjectByName } from '../store/actions'
import { toast } from '../engine/game'
import { dayKey } from '../engine/time'
import { BRAND } from '../config/brand'

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

// Correos de tus profes actuales (sacados de tus materias) → siempre importantes
export function profesMap() {
  const m = {}
  for (const sj of state.subjects) for (const em of String(sj.teacherEmail || '').toLowerCase().split(/[,;\s]+/).filter(Boolean)) m[em] = sj
  return m
}

export async function syncGmail() {
  const accs = state.integrations.google.filter((a) => a.services.includes('gmail'))
  state.emails = state.emails.filter((e) => !e.demo) // al conectar lo real, se van los ejemplos
  const profes = profesMap()
  const pref = state.settings.mail || {}
  let n = 0
  for (const a of accs) {
    const { emails } = await call(`gmail/inbox?account=${a.id}`)
    const toStar = []
    for (const e of emails) {
      const sj = profes[e.fromEmail]
      if (sj) { e.category = 'importante'; e.profe = sj.teacher || sj.short || sj.name; e.subjectId = sj.id }
      const ex = state.emails.find((x) => x.id === e.id)
      if (ex) Object.assign(ex, { category: ex.manualCategory ? ex.category : e.category, snippet: e.snippet, profe: e.profe, subjectId: e.subjectId, accountId: a.id, fromEmail: e.fromEmail })
      else { state.emails.unshift({ ...e, account: a.label, accountId: a.id, status: 'nuevo' }); n++ }
      if (sj && !e.labels?.includes('STARRED')) toStar.push(e.id)
    }
    // Marcar en tu Gmail real los correos de profes (si diste el permiso de organizar)
    if (toStar.length && a.services.includes('gmail-organize')) {
      if (pref.starProfes !== false) await call('gmail/action', { method: 'POST', body: { account: a.id, ids: toStar, action: 'star' } }).catch(() => {})
      if (pref.labelProfes !== false) await call('gmail/action', { method: 'POST', body: { account: a.id, ids: toStar, action: 'label', label: 'MuMu/Profes' } }).catch(() => {})
    }
  }
  state.emails = state.emails.slice(0, 250)
  toast(n ? `${n} correos nuevos clasificados` : 'Correo al día')
}

export const canOrganize = (accountId) => !!state.integrations.google.find((a) => a.id === accountId)?.services.includes('gmail-organize')

// Acción sobre varios correos: agrupa por cuenta y llama al servidor
export async function gmailAction(emails, action, label) {
  const by = {}
  for (const e of emails) if (e.accountId && canOrganize(e.accountId)) (by[e.accountId] = by[e.accountId] || []).push(e.id)
  const skipped = emails.length - Object.values(by).flat().length
  let done = 0
  for (const [account, ids] of Object.entries(by)) for (let i = 0; i < ids.length; i += 100) {
    const r = await call('gmail/action', { method: 'POST', body: { account, ids: ids.slice(i, i + 100), action, label } }); done += r.count
  }
  return { done, skipped }
}

// Calendarios que MuMu lee por cuenta (por defecto, el principal)
export const calendarsOf = (accountId) => state.integrations.calendars?.[accountId] || ['primary']
export function setCalendars(accountId, ids) { state.integrations.calendars = { ...(state.integrations.calendars || {}), [accountId]: [...new Set(ids)] } }
export async function listCalendars(accountId) { return (await call(`calendar/events?account=${accountId}&list=1`)).calendars }
// Enlace de Google Calendar (…?cid=XXXX) → id del calendario
export function calendarIdFromLink(text) {
  const t = String(text || '').trim()
  try {
    const u = new URL(t)
    const cid = u.searchParams.get('cid') || u.searchParams.get('src')
    if (cid) { if (cid.includes('@')) return cid; const b = cid.replace(/-/g, '+').replace(/_/g, '/'); return atob(b + '='.repeat((4 - (b.length % 4)) % 4)) }
  } catch { /* no es un enlace */ }
  return /@/.test(t) ? t : null
}

const normT = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^(vence|entrega|tarea|due)[:\s-]*/i, '').replace(/\s*(vence|is due|fecha de entrega)\s*$/i, '').replace(/[^a-z0-9]+/g, ' ').trim()

export async function syncCalendar() {
  const accs = state.integrations.google.filter((a) => a.services.includes('calendar'))
  // Lo que ya es tarea (de Tu Aula, Classroom o tuya) no se repite como evento
  const taskKeys = new Set(state.tasks.filter((t) => t.due).map((t) => `${normT(t.title)}|${t.due}`))
  const seen = new Set()
  let skipped = 0
  for (const a of accs) {
    const { events, warnings = [] } = await call(`calendar/events?account=${a.id}&days=21&calendars=${encodeURIComponent(calendarsOf(a.id).join(','))}`)
    warnings.forEach((w) => toast(w))
    state.events = state.events.filter((e) => e.source !== `google:${a.id}`)
    for (const e of events) {
      const key = `${normT(e.title)}|${e.date}`
      const dupTask = [...taskKeys].some((k) => { const [tt, d] = k.split('|'); return d === e.date && tt && (tt === normT(e.title) || normT(e.title).includes(tt) || tt.includes(normT(e.title))) })
      if (seen.has(`${key}|${e.start}`) || dupTask || state.events.some((x) => x.source?.startsWith('google:') && `${normT(x.title)}|${x.date}|${x.start}` === `${key}|${e.start}`)) { skipped++; continue }
      seen.add(`${key}|${e.start}`)
      state.events.push({ ...e, source: `google:${a.id}`, account: a.label, readonly: true })
    }
  }
  toast(`Calendario sincronizado${skipped ? ` · ${skipped} repetidos omitidos` : ''}`)
}
export async function createCalendarBlock(accountId, ev) { return call('calendar/events', { method: 'POST', body: { account: accountId, ...ev } }) }

export async function syncClassroom() {
  const accs = state.integrations.google.filter((a) => a.services.includes('classroom'))
  let created = 0, updated = 0
  for (const a of accs) {
    const { items, courses, warnings = [] } = await call(`classroom/coursework?account=${a.id}`)
    // authuser hace que el enlace abra con la cuenta correcta (no con la personal)
    const withAcc = items.map((it) => (it.url && a.email ? { ...it, url: it.url + (it.url.includes('?') ? '&' : '?') + 'authuser=' + encodeURIComponent(a.email) } : it))
    const r = applyAcademicChanges(withAcc, 'classroom'); created += r.created; updated += r.updated
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
  toast(`Tu Aula conectada (${r.method === 'webservice' ? 'servicio web de Moodle' : 'calendario iCal'})`)
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

// Estado de Tu Aula (en línea / caída). Se guarda 5 minutos para no revisar a cada rato.
export async function aulaStatus(force = false) {
  const c = ui.aulaStatus
  if (!force && c && Date.now() - c.checkedAt < 5 * 60e3) return c
  ui.aulaStatus = { checking: true, checkedAt: Date.now() }
  try {
    const site = state.integrations.aula.site || BRAND.aulaSite
    ui.aulaStatus = await call(`aula/status?site=${encodeURIComponent(site)}`)
  } catch (e) { ui.aulaStatus = { error: e.message, checkedAt: Date.now() } }
  return ui.aulaStatus
}

// ---------- Google Tasks ----------
// Cada cuenta tiene un papel: "universidad" (tu cuenta de la UT) o "personal". Las tareas de la U se crean en la
// lista de su materia en la cuenta de la U; las personales, en tu cuenta personal.
const isUniAcc = (a) => /ut\.edu\.co$/i.test(a.email || '') || /univ/i.test(a.label || '')
export const gtAccounts = () => state.integrations.google.filter((a) => a.services.includes('tasks'))
export function gtConf(a) {
  state.integrations.gtasks ||= {}
  return (state.integrations.gtasks[a.id] ||= { role: isUniAcc(a) ? 'universidad' : 'personal', lists: [], defaultList: '@default' })
}
const sameTitle = (a, b) => { const x = normT(a), y = normT(b); return !!x && !!y && (x === y || (Math.min(x.length, y.length) > 10 && (x.includes(y) || y.includes(x)))) }
const isUni = (t) => t.category === 'universidad' || !!t.subjectId || state.projects.find((p) => p.id === t.projectId)?.area === 'universidad'
const accFor = (t) => { const accs = gtAccounts()
  if (isUni(t)) { const u = accs.find((a) => gtConf(a).role === 'universidad'); if (u) return u }
  if (t.projectId) { const p = state.projects.find((x) => x.id === t.projectId); const hit = p && accs.find((a) => (gtConf(a).lists || []).some((l) => normT(l.title) === normT(p.name))); if (hit) return hit }
  const want = t.category === 'universidad' || t.subjectId ? 'universidad' : 'personal'; return accs.find((a) => gtConf(a).role === want) || null }
function listFor(a, t) {
  const c = gtConf(a)
  if (t.subjectId) { const s = state.subjects.find((x) => x.id === t.subjectId); const l = s && c.lists.find((l) => subjectByName(l.title)?.id === s.id); if (l) return l.id }
  if (t.projectId) { const p = state.projects.find((x) => x.id === t.projectId); const l = p && c.lists.find((l) => normT(l.title) === normT(p.name)); if (l) return l.id }
  return c.defaultList || '@default'
}
// Huella de lo editable: si cambia en MuMu, se manda a Google
const ownNotes = (t) => t.source === 'gtasks' || t.source === 'manual'
const gsig = (t) => `${t.title}|${t.due || ''}|${ownNotes(t) ? t.notes || '' : ''}`
let gtBusy = false
export async function syncGTasks({ quiet = false } = {}) {
  const accs = gtAccounts(); if (!accs.length || gtBusy) return
  gtBusy = true
  let nuevas = 0, unidas = 0, hechas = 0, borradas = 0
  try {
    state.integrations.gtasksSince ||= dayKey()
    for (const a of accs) {
      const conf = gtConf(a)
      const { lists } = await call(`gtasks/sync?account=${a.id}`)
      conf.lists = lists.map((l) => ({ id: l.id, title: l.title }))
      const seen = new Set()
      const gone = new Set((state.integrations.gtDeleted || []).map((x) => x.id))
      for (const l of lists) {
        const subj = conf.role === 'universidad' ? subjectByName(l.title) : null
        // Una lista con el mismo nombre de un proyecto (ej. "Colaxis") se une con ese proyecto
        const proj = state.projects.find((p) => normT(p.name) && normT(p.name) === normT(l.title)) || null
        const hab = state.habits.find((h) => normT(listTitle(h)) === normT(l.title)) || null
        for (const g of l.tasks) {
          if (g.parent || gone.has(g.id)) continue
          seen.add(g.id)
          let t = state.tasks.find((x) => x.gtask?.id === g.id)
          if (!t) {
            // Si ya existe (por ejemplo vino de Classroom o Tu Aula), se une en vez de duplicar
            t = state.tasks.find((x) => !x.gtask && x.status !== 'cancelada' && sameTitle(x.title, g.title) && (!subj || !x.subjectId || x.subjectId === subj.id) && (!proj || !x.projectId || x.projectId === proj.id))
            if (t) {
              // Al unirlas, si está hecha en cualquiera de los dos lados, queda hecha en ambos
              t.gtask = { acc: a.id, list: l.id, id: g.id, done: g.done, updated: g.updated, sig: gsig(t) }
              if (g.done && t.status !== 'completada') { t.status = 'completada'; t.completedAt = (g.completed || '').slice(0, 10) || dayKey() }
              unidas++
            }
            else if (!g.done) {
              t = addTask({ title: g.title, notes: g.notes, due: g.due, url: g.url, source: 'gtasks', category: proj ? 'trabajo' : conf.role === 'universidad' ? 'universidad' : 'personal', projectId: proj?.id || null, subjectId: subj?.id || null, goalId: subj ? 'g1' : null, estimate: 30, gtask: { acc: a.id, list: l.id, id: g.id, done: false, updated: g.updated } }, { quiet: true })
              t.gtask.sig = gsig(t)
              nuevas++
            } else continue
          }
          if (proj && !t.projectId) { t.projectId = proj.id; if (t.category === 'personal') t.category = 'trabajo' }
          if (hab && !t.habitId && !t.projectId) { t.habitId = hab.id; t.category = 'vida' }
          const mumuDone = t.status === 'completada'
          if (g.done !== t.gtask.done) {
            // Cambió en Google: manda Google
            if (g.done && !mumuDone) { t.status = 'completada'; t.completedAt = (g.completed || '').slice(0, 10) || dayKey(); hechas++ }
            if (!g.done && mumuDone) { t.status = 'pendiente'; t.completedAt = null }
            t.gtask.done = g.done
          } else if (mumuDone !== g.done) {
            // Cambió en MuMu: se lleva a Google
            await call('gtasks/sync', { method: 'PATCH', body: { account: a.id, list: l.id, id: g.id, done: mumuDone } }).then(() => { t.gtask.done = mumuDone }).catch(() => {})
          }
          if (g.updated && g.updated !== t.gtask.updated) {
            // Lo editaste en Google: manda Google
            if (t.gtask.updated) { if (g.title && g.title !== t.title) t.title = g.title; if (g.due !== undefined && g.due !== t.due && !(t.source === 'aula' || t.source === 'classroom')) t.due = g.due; if (g.notes !== (t.notes || '') && t.source === 'gtasks') t.notes = g.notes }
            t.gtask.updated = g.updated
            t.gtask.sig = gsig(t)
          } else if (t.gtask.sig && t.gtask.sig !== gsig(t)) {
            // Lo editaste en MuMu: se lleva a Google
            await call('gtasks/sync', { method: 'PATCH', body: { account: a.id, list: l.id, id: g.id, title: t.title, due: t.due || null, notes: ownNotes(t) ? t.notes || '' : undefined } }).then((r) => { t.gtask.updated = r.task.updated; t.gtask.sig = gsig(t) }).catch(() => {})
          } else if (!t.gtask.sig) t.gtask.sig = gsig(t)
          if (g.url && !t.url) t.url = g.url
        }
      }
      // Pendientes que borraste en Google Tasks: también se borran de MuMu
      const goneIds = new Set(state.tasks.filter((x) => x.gtask?.acc === a.id && x.status !== 'completada' && !seen.has(x.gtask.id)).map((x) => x.id))
      if (goneIds.size) { state.tasks = state.tasks.filter((x) => !goneIds.has(x.id)); borradas += goneIds.size }
    }
    await pushNewGTasks(true)
    if (!quiet || nuevas || hechas || borradas) toast(`Google Tasks: ${nuevas} nuevas${unidas ? `, ${unidas} unidas sin duplicar` : ''}${hechas ? `, ${hechas} hechas` : ''}${borradas ? `, ${borradas} borradas` : ''}`)
    state.integrations.gtasksLast = new Date().toISOString()
  } finally { gtBusy = false }
}
// Lo que creas en MuMu (desde que conectaste Google Tasks) se crea también allá, en la cuenta y lista que toca
let pushing = false
export async function pushNewGTasks(inner = false) {
  if (pushing || (gtBusy && !inner)) return
  pushing = true
  try { await doPush() } finally { pushing = false }
}
// Cada proyecto tiene su propia lista en Google Tasks (se crea sola la primera vez)
// Lista propia de un proyecto o de un hábito (el hábito puede tener otro nombre de lista, ej. "Ejercicio")
const ownerOf = (t) => (t.habitId && state.habits.find((x) => x.id === t.habitId)) || (t.projectId && state.projects.find((x) => x.id === t.projectId)) || null
const listTitle = (o) => o.gtList || o.name
async function projectList(a, p) {
  const c = gtConf(a)
  const hit = (c.lists || []).find((l) => normT(l.title) === normT(listTitle(p)))
  if (hit) return hit.id
  const r = await call('gtasks/sync', { method: 'POST', body: { op: 'createList', account: a.id, title: listTitle(p) } })
  c.lists = [...(c.lists || []), r.list]
  return r.list.id
}
async function doPush() {
  // Lo de la U va en la cuenta de la U (Google no mueve entre cuentas: se crea allá y se borra acá)
  for (const t of state.tasks.filter((x) => x.gtask && isUni(x))) {
    const want = accFor(t); if (!want || want.id === t.gtask.acc) continue
    try {
      const proj = t.projectId && state.projects.find((x) => x.id === t.projectId)
      const list = proj ? await projectList(want, proj) : listFor(want, t)
      const r = await call('gtasks/sync', { method: 'POST', body: { account: want.id, list, title: t.title, notes: t.notes || '', due: t.due || '' } })
      await call('gtasks/sync', { method: 'POST', body: { op: 'delete', account: t.gtask.acc, list: t.gtask.list, id: t.gtask.id } }).catch(() => {})
      t.gtask = { acc: want.id, list: r.list, id: r.task.id, done: false, updated: r.task.updated, sig: gsig(t) }
    } catch { /* luego */ }
  }
  for (const d of [...(state.integrations.gtDeleted || [])]) {
    try { await call('gtasks/sync', { method: 'POST', body: { op: 'delete', account: d.acc, list: d.list, id: d.id } }); state.integrations.gtDeleted = state.integrations.gtDeleted.filter((x) => x.id !== d.id) } catch { /* luego */ }
  }
  const since = state.integrations.gtasksSince; if (!since) return
  for (const t of state.tasks.filter((x) => !x.gtask && !x.demo && x.source === 'manual' && x.status !== 'cancelada' && x.status !== 'completada' && (x.createdAt || '') >= since)) {
    const a = accFor(t); if (!a) continue
    const proj = ownerOf(t)
    const list = proj ? await projectList(a, proj).catch(() => listFor(a, t)) : listFor(a, t)
    try {
      const r = await call('gtasks/sync', { method: 'POST', body: { account: a.id, list, title: t.title, notes: t.notes || '', due: t.due || '' } })
      // Si la borraste mientras se creaba en Google, también se borra allá
      if (!state.tasks.some((x) => x.id === t.id)) { await call('gtasks/sync', { method: 'POST', body: { op: 'delete', account: a.id, list: r.list, id: r.task.id } }).catch(() => {}); continue }
      const live = state.tasks.find((x) => x.id === t.id)
      live.gtask = { acc: a.id, list: r.list, id: r.task.id, done: false, updated: r.task.updated, sig: gsig(live) }
      if (r.task.url && !live.url) live.url = r.task.url
    } catch { /* se reintenta en la próxima sincronización */ }
  }
  // Editadas en MuMu (título, fecha, notas)
  for (const t of state.tasks.filter((x) => x.gtask?.sig && x.gtask.sig !== gsig(x))) {
    try { const r = await call('gtasks/sync', { method: 'PATCH', body: { account: t.gtask.acc, list: t.gtask.list, id: t.gtask.id, title: t.title, due: t.due || null, notes: ownNotes(t) ? t.notes || '' : undefined } }); t.gtask.updated = r.task.updated; t.gtask.sig = gsig(t) } catch { /* luego */ }
  }
  // Tareas que pasaste a un proyecto: se mueven a la lista de ese proyecto (misma cuenta)
  for (const t of state.tasks.filter((x) => x.gtask && (x.projectId || x.habitId) && x.source !== 'aula' && x.source !== 'classroom')) {
    const p = ownerOf(t); const a = gtAccounts().find((x) => x.id === t.gtask.acc)
    if (!p || !a || accFor(t)?.id !== a.id) continue
    try {
      const to = await projectList(a, p)
      if (to !== t.gtask.list) { const r = await call('gtasks/sync', { method: 'POST', body: { op: 'move', account: a.id, list: t.gtask.list, id: t.gtask.id, to } }); t.gtask.list = to; t.gtask.updated = r.task.updated }
    } catch { /* luego */ }
  }
  // Completadas en MuMu que Google aún no sabe
  for (const t of state.tasks.filter((x) => x.gtask && (x.status === 'completada') !== x.gtask.done)) {
    try { await call('gtasks/sync', { method: 'PATCH', body: { account: t.gtask.acc, list: t.gtask.list, id: t.gtask.id, done: t.status === 'completada' } }); t.gtask.done = t.status === 'completada' } catch { /* luego */ }
  }
}

// ---------- Google Drive (solo lectura) ----------
export const folderIdFrom = (s) => (String(s || '').match(/folders\/([\w-]{10,100})/) || String(s || '').match(/[?&]id=([\w-]{10,100})/) || [])[1] || (/^[\w-]{20,100}$/.test(String(s || '').trim()) ? String(s).trim() : null)
export function driveAccount() {
  const accs = state.integrations.google.filter((a) => a.services.includes('drive'))
  return accs.find((a) => /ut\.edu\.co$/i.test(a.email || '')) || accs[0] || null
}
// Carpeta del semestre y de cada materia: la que pegaste como enlace o la que MuMu encontró sola
export const semesterFolder = () => state.settings.semesterDrive || (state.settings.semesterLinks || []).map((l) => folderIdFrom(l.url)).find(Boolean) || null
export const subjectFolder = (s) => s && (s.driveFolder || (s.links || []).map((l) => folderIdFrom(l.url)).find(Boolean) || null)
export async function listDrive(folder) {
  const a = driveAccount(); if (!a) throw new Error('Dale a una cuenta el permiso "Google Drive" en Configuración → Cuentas.')
  return call(`drive/list?account=${a.id}&folder=${encodeURIComponent(folder)}`)
}
// Dentro de la carpeta del semestre, cada subcarpeta ("2. Elementos de Programación…") se une con su materia
export async function linkSubjectFolders() {
  const root = semesterFolder(); if (!root || !driveAccount()) return 0
  const { items } = await listDrive(root)
  let n = 0
  for (const f of items.filter((x) => x.folder)) {
    const s = subjectByName(f.name)
    if (s && !s.driveFolder) { s.driveFolder = f.id; n++ }
  }
  return n
}

// Enlaza la app de Android (token para que lea alarmas, recordatorios y el widget sin abrir MuMu)
export const linkDevice = () => call('device/link', { method: 'POST' })
