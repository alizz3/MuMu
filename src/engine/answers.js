// Respuestas sin IA: la vaquita contesta con tus datos lo que se puede saber directo
// (tareas, agenda, proyectos, materias, hábitos, descripción de una tarea). Gratis, al instante y sin internet.
// Si la pregunta es abierta (cómo, por qué, ideas, redactar…), devuelve null y la responde la IA.
import { state } from '../store'
import { projectProgress } from '../store/actions'
import { isOpen, itemsOn, freeBlocks, currentContext, rankedTasks, nextSessionOf } from './planner'
import { dayKey, relDay, daysUntil, fmtDur } from './time'

const nrm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = (s) => nrm(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 3)
const memo = { project: null, subject: null, task: null }
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d) }
const when = (t) => (t.due ? ` — ${relDay(t.due)}${t.dueTime ? ` ${t.dueTime}` : ''}` : '')
const item = (t) => `- ${t.priority === 'alta' ? `**${t.title}**` : t.title}${when(t)}`
const list = (ts, max = 10) => ts.slice(0, max).map(item).join('\n') + (ts.length > max ? `\n- …y ${ts.length - max} más` : '')
const byDue = (a, b) => ((a.due || '9999') + (a.dueTime || '')).localeCompare((b.due || '9999') + (b.dueTime || ''))
const byDone = (a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || ''))
const done = (t) => t.status === 'completada'

function findIn(text, arr, names) {
  const s = nrm(text)
  let best = null, len = 0
  for (const x of arr) for (const n of names(x)) { const k = nrm(n); if (k.length >= 3 && new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(s) && k.length > len) { best = x; len = k.length } }
  return best
}
function findTask(text) {
  const s = nrm(text)
  const exact = findIn(text, state.tasks, (t) => [t.title].filter((x) => String(x).length >= 4))
  if (exact) return exact
  const ws = new Set(words(s))
  let best = null, score = 0
  for (const t of state.tasks) {
    const tw = words(t.title); if (!tw.length) continue
    const hit = tw.filter((w) => ws.has(w)).length / tw.length
    if (hit > score && hit >= 0.6) { best = t; score = hit }
  }
  return best
}
const placeOf = (t) => state.projects.find((p) => p.id === t.projectId)?.name || state.subjects.find((x) => x.id === t.subjectId)?.name

export function localAnswer(text) {
  const s = nrm(text)
  // Preguntas abiertas → IA
  if (/\b(como|por ?que|ayudame a|ideas?|consejo|explica|escribe|redacta|resume|planea|organiza|sugiere|deberia|vale la pena|opinas)\b/.test(s) && !/que (tareas|tengo|hago)|como (me )?(fue|va|ha ido|estuvo|voy|llevo)/.test(s)) return null

  const k = dayKey()
  const open = state.tasks.filter(isOpen)
  const project = findIn(text, state.projects, (p) => [p.name, ...(p.aliases || [])])
  const subject = findIn(text, state.subjects, (x) => [x.name, x.short].filter(Boolean))
  const scope = /\bhoy\b/.test(s) ? 'hoy' : /\bmanana\b/.test(s) ? 'manana' : /\bsemana\b/.test(s) ? 'semana' : /atrasad|vencid|se me paso/.test(s) ? 'atrasadas' : null
  const asksDone = /\b(hice|hecha?s?|termine|terminad[ao]s?|complete|completad[ao]s?|logre|llevo hechas)\b/.test(s)
  if (project) { memo.project = project; memo.subject = null }
  if (subject) { memo.subject = subject; memo.project = null }

  // Descripción / detalle de una tarea
  if (/descripcion|notas?\b|de que (se )?trata|detalle|subtareas?|enlaces?|link|cuentame (mas )?de|que dice/.test(s)) {
    const t = findTask(text) || memo.task
    if (t) {
      memo.task = t
      const sub = (t.subtasks || []).map((x) => `- ${x.done ? '~~' : ''}${x.title}${x.done ? '~~ (hecha)' : ''}`)
      const links = [...(t.url ? [t.url] : []), ...(t.links || []).map((l) => `${l.name ? l.name + ': ' : ''}${l.url}`)]
      return [`**${t.title}**${placeOf(t) ? ` · ${placeOf(t)}` : ''}`,
        `${done(t) ? `Hecha${t.completedAt ? ` el ${t.completedAt}` : ''}` : `Pendiente${when(t)}`}${t.estimate ? ` · ${fmtDur(t.estimate)}` : ''}${t.priority ? ` · prioridad ${t.priority}` : ''}`,
        t.notes ? `\n${t.notes.slice(0, 700)}` : '\nNo tiene descripción. Puedes agregarla tocando la tarea.',
        sub.length ? `\n**Subtareas**\n${sub.join('\n')}` : '',
        links.length ? `\n**Enlaces**\n${links.map((l) => `- ${l}`).join('\n')}` : ''].filter(Boolean).join('\n')
    }
  }

  // Cómo te fue con un hábito (esta semana o el mes)
  if (!/tareas?|pendientes?|vence|entrega/.test(s) && !project && !subject) {
    const habit = findIn(text, state.habits, (h) => [h.name]) || findHabitByWords(s)
    if (habit && (/semana|\bmes\b|como (me )?(fue|va|ha ido|estuvo|voy)|racha|cuantos dias|habito|\bhice\b|he hecho/.test(s) || !scope)) return habitReport(habit, /\bmes\b/.test(s) ? 30 : 7)
  }

  // Lo que ya hiciste
  if (asksDone) {
    const p = project || (!subject && memo.project), sj = subject || (!project && memo.subject)
    let ts = state.tasks.filter(done), where = ''
    if (p) { ts = ts.filter((t) => t.projectId === p.id); where = ` de **${p.name}**` }
    else if (sj) { ts = ts.filter((t) => t.subjectId === sj.id); where = ` de **${sj.name}**` }
    if (scope === 'hoy') { ts = ts.filter((t) => t.completedAt === k); where += ' hoy' }
    else if (scope === 'semana' || (!p && !sj)) { ts = ts.filter((t) => t.completedAt && t.completedAt >= addDays(-7)); where += ' esta semana' }
    ts.sort(byDone)
    return ts.length ? `Ya hiciste ${ts.length}${where}:\n${ts.slice(0, 15).map((t) => `- ${t.title}`).join('\n')}${ts.length > 15 ? `\n- …y ${ts.length - 15} más` : ''}` : `Todavía no hay tareas hechas${where}.`
  }

  // Un proyecto
  if (project) {
    const ts = open.filter((t) => t.projectId === project.id).sort(byDue)
    const n = state.tasks.filter((t) => t.projectId === project.id && done(t)).length
    return `**${project.name}** va en **${projectProgress(project)}%** (${n} hecha${n === 1 ? '' : 's'}, ${ts.length} pendiente${ts.length === 1 ? '' : 's'}).${project.due ? ` Meta: ${relDay(project.due)}.` : ''}\n${ts.length ? list(ts, 12) : 'No tiene tareas pendientes.'}`
  }

  // Una materia
  if (subject) {
    const ts = open.filter((t) => t.subjectId === subject.id).sort(byDue)
    const nx = nextSessionOf(subject.id)
    return `**${subject.name}**${nx ? ` · ${nx.live ? 'en clase ahora' : `próxima sesión ${relDay(nx.date)} ${nx.start || ''}`}` : ''}\n${ts.length ? `Te falta:\n${list(ts)}` : 'Estás al día, sin tareas pendientes.'}`
  }

  // Agenda y clases
  if (/agenda|calendario|evento|clases?|que tengo (hoy|manana)|horario|reunion/.test(s)) {
    const day = scope === 'manana' ? addDays(1) : k
    const it = itemsOn(day)
    return it.length ? `**${scope === 'manana' ? 'Mañana' : 'Hoy'}** tienes:\n${it.map((e) => `- ${e.start ? `${e.start} ` : ''}${e.title}`).join('\n')}` : `${scope === 'manana' ? 'Mañana' : 'Hoy'} no tienes nada en la agenda.`
  }

  if (/libre|disponible|hueco/.test(s)) { const b = freeBlocks(k, currentContext().m); return b.length ? `Hoy tienes libre:\n${b.map((x) => `- ${x.label} (${fmtDur(x.minutes)})`).join('\n')}` : 'Hoy ya no te quedan bloques libres. Descansar también cuenta.' }

  if (/habito/.test(s)) {
    const p = state.habits.filter((h) => !state.habitLogs[h.id]?.[k]?.done)
    return p.length ? `Hoy te ${p.length === 1 ? "falta 1 hábito" : `faltan ${p.length} hábitos`}:\n${p.map((h) => `- ${h.name}`).join('\n')}\nCon uno chiquito ya cuenta.` : '¡Todos tus hábitos de hoy están listos!'
  }

  const mm = s.match(/(\d+)\s*(min|minutos|h\b|horas?)/)
  if (mm) {
    const mins = Number(mm[1]) * (mm[2].startsWith('h') ? 60 : 1)
    const t = rankedTasks().map((r) => r.t).find((x) => ((x.estimate || 30) - (x.spent || 0)) <= mins + 10) || rankedTasks()[0]?.t
    return t ? `Con ${fmtDur(mins)} te recomiendo **${t.title}**${when(t)}. ¿Empezamos?` : 'Con ese tiempo puedes descansar o leer algo de Mi cerebro.'
  }

  // Tareas (por fecha)
  if (/tareas?|pendientes?|vence|entregas?|que tengo|que me falta|atrasad|vencid/.test(s)) {
    const late = open.filter((t) => t.due && t.due < k).sort(byDue)
    if (scope === 'atrasadas') return late.length ? `Tienes ${late.length} atrasada${late.length === 1 ? '' : 's'} (sin culpa, se retoman):\n${list(late)}` : 'No tienes nada atrasado.'
    if (scope === 'hoy' || scope === 'manana') {
      const day = scope === 'hoy' ? k : addDays(1)
      const ts = open.filter((t) => t.due === day).sort(byDue)
      return `${ts.length ? `**${scope === 'hoy' ? 'Hoy' : 'Mañana'}** vence${ts.length === 1 ? '' : 'n'} ${ts.length}:\n${list(ts)}` : `${scope === 'hoy' ? 'Hoy' : 'Mañana'} no vence nada.`}${scope === 'hoy' && late.length ? `\n\nY ${late.length} atrasada${late.length === 1 ? '' : 's'}.` : ''}`
    }
    const week = open.filter((t) => t.due && t.due >= k && daysUntil(t.due) <= 7).sort(byDue)
    const nodate = open.filter((t) => !t.due).length
    return `${week.length ? `**Esta semana** vence${week.length === 1 ? '' : 'n'} ${week.length}:\n${list(week, 12)}` : 'Esta semana no vence nada.'}${late.length ? `\n\nAtrasadas: ${late.length} (pregúntame "¿qué tengo atrasado?").` : ''}${nodate ? `\nSin fecha: ${nodate}.` : ''}`
  }

  if (/que hago|que hacer|ahora que|recomiend/.test(s)) return null // lo resuelve la tarjeta de arriba (shown)
  return null
}

const GENERIC = new Set(['tiempo', 'habito', 'bloque', 'antes', 'mantener', 'minutos', 'hacer', 'diario', 'diaria', 'casa'])
function findHabitByWords(s) {
  const ws = new Set(words(s))
  return state.habits.find((h) => words(h.name).some((w) => !GENERIC.has(w) && ws.has(w))) || null
}
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
function habitReport(h, n) {
  const isGod = /dios/i.test(h.name)
  const did = (key) => !!state.habitLogs[h.id]?.[key]?.done || (isGod && (() => { const e = state.god?.entries?.[key]; return !!(e && (e.talked || e.prayers?.morning || e.prayers?.night)) })())
  const days = Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return { key: dayKey(d), wd: d.getDay() } })
  const count = days.filter((d) => did(d.key)).length
  let streak = 0
  for (let i = 0; ; i++) { const d = new Date(); d.setDate(d.getDate() - i); const key = dayKey(d); if (did(key)) streak++; else if (i > 0 || streak) break; if (i > 400) break }
  const strip = n <= 7 ? `\n${days.map((d) => `${DIAS[d.wd]} ${did(d.key) ? '✓' : '·'}`).join('  ')}` : ''
  const pct = Math.round((count / n) * 100)
  const note = pct >= 80 ? '¡Muy constante!' : pct >= 50 ? 'Vas bien, sin presión.' : count ? 'Cada día que vuelves cuenta.' : 'Hoy es buen día para retomarlo, sin culpa.'
  const godExtra = isGod ? (() => { const es = days.map((d) => state.god?.entries?.[d.key]).filter(Boolean); const g = es.filter((e) => e.grateful).length; return g ? `\nEscribiste en tu Espacio con Dios ${es.length} día${es.length === 1 ? '' : 's'} (${g} con gratitud).` : '' })() : ''
  return `**${h.name}** ${n === 7 ? 'esta semana' : `en los últimos ${n} días`}: **${count} de ${n} días** (${pct}%).${strip}\n${streak ? `Racha actual: ${streak} día${streak === 1 ? '' : 's'}. ` : ''}${note}${godExtra}`
}

export function resetAnswerMemo() { memo.project = memo.subject = memo.task = null }
