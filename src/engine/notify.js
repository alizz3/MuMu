// Notificaciones contextuales. En la web solo pueden salir dentro de la app (toasts)
// o como notificación del navegador si diste permiso. NO pueden aparecer sobre otras apps del celular.
import { state, ui } from '../store'
import { dayKey, hm, nowMin, fmtDur, daysUntil } from './time'
import { currentContext, isOpen } from './planner'
import { toast } from './game'

function inQuiet(m) {
  const [a, b] = state.settings.notify.quiet || ['22:30', '06:00']
  const s = hm(a), e = hm(b)
  return s > e ? m >= s || m < e : m >= s && m < e
}

export function push(key, text, opts = {}) {
  const k = dayKey()
  if (state.notifications.some((n) => n.key === key && n.day === k)) return
  state.notifications.unshift({ id: Math.random().toString(36).slice(2), key, day: k, at: new Date().toISOString(), text, go: opts.go || null, open: opts.open || null, subject: opts.subject || null, read: false, kind: opts.kind || 'info' })
  state.notifications = state.notifications.slice(0, 60)
  toast(text, opts.kind || 'info', opts.go ? { label: 'Ver', go: opts.go } : null)
  if (state.settings.notify.browser && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(state.settings.appName, { body: text }) } catch { /* algunos navegadores móviles exigen service worker */ }
  }
}

export function tick() {
  const n = state.settings.notify
  const m = nowMin(ui.now)
  if (inQuiet(m)) return
  const ctx = currentContext()

  if (n.classes && ctx.next?.type === 'clase') {
    const diff = hm(ctx.next.start) - m
    if (diff > 0 && diff <= 30) push(`class:${ctx.next.id}`, `Tu próxima clase (${ctx.next.title.replace('Clase: ', '')}) empieza en ${diff} minutos.`, { go: 'agenda' })
  }
  if (n.freeTime && ctx.freeNow && ctx.freeNow.minutes >= 30 && ctx.freeNow.minutes <= 180 && m % 60 < 2) {
    push(`free:${Math.floor(m / 60)}`, `Tienes ${fmtDur(ctx.freeNow.minutes)} libres. ¿Los usamos? 💗`, { go: 'home' })
  }
  if (n.aula) {
    const fresh = state.aula.filter((a) => !a.notified)
    fresh.forEach((a) => {
      a.notified = true
      if (a.demo) return
      const subj = state.subjects.find((s) => s.id === a.courseId)?.name || null
      const src = a.source === 'classroom' ? 'Classroom' : 'Tu Aula'
      push(`aula:${a.id}`, a.changed ? `Cambió algo en ${src}: ${a.title}` : `Nueva actividad en ${src}: ${a.title}`, { go: 'universidad', subject: subj, open: a.taskId ? { type: 'task', id: a.taskId } : null })
    })
  }
  if (n.email) {
    const imp = state.emails.filter((e) => e.category === 'importante' && e.status === 'nuevo' && !e.demo && !e.notified)
    imp.forEach((e) => { e.notified = true; push(`mail:${e.id}`, `Tu correo tiene algo que requiere atención: ${e.subject}`, { go: 'correo' }) })
  }
  const stuck = state.tasks.find((t) => isOpen(t) && t.intendedAt && Date.now() - t.intendedAt > 45 * 60 * 1000 && !t.intendNotified)
  if (stuck) { stuck.intendNotified = true; push(`intent:${stuck.id}`, `Hace rato dijiste que querías hacer "${stuck.title}" 👀 ¿Hacemos primero esos 10 minutos?`, { go: 'tareas', open: { type: 'task', id: stuck.id } }) }

  if (n.habits && m >= 20 * 60 && m < 20 * 60 + 2) {
    const pend = state.habits.filter((h) => !state.habitLogs[h.id]?.[ctx.k]?.done).length
    if (pend) push('habits:evening', `Te quedan ${pend} hábitos de hoy. Con uno chiquito ya cuenta 💗`, { go: 'habitos' })
  }
  const due = state.tasks.filter((t) => isOpen(t) && daysUntil(t.due) === 0)
  if (due.length && m >= 9 * 60 && m < 9 * 60 + 2) push('due:today', `Hoy vencen ${due.length} pendientes. Vamos una por una 🐮`, { go: 'tareas' })
}

export async function askBrowserPermission() {
  if (typeof Notification === 'undefined') return 'no-soportado'
  const r = await Notification.requestPermission()
  state.settings.notify.browser = r === 'granted'
  return r
}
