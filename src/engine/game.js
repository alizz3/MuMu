// Gamificación sin culpa: monedas, XP, niveles, rachas flexibles, misiones y estado de la vaquita
import { state, ui } from '../store'
import { dayKey, keyPlus, daysUntil, parseDay } from './time'
import { isOpen, rankedTasks } from './planner'

export function award(coins, xp, reason) {
  state.game.coins += coins
  const before = level().n
  state.game.xp += xp
  state.game.history.unshift({ at: new Date().toISOString(), coins, xp, reason })
  state.game.history = state.game.history.slice(0, 80)
  toast(`+${coins} 🪙  ${reason}`, 'coin')
  if (level().n > before) {
    ui.celebrate = { title: `¡Nivel ${level().n}!`, text: 'La vaquita está orgullosísima 🥹✨', pose: 'celebrate' }
  }
}

export function level() {
  const xp = state.game.xp
  let n = 1, need = 100, acc = 0
  while (xp >= acc + need) { acc += need; n++; need = 100 + (n - 1) * 50 }
  return { n, into: xp - acc, need, pct: Math.round(((xp - acc) / need) * 100) }
}

export function toast(text, kind = 'info', action = null) {
  if (ui.toasts.some((t) => t.text === text)) return // no repetir el mismo aviso
  const id = Math.random().toString(36).slice(2)
  ui.toasts.push({ id, text, kind, action })
  setTimeout(() => { const i = ui.toasts.findIndex((t) => t.id === id); if (i >= 0) ui.toasts.splice(i, 1) }, action ? 7000 : 3200)
}

// ----- Rachas flexibles -----
export function habitStats(h, days = 24) {
  const log = state.habitLogs[h.id] || {}
  let done = 0, current = 0, counting = true
  for (let i = 0; i < days; i++) {
    const k = keyPlus(-i)
    const ok = !!log[k]?.done
    if (ok) done++
    if (i === 0 && !ok) continue // hoy todavía cuenta
    if (counting) { if (ok) current++; else counting = false }
  }
  const week = Array.from({ length: 7 }, (_, i) => { const k = keyPlus(-6 + i); return { k, done: !!log[k]?.done, wd: parseDay(k).getDay() } })
  const weekDone = week.filter((w) => w.done).length
  const prevWeek = Array.from({ length: 7 }, (_, i) => !!log[keyPlus(-13 + i)]?.done).filter(Boolean).length
  return {
    done, days, current, week, weekDone,
    weekPct: Math.round((weekDone / Math.min(7, h.target || 7)) * 100),
    trend: weekDone - prevWeek,
    paused: current === 0 && done > 0,
  }
}

export function overallConsistency(days = 24) {
  let active = 0
  for (let i = 0; i < days; i++) {
    const k = keyPlus(-i)
    const any = state.habits.some((h) => state.habitLogs[h.id]?.[k]?.done) || state.focus.some((f) => f.date === k) || state.tasks.some((t) => t.completedAt === k)
    if (any) active++
  }
  const weekPct = Math.round(state.habits.reduce((a, h) => a + Math.min(100, habitStats(h).weekPct), 0) / Math.max(1, state.habits.length))
  return { active, days, weekPct }
}

export function streakMessage() {
  const c = overallConsistency()
  const today = state.habits.some((h) => state.habitLogs[h.id]?.[dayKey()]?.done)
  if (c.active === 0) return 'Hoy es un día perfecto para empezar 💗'
  if (!today && !state.habits.some((h) => state.habitLogs[h.id]?.[keyPlus(-1)]?.done)) return `Has sido constante ${c.active} de los últimos ${c.days} días. Tu racha se pausó, pero podemos retomarla hoy 💗`
  return `Constante ${c.active} de los últimos ${c.days} días · semana al ${c.weekPct}%`
}

// ----- Misiones contextuales -----
export function daily(k = dayKey()) {
  if (!state.daily) state.daily = {}
  if (!state.daily[k]) state.daily[k] = {}
  return state.daily[k]
}

export function missions() {
  const k = dayKey(), d = daily(k), dt = daily(keyPlus(1))
  const focusToday = state.focus.filter((f) => f.date === k)
  const late = rankedTasks().map((r) => r.t).find((t) => (t.postponed || 0) >= 1 || daysUntil(t.due) < 0)
  const list = [
    {
      id: 'prepara-dia', title: 'Ayúdame a preparar el día', emoji: '🗓️', reward: 30,
      steps: [
        { t: 'Revisar Aula y correos', done: !!d.reviewed, go: 'universidad' },
        { t: 'Elegir la prioridad del día', done: !!d.priority, go: 'home' },
        { t: 'Organizar la agenda (un bloque)', done: state.tasks.some((t) => (t.blocks || []).some((b) => b.date === k)), go: 'agenda' },
        { t: 'Hacer una sesión de enfoque', done: focusToday.length > 0, go: 'enfoque' },
        { t: 'Dejar mañana preparado', done: !!dt.priority, go: 'rutinas' },
      ],
    },
    {
      id: 'rescate', title: 'Rescate de productividad', emoji: '🛟', reward: 25, taskId: late?.id,
      steps: [
        { t: late ? `Elegir: "${late.title}"` : 'Elegir una tarea atrasada', done: !!d.rescueTask, go: 'tareas' },
        { t: 'Dividirla en pasitos', done: !!(d.rescueTask && (state.tasks.find((t) => t.id === d.rescueTask)?.subtasks || []).length >= 2), go: 'tareas' },
        { t: 'Hacer 5 minutos', done: focusToday.some((f) => f.mode === 'empezar'), go: 'enfoque' },
        { t: 'Completar una pequeña parte', done: !!d.subtaskDone, go: 'tareas' },
      ],
    },
    {
      id: 'vida', title: 'Un día con vida 🤍', emoji: '🌷', reward: 15,
      steps: [
        { t: 'Un momento con familia o mascotas', done: state.life.some((l) => l.date === k), go: 'vida' },
        { t: 'Un espacio con Dios', done: !!state.god.entries[k], go: 'dios' },
        { t: 'Registrar cómo dormiste', done: state.sleep.some((s) => s.date === k), go: 'sueno' },
      ],
    },
  ]
  for (const m of list) {
    m.progress = m.steps.filter((s) => s.done).length
    m.complete = m.progress === m.steps.length
    m.claimed = !!state.missionsDone[`${k}:${m.id}`]
  }
  return list
}

export function claimMission(m) {
  const key = `${dayKey()}:${m.id}`
  if (state.missionsDone[key] || !m.complete) return
  state.missionsDone[key] = true
  award(m.reward, m.reward * 2, `Misión: ${m.title}`)
}

// ----- La vaquita reacciona al día -----
const HAPPY = ['Hoy es un buen día para hacer cosas increíbles 💗', 'Estoy aquí contigo, poquito a poquito 🐮', '¿Un aguita y empezamos? 💧', 'Progreso, no perfección ✨']

export function petState() {
  const k = dayKey()
  const h = ui.now.getHours()
  const name = state.settings.ownerName
  const open = state.tasks.filter(isOpen)
  const dueSoon = open.filter((t) => daysUntil(t.due) <= 1).length
  const c = overallConsistency(7)
  const lifeToday = state.life.some((l) => l.date === k) || (state.events || []).some((e) => e.type === 'familia' && e.date === k)
  const away = state.profile.prevVisit ? -daysUntil(state.profile.prevVisit) : 0
  const stuck = open.find((t) => (t.postponed || 0) >= 2)
  let s
  if (ui.focus) s = { pose: ui.focus.category === 'trabajo' ? 'laptop' : 'study', msg: 'Shhh… estamos concentradas 🤓' }
  else if (away >= 2 && !state.daily?.[k]?.welcomed) s = { pose: 'wait', msg: `Holiii… te estaba esperando 🐮💗 ¿Volvemos poquito a poquito?` }
  else if (h >= 22 || h < 5) s = { pose: 'sleep', msg: 'Ya es hora de descansar. Mañana seguimos 🌙' }
  else if (dueSoon >= 3 || open.length >= 10) s = { pose: 'tired', msg: 'Respiremos 😭💗 Vamos una por una.' }
  else if (stuck) s = { pose: 'motivate', msg: 'No necesitamos terminarlo ahora… solo empecemos 5 minuticos.' }
  else if (c.active >= 5) s = { pose: 'celebrate', msg: 'Mira todo lo que has avanzado 🥹✨' }
  else if (h < 9) s = { pose: 'coffee', msg: `Buenos días, ${name} ☀️ ¿Empezamos con calma?` }
  else s = { pose: 'happy', msg: HAPPY[(new Date().getDate() + h) % HAPPY.length] }
  s.leo = h >= 21 || h < 7 || s.pose === 'sleep' ? 'sleep' : 'sit'
  s.negra = lifeToday ? 'happy' : 'sit'
  s.hearts = Math.max(1, Math.min(5, Math.round(c.active / 7 * 5)))
  return s
}

// Confirmación dentro de la app (los diálogos nativos no funcionan en todos los visores)
export function ask(text) { return new Promise((resolve) => { ui.confirm = { text, resolve } }) }
