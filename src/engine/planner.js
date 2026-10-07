// Motor de disponibilidad + "¿Qué hago ahora?"
import { state, ui } from '../store'
import { dayKey, parseDay, hm, toHM, nowMin, daysUntil, fmtDur, fmt12, keyPlus, relDay } from './time'

export const PRIORITY_W = { alta: 3, media: 2, baja: 1 }
export const isOpen = (t) => !['completada', 'cancelada'].includes(t.status)

// ---------- Calendario unificado ----------
export function itemsOn(k) {
  const wd = parseDay(k).getDay()
  const out = []
  for (const e of state.events) {
    if (e.date === k || (e.recurring && e.recurring.includes(wd) && e.date <= k && !(e.skip || []).includes(k))) out.push({ ...e, kind: 'event' })
  }
  for (const s of state.subjects) {
    for (const sl of s.schedule || []) if (sl.weekday === wd) out.push({ id: `${s.id}_${k}_${sl.start}`, title: `Clase: ${s.short || s.name}`, start: sl.start, end: sl.end, type: 'clase', subjectId: s.id, color: s.color, kind: 'class', source: s.institution })
  }
  for (const t of state.tasks) for (const b of t.blocks || []) if (b.date === k) out.push({ id: `${t.id}_${b.start}`, title: t.title, start: b.start, end: b.end, type: 'bloque', taskId: t.id, kind: 'block', done: b.done })
  return out.sort((a, b) => hm(a.start) - hm(b.start))
}

export function dueOn(k) { return state.tasks.filter((t) => t.due === k && isOpen(t)) }

// Bloques libres del día entre la hora de despertar y la de dormir
export function freeBlocks(k, fromMin = null) {
  const start = Math.max(hm(state.profile.wake), fromMin ?? 0)
  let end = hm(state.profile.sleep)
  if (end <= hm(state.profile.wake)) end = 24 * 60 - 1
  const busy = itemsOn(k).filter((i) => !i.done).map((i) => [hm(i.start), hm(i.end)]).sort((a, b) => a[0] - b[0])
  const blocks = []
  let cur = start
  for (const [s, e] of busy) {
    if (e <= cur) continue
    if (s > cur && s - cur >= 15) blocks.push({ start: cur, end: Math.min(s, end) })
    cur = Math.max(cur, e)
    if (cur >= end) break
  }
  if (end - cur >= 15) blocks.push({ start: cur, end })
  return blocks.filter((b) => b.end - b.start >= 15).map((b) => ({ ...b, minutes: b.end - b.start, label: `${fmt12(b.start)} – ${fmt12(b.end)}` }))
}

export function freeMinutes(k, fromMin) { return freeBlocks(k, fromMin).reduce((a, b) => a + b.minutes, 0) }

export function currentContext(now = ui.now) {
  const k = dayKey(now), m = nowMin(now)
  const items = itemsOn(k)
  const inNow = items.find((i) => hm(i.start) <= m && hm(i.end) > m)
  const next = items.find((i) => hm(i.start) > m)
  const blocks = freeBlocks(k, m)
  const freeNow = !inNow && blocks[0] && blocks[0].start <= m + 1 ? { ...blocks[0], minutes: blocks[0].end - m } : null
  const sleepMin = hm(state.profile.sleep)
  const night = m >= sleepMin - 30 || m < hm(state.profile.wake) - 30
  const part = m < 12 * 60 ? 'morning' : m < 18 * 60 ? 'afternoon' : 'night'
  return { k, m, items, inNow, next, freeNow, freeToday: freeMinutes(k, m), night, part, energy: state.profile.energy?.[part] || 'media' }
}

// ---------- Tareas ----------
export const remaining = (t) => Math.max(5, (t.estimate || 30) - (t.spent || 0))

export function effectivePriority(t) {
  const d = daysUntil(t.due)
  if (d <= 1) return 'alta'
  if (d <= 3 && t.priority !== 'alta') return t.priority === 'baja' ? 'media' : 'alta'
  return t.priority
}

export function learnedPrefs() {
  const exps = state.experiments.filter((x) => x.status === 'terminado' && ['funcionó', 'parcial'].includes(x.result))
  const shortBlocks = state.focus.filter((f) => f.minutes <= 25 && f.outcome === 'logrado').length >= state.focus.filter((f) => f.minutes > 25 && f.outcome === 'logrado').length
  const morning = state.focus.filter((f) => f.hour < 12)
  const after = state.focus.filter((f) => f.hour >= 12)
  const rate = (a) => (a.length ? a.filter((f) => f.outcome === 'logrado').length / a.length : 0)
  return { shortBlocks, morningBetter: rate(morning) > rate(after) + 0.08, experiments: exps.length }
}

export function scoreTask(t, ctx) {
  const d = daysUntil(t.due)
  const urgency = t.due == null ? 0.4 : d < 0 ? 5 : d === 0 ? 4.6 : d === 1 ? 4 : d <= 3 ? 2.8 : d <= 7 ? 1.4 : 0.6
  const importance = PRIORITY_W[t.priority] + (t.goalId ? 0.8 : 0)
  const rem = remaining(t)
  const free = ctx.freeNow?.minutes ?? 60
  const fit = rem <= free ? 1 : free >= 25 ? 0.6 : 0.1
  const heavy = rem >= 60 || t.category === 'universidad'
  const energy = ctx.energy === 'alta' ? (heavy ? 0.8 : 0.2) : ctx.energy === 'baja' ? (heavy ? -0.6 : 0.5) : 0.2
  const stuck = Math.min(1.2, (t.postponed || 0) * 0.4)
  const started = t.status === 'en progreso' ? 0.4 : 0
  return urgency * 1.4 + importance + fit + energy + stuck + started
}

export function rankedTasks(ctx = currentContext()) {
  return state.tasks.filter(isOpen).filter((t) => t.status !== 'pausada').map((t) => ({ t, score: scoreTask(t, ctx) })).sort((a, b) => b.score - a.score)
}

function principleFor(tags) {
  const p = state.principles.find((x) => x.tags.some((tg) => tags.includes(tg)) && x.status !== 'descartado')
  if (!p) return null
  const src = state.resources.find((r) => r.id === p.sourceId)
  return { ...p, sourceTitle: src?.title }
}

export function recommend(now = ui.now) {
  const ctx = currentContext(now)
  const prefs = learnedPrefs()
  const name = state.settings.ownerName

  if (ctx.night) {
    return { kind: 'rest', pose: 'sleep', title: 'Ir cerrando el día', minutes: 15, reason: `Ya es tarde, ${name}. Lo mejor ahora es la rutina de noche y dejar mañana preparado. Descansar también es avanzar 🌙`, actions: ['rutina'], ctx }
  }
  if (ctx.inNow) {
    const after = rankedTasks(ctx)[0]?.t
    return { kind: 'busy', pose: ctx.inNow.type === 'clase' ? 'study' : 'happy', title: `Ahora: ${ctx.inNow.title}`, minutes: hm(ctx.inNow.end) - ctx.m, reason: `Estás en "${ctx.inNow.title}" hasta las ${fmt12(hm(ctx.inNow.end))}.${after ? ` Después te sugiero: ${after.title}.` : ''}`, task: after, ctx }
  }
  const free = ctx.freeNow?.minutes ?? 0
  const ranked = rankedTasks(ctx)
  const focusToday = state.focus.filter((f) => f.date === ctx.k).reduce((a, f) => a + f.minutes, 0)
  const lifeToday = state.life.some((l) => l.date === ctx.k)

  if (focusToday >= 150 && !lifeToday && free >= 20) {
    return { kind: 'life', pose: 'happy', title: 'Una pausa de verdad', minutes: 20, reason: `Hoy ya llevas ${fmtDur(focusToday)} de enfoque. Una pausa con tu familia, Leo o Negra también cuenta como un buen día 🤍`, actions: ['vida'], ctx }
  }
  if (!ranked.length) {
    return { kind: 'free', pose: 'celebrate', title: 'No tienes pendientes urgentes', minutes: free, reason: 'Puedes adelantar un objetivo, aprender algo de Mi cerebro o simplemente descansar sin culpa.', actions: ['cerebro'], ctx }
  }
  const top = ranked[0].t
  const rem = remaining(top)
  if (free < 10) {
    return { kind: 'micro', pose: 'think', title: 'Algo cortito', minutes: Math.max(free, 3), reason: `Tienes muy poco tiempo libre antes de ${ctx.next?.title || 'lo siguiente'}. Aprovecha para preparar "${top.title}": abre el archivo o lee el enunciado.`, task: top, ctx, alternatives: ranked.slice(1, 4).map((r) => r.t) }
  }
  const unit = prefs.shortBlocks ? 25 : 45
  let minutes = Math.min(rem, Math.max(10, free - 5), top.postponed >= 2 ? 25 : unit)
  if (minutes > 25 && minutes < 40) minutes = 25
  const d = daysUntil(top.due)
  const goal = state.goals.find((g) => g.id === top.goalId)
  const parts = []
  parts.push(ctx.next ? `Tienes ${fmtDur(free)} libres antes de ${ctx.next.title.toLowerCase()}.` : `Tienes ${fmtDur(free)} libres.`)
  parts.push(`Lo mejor ahora es avanzar en "${top.title}" durante ${minutes} minutos`)
  if (top.due != null) parts[1] += d < 0 ? ' (está atrasada, sin culpa: vamos por partes).' : ` (vence ${relDay(top.due)}).`
  else parts[1] += '.'
  if (goal) parts.push(`Te acerca a "${goal.name}".`)
  let principle = null
  if ((top.postponed || 0) >= 2) {
    principle = principleFor(['procrastinación', 'empezar'])
    parts.push(`Llevas ${top.postponed} veces posponiéndola. ¿La convertimos en solo 5 minutos?`)
  } else if (ctx.part === 'morning' && prefs.morningBetter) {
    principle = principleFor(['mañana', 'prioridad'])
    parts.push('Tus datos dicen que en la mañana te concentras mejor ✨')
  }
  if (rem > free && top.due) {
    const plan = planTask(top)
    if (plan.length > 1) parts.push(`Te dejé ${plan.length} bloques sugeridos para terminarla a tiempo.`)
  }
  return {
    kind: 'task', pose: top.category === 'universidad' ? 'study' : top.category === 'trabajo' ? 'laptop' : 'happy',
    title: top.title, task: top, minutes, reason: parts.join(' '), principle, ctx,
    alternatives: ranked.slice(1, 4).map((r) => r.t),
  }
}

// Divide el trabajo restante de una tarea en bloques libres antes de la fecha límite
export function planTask(t, maxDays = 14) {
  let need = remaining(t)
  const out = []
  const limit = t.due ? Math.max(0, Math.min(maxDays, daysUntil(t.due))) : 3
  for (let i = 0; i <= limit && need > 0; i++) {
    const k = keyPlus(i)
    const from = i === 0 ? nowMin() + 5 : null
    for (const b of freeBlocks(k, from)) {
      if (need <= 0) break
      if (b.minutes < 25) continue
      const len = Math.min(need, b.minutes >= 60 ? 50 : 25)
      out.push({ date: k, start: toHM(b.start), end: toHM(b.start + len), minutes: len })
      need -= len
      if (out.filter((o) => o.date === k).length >= 2) break
    }
  }
  return out
}

export function dayLoad(k = dayKey()) {
  const items = itemsOn(k)
  const busy = items.reduce((a, i) => a + (hm(i.end) - hm(i.start)), 0)
  const study = items.filter((i) => ['clase', 'bloque', 'estudio'].includes(i.type)).reduce((a, i) => a + (hm(i.end) - hm(i.start)), 0)
  const work = items.filter((i) => i.type === 'trabajo').reduce((a, i) => a + (hm(i.end) - hm(i.start)), 0)
  return { busy, study, work, free: freeMinutes(k) }
}
