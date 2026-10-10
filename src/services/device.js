// Plan para la app de Android: alarmas (con tu canción), recordatorios y lo que muestra el widget.
// MuMu lo calcula aquí, lo guarda en tus datos (users/{uid}/data/device) y la app del celular lo lee
// cada rato aunque MuMu esté cerrada. Nada de esto sale de tu cuenta.
import { watch } from 'vue'
import { state, ui } from '../store'
import { itemsOn, isOpen, rankedTasks } from '../engine/planner'
import { dayKey, addDays, parseDay, hm, toHM, fmt12, daysUntil, relDay, WEEKDAYS } from '../engine/time'
import { importUso } from './androidUso'
import { linkDevice } from './api'
import { toast } from '../engine/game'

// ---------- Ajustes del día de universidad ----------
export const UNI_DEFAULTS = { leave: '06:30', getReady: 60, commute: 40, sleepH: 8, wake: '06:30', wakeOn: true, intensidad: 'normal', bagAt: '19:00', overrides: {}, bag: {} }
export function uniPlan() {
  if (!state.settings.uniPlan) state.settings.uniPlan = {}
  const p = state.settings.uniPlan
  for (const [k, v] of Object.entries(UNI_DEFAULTS)) if (p[k] === undefined) p[k] = JSON.parse(JSON.stringify(v))
  return p
}

export const BAG = [
  ['cuadernos', 'Empaca los cuadernos de las materias de mañana', 'book'],
  ['cartuchera', 'Recarga la cartuchera: lápices, lapiceros, borrador, calculadora', 'edit'],
  ['tareas', 'Tareas y guías al día (y descargadas o impresas)', 'check'],
  ['ropa', 'Deja lista la ropa que te vas a poner', 'shirt'],
  ['celular', 'Pon a cargar el celular (y el power bank)', 'bolt'],
  ['moto', 'Llaves de la moto y casco a la mano', 'key'],
  ['papeles', 'Documentos: cédula, licencia, carné', 'note'],
  ['ruta', 'Revisa la ruta y la hora de salida', 'pin'],
]

// Clases o tutorías de un día (de Google Calendar UT o de tus materias)
export function classesOn(k) {
  return itemsOn(k).filter((i) => !i.allDay && (i.type === 'clase' || i.subjectId || /^UT\b/i.test(i.calendarName || '') || /tutor[ií]a/i.test(i.title || '')))
}
export const isUniDay = (k) => classesOn(k).length > 0

// Horas clave de un día de U: salir, levantarse, acostarse la noche anterior
export function uniTimes(k) {
  const p = uniPlan()
  const cls = classesOn(k)
  if (!cls.length) return null
  const leave = hm(p.overrides[k]?.leave || p.leave)
  const wake = leave - p.getReady
  const bed = wake - p.sleepH * 60 - 15 // 15 min para dormirse
  const last = cls.reduce((m, c) => Math.max(m, hm(c.end)), 0)
  return { cls, leave, wake, bed: (bed + 1440) % 1440, home: last + p.commute, first: hm(cls[0].start) }
}

// ---------- Mensajes ----------
const WAKE = [
  'Gana la primera batalla del día: pies al piso antes de que tu cerebro empiece a negociar.',
  'No lo pienses. Levántate, salta, brinca, estírate. Ya ganaste la mañana.',
  'Sé que la cama está rica, pero tu yo de la noche te lo va a agradecer. ¡Arriba!',
  'Cuenta 5, 4, 3, 2, 1… y te paras. Sin pelear con tu mente.',
  'Las personas que logran lo que quieren empiezan ganándole a la almohada. Hoy tú también.',
  'Abre la cortina, toma agua y mueve el cuerpo. El día es tuyo.',
]
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length]

// ---------- El plan ----------
const at = (k, min) => { const d = parseDay(k); d.setMinutes(min); return d.getTime() }
function inQuiet(min) {
  const q = state.settings.notify?.quiet
  if (!q) return false
  const a = hm(q[0]), b = hm(q[1])
  return a < b ? min >= a && min < b : min >= a || min < b
}

export function computePlan(now = new Date()) {
  const p = uniPlan()
  const level = { suave: 0, normal: 1, intensa: 2 }[p.intensidad] ?? 1
  const plan = []
  const add = (id, k, min, kind, title, text, open = '') => {
    if (min < 0) { k = dayKey(addDays(parseDay(k), -1)); min += 1440 }
    const t = at(k, min)
    if (t <= now.getTime() || t > now.getTime() + 8 * 864e5) return
    if (kind === 'notif' && inQuiet(min)) return
    plan.push({ id: `${id}-${k}`, at: t, kind, title, text, open })
  }
  const open = state.tasks.filter(isOpen)
  const habitDay = dayKey(now)
  for (let i = 0; i < 8; i++) {
    const k = dayKey(addDays(now, i))
    const next = dayKey(addDays(now, i + 1))
    const u = uniTimes(k)
    const uNext = uniTimes(next)
    const seed = parseDay(k).getDate()
    // Alarma de despertar (en día de U, la calculada a partir de la hora de salida)
    if (u) add('wake', k, u.wake, 'alarm', '¡Arriba, Aliz!', `${pick(WAKE, seed)} Hoy sales a las ${fmt12(u.leave)}.`, 'ir=plan')
    else if (p.wakeOn) add('wake', k, hm(p.wake), 'alarm', '¡Arriba, Aliz!', pick(WAKE, seed), '')
    if (u) {
      add('salir15', k, u.leave - 15, 'notif', 'En 15 minutos sales', `Llaves, casco, maleta, celular. Primera clase a las ${fmt12(u.first)}.`, 'ir=plan')
      add('salir', k, u.leave, 'alarm', '¡Hora de salir!', 'Ve con calma y con cuidado en la moto. Dios te acompaña.', 'ir=plan')
      u.cls.forEach((c, j) => add('clase' + j, k, hm(c.start) - 10, 'notif', `En 10 min: ${c.title}`, `${fmt12(hm(c.start))} – ${fmt12(hm(c.end))}${c.location ? ' · ' + c.location : ''}`, 'ir=agenda'))
      for (let j = 0; j < u.cls.length - 1; j++) {
        const gap = hm(u.cls[j + 1].start) - hm(u.cls[j].end)
        if (gap >= 45) add('almuerzo' + j, k, hm(u.cls[j].end), 'notif', 'Hora de almorzar', `Tienes ${gap} min antes de ${u.cls[j + 1].title}. Come algo rico y toma agua.`)
      }
      add('casa', k, u.home, 'notif', '¿Ya llegaste a casa?', 'Toca para marcarlo y vemos qué hacemos por tu vida.', 'casa=llegue')
    }
    // La noche antes de la U: maleta y dormir a tiempo
    if (uNext) {
      add('maleta', k, hm(p.bagAt), 'notif', 'Alista tu maleta para mañana', 'Cuadernos, cartuchera, tareas, ropa, celular cargado, llaves y documentos. Toca para ver la lista.', 'ir=plan')
      add('dormir30', k, uNext.bed - 30, 'notif', 'En 30 min a dormir', `Para levantarte a las ${fmt12(uNext.wake)} sin pereza y salir a las ${fmt12(uNext.leave)}.`, 'ir=plan')
      add('dormir', k, uNext.bed, 'notif', 'Hora de dormir', 'Celular lejos de la cama. Mañana ganas la primera batalla.', '')
    } else if (level >= 1) {
      add('dormir', k, hm(state.profile.sleep) - 30, 'notif', 'Vamos cerrando el día', 'En 30 min a dormir. Deja mañana preparado.', 'ir=rutinas')
    }
    // Tareas: lo que vence mañana (por la tarde) y lo de hoy (por la mañana)
    const dueTomorrow = open.filter((t) => t.due === next)
    const dueToday = open.filter((t) => t.due === k)
    if (dueToday.length) add('hoy', k, (u ? u.home + 30 : hm(p.wake) + 60), 'notif', `Hoy vence: ${dueToday[0].title}`, dueToday.length > 1 ? `Y ${dueToday.length - 1} más. Toca para verlas.` : 'Toca para abrirla.', 'ir=tareas')
    if (dueTomorrow.length && level >= 1) add('manana', k, hm('18:30'), 'notif', `Mañana vence: ${dueTomorrow[0].title}`, dueTomorrow.length > 1 ? `Y ${dueTomorrow.length - 1} más. ¿Le das un empujón hoy?` : '¿Le das un empujón hoy?', 'ir=tareas')
    if (level >= 2 && (dueToday.length || dueTomorrow.length)) add('medio', k, hm('12:30'), 'notif', '¿Cómo vas?', `Recuerda: ${(dueToday[0] || dueTomorrow[0]).title}.`, 'ir=tareas')
    // Hábitos que faltan hoy (solo se sabe con certeza para hoy)
    if (k === habitDay && level >= 1) {
      const left = state.habits.filter((h) => !state.habitLogs[h.id]?.[k]?.done)
      if (left.length) add('habitos', k, hm('20:00'), 'notif', `Te faltan ${left.length} ${left.length === 1 ? 'hábito' : 'hábitos'} hoy`, left.slice(0, 3).map((h) => h.name).join(', '), 'ir=habitos')
    }
  }
  plan.sort((a, b) => a.at - b.at)
  return { plan, widget: widgetData(now), home: state.settings.home || null, quick: true }
}

function widgetData(now) {
  const k = dayKey(now)
  const m = now.getHours() * 60 + now.getMinutes()
  const next = itemsOn(k).find((i) => !i.allDay && hm(i.start) > m)
  const tomorrow = dayKey(addDays(now, 1))
  const u = uniTimes(k), uN = uniTimes(tomorrow)
  const line = u && u.leave > m ? `Sal a las ${fmt12(u.leave)}` : uN ? `Mañana U · sal a las ${fmt12(uN.leave)}` : next ? `${fmt12(hm(next.start))} · ${next.title}` : 'Sin más eventos hoy'
  const due = (t) => { const d = daysUntil(t.due); return t.due == null ? '' : d < 0 ? 'atrasada' : d === 0 ? 'hoy' : d === 1 ? 'mañana' : WEEKDAYS[parseDay(t.due).getDay()] + ' ' + parseDay(t.due).getDate() }
  const tasks = rankedTasks().slice(0, 4).map((r) => ({ t: r.t.title.slice(0, 60), d: due(r.t) }))
  const hs = state.habits, done = hs.filter((h) => state.habitLogs[h.id]?.[k]?.done).length
  return { line, tasks, habits: hs.length ? `Hábitos ${done}/${hs.length}` : '', coins: state.game?.coins || 0 }
}

// ---------- Mantenerlo al día ----------
let timer
function refresh() {
  if (!ui.synced || ui.demo || !ui.user) return
  const next = computePlan()
  const d = state.device || {}
  if (JSON.stringify([next.plan, next.widget, next.home]) === JSON.stringify([d.plan, d.widget, d.home || null])) return
  state.device = { ...next, at: Date.now() }
}

export function initDevice() {
  watch(() => [ui.synced, state.tasks, state.events, state.habitLogs, state.settings.uniPlan, state.settings.home, state.settings.notify, state.subjects, state.profile.sleep],
    () => { clearTimeout(timer); timer = setTimeout(refresh, 2500) }, { deep: true })
  setInterval(refresh, 20 * 60 * 1000)
  // Tiempo de pantalla que subió la app de Android mientras MuMu estaba cerrada
  watch(() => state.usoCelular?.at, (t) => {
    if (!t || !ui.synced) return
    if ((state.settings.android?.at && new Date(state.settings.android.at).getTime() >= t)) return
    try { importUso(JSON.parse(state.usoCelular.json)) } catch { /* datos dañados */ }
  }, { immediate: true })
  handleHash()
  window.addEventListener('hashchange', handleHash)
}

// Atajos que abre la app de Android: #nueva=tarea, #casa=llegue, #ir=<vista>
function handleHash() {
  const m = location.hash.match(/^#(nueva|casa|ir)=([\w-]+)/)
  if (!m) return
  history.replaceState(null, '', location.pathname + location.search)
  const go = (v) => import('../store/actions').then((A) => A.go(v))
  if (m[1] === 'nueva') setTimeout(() => { ui.modal = { type: 'task', prefill: { due: dayKey() } } }, 600)
  if (m[1] === 'casa') { state.settings.enCasaAt = Date.now(); go('home') }
  if (m[1] === 'ir') go(m[2])
}

// Enlazar el celular: pide un token y se lo pasa a la app
export async function connectPhone() {
  try {
    const { token } = await linkDevice()
    location.href = `mumu://enlazar?t=${encodeURIComponent(token)}`
    state.settings.phoneLinkedAt = Date.now()
  } catch (e) { toast(e.message) }
}
export { relDay, toHM }
