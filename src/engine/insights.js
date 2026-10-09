import { socialMinutes } from './screen'
// Analítica personal: observaciones sobre TUS datos (nunca diagnósticos)
import { state } from '../store'
import { keyPlus, parseDay, WEEKDAYS_LONG } from './time'

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const byDate = (arr) => arr.reduce((m, x) => ((m[x.date] = m[x.date] || []).push(x), m), {})

export function series(days = 14) {
  const fByDay = byDate(state.focus)
  const done = state.tasks.filter((t) => t.completedAt).reduce((m, t) => ((m[t.completedAt] = (m[t.completedAt] || 0) + 1), m), {})
  return Array.from({ length: days }, (_, i) => {
    const k = keyPlus(-(days - 1) + i)
    const sl = state.sleep.find((s) => s.date === k)
    const sc = state.screen.find((s) => s.date === k)
    const social = sc ? socialMinutes(sc) : null
    const habits = state.habits.filter((h) => state.habitLogs[h.id]?.[k]?.done).length
    return { k, d: parseDay(k), sleep: sl ? sl.minutes / 60 : null, focus: (fByDay[k] || []).reduce((a, f) => a + f.minutes, 0), sessions: (fByDay[k] || []).length, tasks: done[k] || 0, social, habits }
  })
}

export function insights() {
  const out = []
  const s = series(28)

  const withSleep = s.filter((x) => x.sleep != null)
  if (withSleep.length >= 6) {
    const good = withSleep.filter((x) => x.sleep >= 7), bad = withSleep.filter((x) => x.sleep < 7)
    if (good.length >= 2 && bad.length >= 2) {
      const a = avg(good.map((x) => x.sessions)), b = avg(bad.map((x) => x.sessions))
      if (a > b * 1.15) out.push({ id: 'sleep-focus', emoji: '😴', text: `Los días que duermes 7h o más haces en promedio ${a.toFixed(1)} sesiones de enfoque, frente a ${b.toFixed(1)} cuando duermes menos.`, basis: `${withSleep.length} días` })
      const ha = avg(good.map((x) => x.habits)), hb = avg(bad.map((x) => x.habits))
      if (ha > hb * 1.15) out.push({ id: 'sleep-habits', emoji: '🌙', text: `Cuando duermes bien cumples más hábitos (${ha.toFixed(1)} vs ${hb.toFixed(1)}).`, basis: `${withSleep.length} días` })
    }
  }

  const withScreen = s.filter((x) => x.social != null)
  if (withScreen.length >= 6) {
    const med = [...withScreen].sort((a, b) => a.social - b.social)[Math.floor(withScreen.length / 2)].social
    const lo = withScreen.filter((x) => x.social <= med), hi = withScreen.filter((x) => x.social > med)
    const a = avg(lo.map((x) => x.focus)), b = avg(hi.map((x) => x.focus))
    if (a > b * 1.2) out.push({ id: 'screen-focus', emoji: '📱', text: `Los días con menos de ${Math.round(med / 60 * 10) / 10}h en redes te concentras ${Math.round(a - b)} minutos más en promedio.`, basis: `${withScreen.length} días` })
  }

  const f = state.focus
  if (f.length >= 8) {
    const rate = (a) => (a.length ? a.filter((x) => x.outcome === 'logrado').length / a.length : 0)
    const m = f.filter((x) => x.hour < 12), t = f.filter((x) => x.hour >= 12)
    if (m.length >= 3 && t.length >= 3) {
      const rm = rate(m), rt = rate(t)
      if (Math.abs(rm - rt) > 0.1) out.push({ id: 'time-of-day', emoji: rm > rt ? '🌅' : '🌇', text: `Tus sesiones ${rm > rt ? 'de la mañana' : 'de la tarde'} terminan bien el ${Math.round(Math.max(rm, rt) * 100)}% de las veces (vs ${Math.round(Math.min(rm, rt) * 100)}%).`, basis: `${f.length} sesiones` })
    }
    const wd = {}
    f.forEach((x) => { const w = parseDay(x.date).getDay(); wd[w] = (wd[w] || 0) + x.minutes })
    const best = Object.entries(wd).sort((a, b) => b[1] - a[1])[0]
    if (best) out.push({ id: 'best-day', emoji: '📅', text: `Los ${WEEKDAYS_LONG[best[0]]} son el día en que más te concentras.`, basis: `${f.length} sesiones` })
    const short = f.filter((x) => x.minutes <= 25), long = f.filter((x) => x.minutes > 25)
    if (short.length >= 3 && long.length >= 3 && rate(short) > rate(long) + 0.08) out.push({ id: 'short-blocks', emoji: '⏱️', text: `Los bloques cortos (≤25 min) te funcionan mejor: ${Math.round(rate(short) * 100)}% logrados.`, basis: `${f.length} sesiones` })
  }

  const doneT = state.tasks.filter((t) => t.status === 'completada')
  if (doneT.length >= 4) {
    const small = doneT.filter((t) => t.estimate <= 30).length / Math.max(1, state.tasks.filter((t) => t.estimate <= 30).length)
    const big = doneT.filter((t) => t.estimate > 30).length / Math.max(1, state.tasks.filter((t) => t.estimate > 30).length)
    if (small > big + 0.1) out.push({ id: 'small-tasks', emoji: '🧩', text: 'Cuando una tarea tiene una duración pequeña es más probable que la termines. Dividir te sirve.', basis: `${doneT.length} tareas` })
  }

  const it = state.intentions
  if (it.length >= 3) {
    const lost = it.filter((x) => x.result === 'distraje')
    if (lost.length) {
      const apps = lost.reduce((m, x) => ((m[x.endedIn] = (m[x.endedIn] || 0) + 1), m), {})
      const top = Object.entries(apps).sort((a, b) => b[1] - a[1])[0]
      out.push({ id: 'phone', emoji: '👀', text: `${lost.length} de ${it.length} veces que abriste el celular con una intención terminaste en otra app${top ? ` (sobre todo ${top[0]})` : ''}.`, basis: `${it.length} registros` })
    }
  }
  return out
}

// "Mi propio método": aprendizajes de experimentos + principios validados + patrones fuertes
export function myMethod() {
  const items = []
  state.experiments.filter((x) => x.status === 'terminado').forEach((x) => {
    ;(x.learnings || []).forEach((l) => items.push({ text: l, from: `Experimento: ${x.title}`, kind: 'experimento' }))
    if (x.conclusion && !(x.learnings || []).length) items.push({ text: x.conclusion, from: `Experimento: ${x.title}`, kind: 'experimento' })
  })
  state.principles.filter((p) => p.status === 'validado').forEach((p) => items.push({ text: p.text, from: `${p.author} · validado por ti`, kind: 'principio' }))
  insights().filter((i) => ['short-blocks', 'time-of-day', 'small-tasks'].includes(i.id)).forEach((i) => items.push({ text: i.text, from: 'Tus datos', kind: 'datos' }))
  return items
}
