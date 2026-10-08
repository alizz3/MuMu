// Todas las acciones que cambian datos pasan por aquí para que los módulos queden conectados:
// tarea → objetivo → recompensa → vaquita → analítica → experimentos.
import { state, ui } from './index'
import { dayKey, uid, keyPlus, daysUntil, nowMin, toHM } from '../engine/time'
import { award, toast, daily } from '../engine/game'
import { planTask } from '../engine/planner'

export function go(route, params = {}) {
  if (ui.route !== route || JSON.stringify(params) !== JSON.stringify(ui.params)) ui.history.push({ route: ui.route, params: ui.params })
  ui.route = route; ui.params = params; ui.drawer = false
  try { history.replaceState(null, '', `#/${route}${params.id ? '/' + params.id : ''}`) } catch { /* vista previa */ }
  window.scrollTo?.({ top: 0, behavior: 'smooth' })
}
export function back() { const h = ui.history.pop(); if (h) { ui.route = h.route; ui.params = h.params } else ui.route = 'home' }

// ---------- Tareas ----------
export function addTask(data) {
  const t = { id: uid('t'), status: 'pendiente', priority: 'media', tags: [], subtasks: [], notes: '', postponed: 0, createdAt: dayKey(), source: 'manual', estimate: 30, category: 'personal', due: null, ...data }
  state.tasks.unshift(t)
  toast('Tarea creada 📝')
  return t
}
export function updateTask(id, patch) { const t = state.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); return t }
export function deleteTask(id) { state.tasks = state.tasks.filter((t) => t.id !== id) }

export function completeTask(id) {
  const t = state.tasks.find((x) => x.id === id)
  if (!t || t.status === 'completada') return
  t.status = 'completada'; t.completedAt = dayKey()
  const coins = 5 + Math.round((t.estimate || 30) / 10) + (t.priority === 'alta' ? 5 : 0)
  award(coins, coins * 2, `Completaste "${t.title}"`)
  const p = state.projects.find((x) => x.id === t.projectId)
  if (p && projectProgress(p) === 100 && p.status !== 'completado') {
    p.status = 'completado'
    award(40, 80, `Proyecto completado: ${p.name}`)
    ui.celebrate = { title: '¡Proyecto completado!', text: `${p.name} ✨ Ganaste una decoración sorpresa.`, pose: 'celebrate' }
    giftDecor()
  }
}
export function reopenTask(id) { const t = state.tasks.find((x) => x.id === id); if (t) { t.status = 'pendiente'; t.completedAt = null } }

export function postponeTask(id, days = 1) {
  const t = state.tasks.find((x) => x.id === id)
  if (!t) return
  t.postponed = (t.postponed || 0) + 1
  if (t.due && daysUntil(t.due) < days) t.due = keyPlus(days)
  toast(t.postponed >= 2 ? 'Pospuesta. La próxima vez probamos 5 minuticos 💗' : 'Pospuesta, sin culpa 🤍')
}

export function toggleSubtask(taskId, subId) {
  const t = state.tasks.find((x) => x.id === taskId)
  const s = t?.subtasks.find((x) => x.id === subId)
  if (!s) return
  s.done = !s.done
  if (s.done) { daily().subtaskDone = true; award(2, 4, 'Un pasito más') }
}
export function addSubtask(taskId, title) { const t = state.tasks.find((x) => x.id === taskId); t?.subtasks.push({ id: uid('st'), title, done: false }) }

export function scheduleTask(id) {
  const t = state.tasks.find((x) => x.id === id)
  if (!t) return []
  const plan = planTask(t)
  t.blocks = plan.map((b) => ({ ...b, done: false }))
  toast(plan.length ? `Agendé ${plan.length} bloques para "${t.title}" 🗓️` : 'No encontré bloques libres antes de la fecha 😥')
  return plan
}

export function intendTask(id) { const t = state.tasks.find((x) => x.id === id); if (t) { t.intendedAt = Date.now(); t.intendNotified = false } }

export function projectProgress(p) {
  const ts = state.tasks.filter((t) => t.projectId === p.id && t.status !== 'cancelada')
  if (!ts.length) return p.status === 'completado' ? 100 : 0
  return Math.round((ts.filter((t) => t.status === 'completada').length / ts.length) * 100)
}

export function goalProgress(g) {
  const parts = []
  const ts = state.tasks.filter((t) => t.goalId === g.id && t.status !== 'cancelada')
  if (ts.length) parts.push(ts.filter((t) => t.status === 'completada').length / ts.length)
  const ps = state.projects.filter((p) => p.goalId === g.id)
  ps.forEach((p) => parts.push(projectProgress(p) / 100))
  const hs = state.habits.filter((h) => h.goalId === g.id)
  hs.forEach((h) => { let d = 0; for (let i = 0; i < 14; i++) if (state.habitLogs[h.id]?.[keyPlus(-i)]?.done) d++; parts.push(d / 14) })
  const cs = state.courses.filter((c) => c.goalId === g.id)
  cs.forEach((c) => parts.push(c.progress / 100))
  const auto = parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 0
  return g.manual ? g.progress : Math.max(auto, g.progress || 0)
}

// ---------- Hábitos ----------
export function toggleHabit(hid, k = dayKey(), note) {
  const log = (state.habitLogs[hid] = state.habitLogs[hid] || {})
  if (log[k]?.done) { delete log[k]; return }
  log[k] = { done: true, note: note || '', at: toHM(nowMin()) }
  const h = state.habits.find((x) => x.id === hid)
  award(4, 8, `${h?.emoji || '✔️'} ${h?.name || 'Hábito'}`)
}

// ---------- Enfoque ----------
export function startFocus({ taskId = null, minutes = 25, mode = 'pomodoro', step = '' } = {}) {
  const t = state.tasks.find((x) => x.id === taskId)
  ui.focus = { taskId, title: t?.title || step || 'Sesión de enfoque', step, minutes, mode, startedAt: Date.now(), paused: false, elapsed: 0, category: t?.category }
  if (t && t.status === 'pendiente') t.status = 'en progreso'
}

export function endFocus(outcome, feeling = 3, note = '') {
  const f = ui.focus
  if (!f) return
  const mins = Math.max(1, Math.round((f.elapsed + (f.paused ? 0 : Date.now() - f.startedAt)) / 60000))
  const now = new Date()
  state.focus.push({ id: uid('f'), date: dayKey(), hour: now.getHours(), minutes: Math.min(mins, f.minutes * 2), planned: f.minutes, mode: f.mode, taskId: f.taskId, outcome, feeling, note, started: true })
  const t = state.tasks.find((x) => x.id === f.taskId)
  if (t) { t.spent = (t.spent || 0) + mins; t.intendedAt = null }
  // conecta con experimentos activos basados en "empezar pequeño"
  if (f.mode === 'empezar') {
    const x = state.experiments.find((e) => e.status === 'activo' && state.principles.find((p) => p.id === e.principleId)?.tags.includes('empezar'))
    if (x) { x.logs[dayKey()] = { did: true, felt: feeling, note: note || `Empecé "${f.title}" (${mins} min)` } }
  }
  award(Math.max(2, Math.round(mins / 5)), mins, outcome === 'logrado' ? 'Sesión de enfoque ✨' : 'Empezaste, y eso cuenta 💗')
  ui.focus = null
}

// ---------- Sueño, pantalla, intención ----------
export function logSleep(entry) {
  const [bh, bm] = entry.bed.split(':').map(Number), [wh, wm] = entry.wake.split(':').map(Number)
  let minutes = wh * 60 + wm - (bh * 60 + bm); if (minutes <= 0) minutes += 1440
  const date = entry.date || dayKey()
  state.sleep = state.sleep.filter((s) => s.date !== date)
  state.sleep.unshift({ id: uid('sl'), date, ...entry, minutes })
  award(3, 6, 'Registraste tu sueño 🌙')
}
export function logScreen(entry) {
  const date = entry.date || dayKey()
  state.screen = state.screen.filter((s) => s.date !== date)
  state.screen.unshift({ id: uid('sc'), date, ...entry })
  toast('Tiempo de pantalla guardado 📱')
}
export function addIntention(want, minutes, reason) {
  const i = { id: uid('i'), date: dayKey(), at: toHM(nowMin()), want, minutes, reason, result: null }
  state.intentions.unshift(i)
  return i
}
export function resolveIntention(id, result, endedIn) {
  const i = state.intentions.find((x) => x.id === id)
  if (!i) return
  i.result = result; i.endedIn = endedIn || null
  if (result === 'logrado') award(3, 5, 'Usaste el celular con intención 💗')
  else toast('Gracias por ser honesta. Esto nos ayuda a entender el patrón 🤍')
}

// ---------- Agenda ----------
export function addEvent(e) { const ev = { id: uid('e'), source: 'manual', type: 'evento', ...e }; state.events.push(ev); toast('Agregado a tu agenda 🗓️'); return ev }
export function deleteEvent(id) { state.events = state.events.filter((e) => e.id !== id) }

// ---------- Conocimiento ----------
export function addResource(r) { const x = { id: uid('r'), status: 'pendiente', progress: 0, concepts: [], notes: '', ...r }; state.resources.unshift(x); award(2, 4, 'Nuevo aprendizaje guardado 🧠'); return x }
export function addPrinciple(p) { const x = { id: uid('pr'), status: 'idea', tags: [], ...p }; state.principles.unshift(x); return x }
export function startExperiment(principleId, days = 7, extra = {}) {
  const p = state.principles.find((x) => x.id === principleId)
  const x = { id: uid('x'), title: extra.title || p?.text || 'Experimento', principleId, hypothesis: extra.hypothesis || (p ? `Si aplico "${p.text}", me irá mejor.` : ''), days, start: dayKey(), status: 'activo', logs: {}, result: null, conclusion: '' }
  state.experiments.unshift(x)
  if (p) p.status = 'probando'
  award(5, 10, 'Nuevo experimento 🧪')
  return x
}
export function logExperiment(id, did, felt, note) {
  const x = state.experiments.find((e) => e.id === id)
  if (!x) return
  x.logs[dayKey()] = { did, felt, note }
  award(3, 6, 'Registro de experimento 🧪')
}
export function finishExperiment(id, result, conclusion, difficulty, learnings) {
  const x = state.experiments.find((e) => e.id === id)
  if (!x) return
  Object.assign(x, { status: 'terminado', result, conclusion, difficulty, learnings: learnings.filter(Boolean), end: dayKey() })
  const p = state.principles.find((pp) => pp.id === x.principleId)
  if (p) p.status = result === 'funcionó' ? 'validado' : result === 'no funcionó' ? 'descartado' : 'probando'
  award(20, 40, 'Terminaste un experimento 🧪✨')
  ui.celebrate = { title: 'Aprendiste algo sobre ti', text: 'Se agregó a "Mi propio método" 💗', pose: 'think' }
}

// ---------- Correo / Aula ----------
export function emailToTask(eid) {
  const e = state.emails.find((x) => x.id === eid)
  if (!e) return
  const t = addTask({ title: e.subject, source: 'gmail', category: e.account === 'universidad' ? 'universidad' : 'personal', priority: e.category === 'importante' ? 'alta' : 'media', notes: `De: ${e.from}\n${e.snippet}`, emailId: e.id, demo: e.demo })
  e.status = 'convertido'; e.taskId = t.id
  return t
}
export function emailToEvent(eid, date, start, end) {
  const e = state.emails.find((x) => x.id === eid)
  if (!e) return
  addEvent({ title: e.subject, date, start, end, type: 'evento', emailId: e.id })
  e.status = 'convertido'
}
export function setEmailStatus(eid, status) { const e = state.emails.find((x) => x.id === eid); if (e) e.status = status }

export function aulaToTask(aid) {
  const a = state.aula.find((x) => x.id === aid)
  if (!a || a.taskId) return
  const s = state.subjects.find((x) => x.id === a.courseId)
  const t = addTask({ title: a.title, url: a.url || null, subjectId: a.courseId, category: 'universidad', source: a.source === 'classroom' ? 'classroom' : 'aula', due: a.due, priority: a.due && daysUntil(a.due) <= 3 ? 'alta' : 'media', estimate: a.type === 'quiz' ? 30 : 90, goalId: 'g1', notes: s ? `Materia: ${s.name}` : '', demo: a.demo })
  a.taskId = t.id
  return t
}

// Aplica cambios que trae la sincronización (Aula, Classroom) con la regla:
// nueva → crear pendiente, cambió fecha → actualizar, cambió contenido → marcar cambio.
export function applyAcademicChanges(items, source = 'aula') {
  let created = 0, updated = 0
  for (const it of items) {
    const ex = state.aula.find((a) => a.externalId === it.externalId && a.source === source)
    if (!ex) {
      const subj = state.subjects.find((s) => s.externalId === it.courseExternalId || (s.externalIds || []).includes(it.courseExternalId)) || matchSubject(it.courseName, it.courseExternalId) || ensureSubject(it.courseName, it.courseExternalId, source)
      const a = { id: uid('a'), source, externalId: it.externalId, courseId: subj.id, type: it.type, title: it.title, due: it.due, url: it.url, hash: it.hash, firstSeen: dayKey(), changed: false }
      state.aula.unshift(a)
      if (['assign', 'quiz'].includes(it.type)) aulaToTask(a.id)
      created++
    } else if (it.url && ex.url !== it.url) {
      ex.url = it.url
      const t = state.tasks.find((x) => x.id === ex.taskId); if (t) t.url = it.url
    }
    if (ex && ex.hash !== it.hash) {
      const oldDue = ex.due
      Object.assign(ex, { title: it.title, due: it.due, hash: it.hash, changed: true, notified: false, changeNote: oldDue !== it.due ? `La fecha cambió (antes: ${oldDue || 'sin fecha'})` : 'El contenido cambió' })
      const t = state.tasks.find((x) => x.id === ex.taskId)
      if (t) { t.due = it.due; t.title = it.title }
      updated++
    }
  }
  tidySubjects()
  return { created, updated }
}
// Une el curso de Tu Aula/Classroom con una materia que ya tengas (ej. "Ética Profesional - Grupo 3" → Ética Profesional)
const normTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'grupo', 'i', 'ii', 'iii', 'curso', 'semestre'])
// Forma "canónica" del nombre: "CALCULO 1" = "Cálculo I", "B2026 ENGLISH I" = "Inglés I"
const SYN = { english: 'ingles', calculus: 'calculo', statistics: 'estadistica', ethics: 'etica', poo: 'programacion orientada objetos' }
const canon = (s) => normTxt(s).split(' ').map((w) => SYN[w] || w).join(' ').split(' ').filter((w) => w && !/\d/.test(w) && !STOP.has(w) && !['elementos', 'introduccion', 'sii', 'g'].includes(w)).join(' ')
const isAuto = (s) => (s.externalId || s.externalIds?.length) && !s.schedule?.length && !s.teacher && !s.teacherEmail
function matchSubject(name, externalId, except) {
  const n = normTxt(name); if (!n) return null
  const c = canon(name)
  const exact = c && state.subjects.find((s) => s.id !== except && canon(s.name) === c)
  if (exact) { exact.externalIds = [...new Set([...(exact.externalIds || []), externalId].filter(Boolean))]; return exact }
  const words = (s) => new Set(normTxt(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)))
  const wn = words(n)
  let best = null, score = 0
  for (const s of state.subjects) {
    if (s.id === except) continue
    const sn = normTxt(s.name)
    let sc = sn && (n.includes(sn) || sn.includes(n)) ? 10 : 0
    const ws = words(s.name); ws.forEach((w) => { if (wn.has(w)) sc++ })
    if (sc > score) { best = s; score = sc }
  }
  if (!best || score < 2) return null
  best.externalIds = [...new Set([...(best.externalIds || []), externalId])]
  return best
}
// Une una materia repetida (creada por Tu Aula/Classroom) dentro de la de verdad
export function mergeSubject(fromId, intoId) {
  const from = state.subjects.find((s) => s.id === fromId), into = state.subjects.find((s) => s.id === intoId)
  if (!from || !into || from.id === into.id) return
  into.externalIds = [...new Set([...(into.externalIds || []), ...(from.externalIds || []), from.externalId].filter(Boolean))]
  state.tasks.forEach((t) => { if (t.subjectId === from.id) { t.subjectId = into.id; if (t.notes === `Materia: ${from.name}`) t.notes = `Materia: ${into.name}` } })
  state.aula.forEach((a) => { if (a.courseId === from.id) a.courseId = into.id })
  ;(state.events || []).forEach((e) => { if (e.subjectId === from.id) e.subjectId = into.id })
  state.subjects = state.subjects.filter((s) => s.id !== from.id)
}
// Las que se pueden unir solas (mismo nombre con otra forma de escribirlo)
export function tidySubjects() {
  let n = 0
  for (const s of [...state.subjects].filter(isAuto)) {
    const c = canon(s.name)
    const real = c && state.subjects.find((x) => x.id !== s.id && canon(x.name) === c && !isAuto(x)) || (c && state.subjects.find((x) => x.id !== s.id && canon(x.name) === c))
    if (real) { mergeSubject(s.id, real.id); n++ }
  }
  return n
}
export const autoSubjects = () => state.subjects.filter(isAuto)
function ensureSubject(name, externalId, source) {
  const s = { id: uid('s'), name: name || 'Materia', short: (name || 'Materia').split(' ').slice(0, 2).join(' '), institution: source === 'classroom' ? 'Classroom' : 'UT', color: '#E8DDF5', schedule: [], externalId }
  state.subjects.push(s)
  return s
}

// ---------- Vida, Dios ----------
export function addLife(m) { state.life.unshift({ id: uid('l'), date: dayKey(), ...m }); award(4, 6, 'Un momento que importa 🤍') }
export function saveGod(entry, k = dayKey()) {
  const first = !state.god.entries[k]
  state.god.entries[k] = { ...(state.god.entries[k] || {}), ...entry }
  if (first) toast('Guardado en tu espacio con Dios 🕊️')
}

// ---------- Casa de la vaquita ----------
import { DECOR } from '../engine/decor'
export function buyDecor(id) {
  const d = DECOR.find((x) => x.id === id)
  if (!d || state.game.owned.includes(id)) return
  if (state.game.coins < d.price) { toast('Te faltan monedas. ¡Cada pasito suma! 🪙'); return }
  state.game.coins -= d.price
  state.game.owned.push(id)
  placeDecor(id)
  toast(`¡Nuevo para la casita: ${d.name}!`, 'coin')
}
export function placeDecor(id) {
  const d = DECOR.find((x) => x.id === id)
  if (!d) return
  if (d.slot === 'accessory') state.game.accessory = state.game.accessory === id ? null : id
  else state.game.placed[d.slot] = state.game.placed[d.slot] === id ? null : id
}
function giftDecor() {
  const pool = DECOR.filter((d) => !state.game.owned.includes(d.id) && d.price <= 200)
  const d = pool[Math.floor(Math.random() * pool.length)]
  if (d) { state.game.owned.push(d.id); placeDecor(d.id) }
}

export function markVisit() {
  const k = dayKey()
  if (state.profile.lastVisit !== k) {
    state.profile.prevVisit = state.profile.lastVisit
    state.profile.lastVisit = k
    const away = -daysUntil(state.profile.prevVisit)
    if (away >= 2) award(10, 10, 'Volviste 💗 Eso es lo que importa')
  }
}
