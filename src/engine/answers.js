// Respuestas sin IA: la vaquita contesta con tus datos lo que se puede saber directo
// (tareas, agenda, proyectos, materias, hábitos, descripción de una tarea). Gratis, al instante y sin internet.
// Si la pregunta es abierta (cómo, por qué, ideas, redactar…), devuelve null y la responde la IA.
import { state } from '../store'
import { projectProgress } from '../store/actions'
import { isOpen, itemsOn, freeBlocks, currentContext, rankedTasks, nextSessionOf } from './planner'
import { dayKey, relDay, daysUntil, fmtDur } from './time'

const nrm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = (s) => nrm(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 3)
const memo = { project: null, subject: null, task: null, habit: null }
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
const STOP = new Set(['tarea', 'tareas', 'muestrame', 'mostrar', 'abrir', 'abre', 'abrela', 'abrelo', 'puedes', 'para', 'manana', 'semana', 'quiero', 'tengo', 'esta', 'este', 'cuentame', 'descripcion', 'detalle', 'enlace'])
function findTask(text, pool = state.tasks) {
  const s = nrm(text)
  const exact = findIn(text, pool, (t) => [t.title].filter((x) => String(x).length >= 4))
  if (exact) return exact
  const ws = new Set(words(s).filter((w) => !STOP.has(w)))
  let best = null, score = 0
  for (const t of pool) {
    const tw = words(t.title); if (!tw.length) continue
    const hits = tw.filter((w) => ws.has(w)).length
    const sc = hits / tw.length + hits * 0.01
    if (sc > score && (sc >= 0.6 || (pool !== state.tasks && hits))) { best = t; score = sc }
  }
  return best
}
// La tarea de la que se habla: por título, o dentro de la materia/proyecto nombrado (y su fecha)
function pickTask(text, s, { project, subject, scope }) {
  let t = findTask(text)
  if (t) return t
  if (!(project || subject) || !/\btarea\b/.test(s)) return null
  let pool = state.tasks.filter((x) => isOpen(x) && (project ? x.projectId === project.id : x.subjectId === subject.id))
  if (scope === 'hoy') pool = pool.filter((x) => x.due === dayKey())
  if (scope === 'manana') pool = pool.filter((x) => x.due === addDays(1))
  return findTask(text, pool) || (pool.length === 1 ? pool[0] : null)
}
let shown = null // tarea mostrada en la última respuesta (para los botones Abrir / Enlace)
export const shownTask = () => shown
export function taskDetail(t) {
  memo.task = t; shown = t
  const sub = (t.subtasks || []).map((x) => `- ${x.done ? '~~' : ''}${x.title}${x.done ? '~~ (hecha)' : ''}`)
  const links = (t.links || []).map((l) => `- ${l.name || 'Enlace'}`)
  return [`**${t.title}**${placeOf(t) ? ` · ${placeOf(t)}` : ''}`,
    `${done(t) ? `Hecha${t.completedAt ? ` el ${t.completedAt}` : ''}` : `Pendiente${when(t)}`}${t.estimate ? ` · ${fmtDur(t.estimate)}` : ''}${t.priority ? ` · prioridad ${t.priority}` : ''}${t.group ? ' · en grupo (CIPA)' : ''}`,
    t.notes ? `\n${t.notes.slice(0, 700)}` : '\nNo tiene descripción.',
    sub.length ? `\n**Subtareas**\n${sub.join('\n')}` : '',
    links.length ? `\n**Recursos**\n${links.join('\n')}` : ''].filter(Boolean).join('\n')
}

const placeOf = (t) => state.projects.find((p) => p.id === t.projectId)?.name || state.subjects.find((x) => x.id === t.subjectId)?.name

export function localAnswer(text) {
  const s = nrm(text)
  shown = null
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

  // Una tarea: mostrarla, abrirla, su descripción
  const wantsTask = /descripcion|notas?\b|de que (se )?trata|detalle|subtareas?|enlaces?|link|cuentame (mas )?de|que dice|\b(abre|abrir|abrela|abrelo|muestrame|mostrar|ensename|ver)\b/.test(s)
  if (wantsTask || /\bla tarea\b/.test(s)) {
    const t = pickTask(text, s, { project, subject, scope }) || (wantsTask && /\b(abre|abrir|abrela|abrelo|esa|eso|enlace|link|descripcion|notas?)\b/.test(s) ? memo.task : null)
    if (t) return taskDetail(t)
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
const SYN = [[/\b(lei|leyendo|lectura)\b/, /leer|lectura/], [/\b(ore|rece|oracion|devocional|biblia)\b/, /dios|orar|oracion/], [/\b(entrene|ejercite|gym|rutina de ejercicio)\b/, /ejercicio|entren/], [/\b(dormi|me acoste)\b/, /dormir/], [/\b(desperte|me levante|madrugue)\b/, /despertar|levantar/], [/\b(estudie)\b/, /estudio/], [/\b(arregle|ordene|tendi)\b/, /cuarto|ordenar|arreglad/]]
function findHabitByWords(s) {
  for (const [q, h] of SYN) if (q.test(s)) { const x = state.habits.find((y) => h.test(nrm(y.name))); if (x) return x }
  const ws = new Set(words(s))
  return state.habits.find((h) => words(h.name).some((w) => !GENERIC.has(w) && ws.has(w))) || null
}
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
function habitReport(h, n) {
  memo.habit = h
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

export function resetAnswerMemo() { memo.project = memo.subject = memo.task = memo.habit = null }

// "Olvidé decirte que el lunes y el martes sí hice ejercicio" / "cumplí toda la semana" → días a marcar
const WD = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }
const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const lastWd = (wd) => { const t = new Date().getDay(); return (t - wd + 7) % 7 } // cuántos días atrás fue ese día (0 = hoy)
export function habitMarkIntent(text) {
  const s = nrm(text)
  if (/\?|^\s*(que|cuales?|cuantos?|cuantas?|como)\b/.test(s)) return null
  if (!/\b(hice|tuve|cumpli|lei|ore|fui)\b|olvide (marcar|decirte|registrar|ponerl)|\bmarca(r|lo|la|me|los)?\b|ponle check|pon(lo|la|los) (como )?(hech|check)|registra|cumpli|lo hice|la hice/.test(s)) return null
  if (/no (lo |la )?(hice|cumpli|tuve)/.test(s)) return null
  const habit = findIn(text, state.habits, (h) => [h.name]) || findHabitByWords(s) || memo.habit
  const ago = new Set()
  if (/toda la semana|todos los dias|semana completa|toda esta semana/.test(s)) for (let i = 0; i < 7; i++) ago.add(i)
  const lastN = s.match(/ultimos (\d{1,2}) dias/); if (lastN) for (let i = 0; i < Math.min(31, +lastN[1]); i++) ago.add(i)
  if (/\bhoy\b/.test(s)) ago.add(0)
  if (/\bayer\b/.test(s) && !/antes de ayer/.test(s)) ago.add(1)
  if (/antier|anteayer|antes de ayer/.test(s)) ago.add(2)
  const range = s.match(/del? (domingo|lunes|martes|miercoles|jueves|viernes|sabado) (?:al|hasta(?: el)?) (domingo|lunes|martes|miercoles|jueves|viernes|sabado|hoy)/)
  if (range) { const a = lastWd(WD[range[1]]), b = range[2] === 'hoy' ? 0 : lastWd(WD[range[2]]); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) ago.add(i) }
  else for (const [n, wd] of Object.entries(WD)) if (new RegExp(`\\b${n}\\b`).test(s)) ago.add(lastWd(wd))
  const nums = s.match(/\b(?:el|los|dia|dias)\s+((?:\d{1,2}(?:\s*(?:,|y)\s*)?)+)/)
  if (nums) for (const n of nums[1].match(/\d{1,2}/g)) { const d = +n; for (let i = 0; i < 31; i++) if (back(i).getDate() === d) { ago.add(i); break } }
  if (!ago.size) return null
  const days = [...ago].sort((a, b) => b - a).map((i) => dayKey(back(i)))
  if (!habit) return { habit: null, days, text: '¿De cuál hábito? Dime su nombre y lo marco.' }
  memo.habit = habit
  const todo = days.filter((k) => !state.habitLogs[habit.id]?.[k]?.done)
  const fmt = (k) => { const d = new Date(`${k}T12:00`); return `${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()]} ${d.getDate()}` }
  if (!todo.length) return { habit, days: [], text: `**${habit.name}** ya estaba marcado esos días (${days.map(fmt).join(', ')}).` }
  return { habit, days: todo, text: `¿Marco **${habit.name}** como hecho ${todo.length === 1 ? 'el' : 'estos días:'} ${todo.map(fmt).join(', ')}?` }
}

// "Agrega subtareas a T5 Trabajo en CIPAS: ya arranqué, mirar diseño y contenido"
export function subtaskIntent(text) {
  const s = nrm(text)
  if (!/\b(agrega|agregale|agregar|anade|anadele|pon|ponle|crea|creale|mete|metele)\b.*\bsub ?tareas?\b|\bsub ?tareas?\b.*\b(agrega|anade|pon|crea)/.test(s)) return null
  const cut = text.search(/:|\bcomo\b|\bque son\b|\bque\b(?=.*,)/i)
  const head = cut > 0 ? text.slice(0, cut) : text
  const tail = cut > 0 ? text.slice(cut).replace(/^(?:(?::|como|que son|que|por ejemplo)\s*)+/i, '') : ''
  const t = findTask(head) || pickTask(head, nrm(head), { project: findIn(head, state.projects, (p) => [p.name]), subject: findIn(head, state.subjects, (x) => [x.name, x.short].filter(Boolean)), scope: null }) || memo.task
  if (!t) return { task: null, items: [], text: '¿A cuál tarea? Dime su nombre y las subtareas después de dos puntos.' }
  memo.task = t
  const items = tail.split(/\s*(?:,|;|\n|\by\b|\be\b)\s*/i).map((x) => x.trim().replace(/[.]+$/, '')).filter((x) => x.length > 1).slice(0, 15).map((x) => {
    const doneIt = /^ya\b|\b(ya lo hice|listo|hecho)$/i.test(x)
    let title = x.replace(/^ya\s+/i, '').replace(/\s*\((hecha|hecho|listo)\)$/i, '')
    if (/^arranqu[eé]$/i.test(title)) title = 'Arrancar'
    if (/^(dise[nñ]o|contenido)$/i.test(title)) title = `Mirar ${title.toLowerCase()}`
    return { title: title.charAt(0).toUpperCase() + title.slice(1), done: doneIt }
  })
  if (!items.length) return { task: t, items: [], text: `¿Qué subtareas le pongo a **${t.title}**? Escríbelas después de dos puntos, separadas por comas.` }
  return { task: t, items, text: `¿Agrego a **${t.title}**?\n${items.map((x) => `- ${x.title}${x.done ? ' (hecha)' : ''}`).join('\n')}` }
}
