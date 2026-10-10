<script setup>
function setGrade(t, k, v, max) {
  const n = String(v).replace(',', '.').trim()
  if (n === '') { t[k] = null; return }
  const x = Math.min(max, Math.max(0, +n)); if (isNaN(x)) return
  t[k] = Math.round(x * 10) / 10
}
import { computed, reactive, ref, watch } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { planTask, remaining } from '../engine/planner'
import { dayKey, fmtDur, relDay, shortDate, uid, fmt12s, parseDay, daysUntil, WEEKDAYS_LONG, MONTHS, hm } from '../engine/time'
import { Icon, Pet, Chip } from './ui'
import { goalIcon } from './iconFor'
import Contact from './Contact.vue'
import { toast, ask } from '../engine/game'
import { useDictado, juntar, DICTADO_FALLBACK } from '../services/dictado'

const m = computed(() => ui.modal)
const close = () => (ui.modal = null)

// ---------- formularios genéricos ----------
const opts = (arr, label = 'name') => [{ v: '', l: '— ninguno —' }, ...arr.map((x) => ({ v: x.id, l: x[label] || x.title }))]
const SCHEMAS = {
  task: () => ({
    title: 'Tarea', coll: 'tasks', fields: [
      { k: 'title', l: 'Título', t: 'text', req: true },
      { k: 'notes', l: 'Descripción / notas', t: 'textarea' },
      { k: 'url', l: 'Enlace (Tu Aula, Classroom, Drive…)', t: 'url' },
      { k: 'priority', l: 'Prioridad', t: 'select', o: ['alta', 'media', 'baja'] },
      { k: 'status', l: 'Estado', t: 'select', o: ['pendiente', 'en progreso', 'completada', 'pausada', 'cancelada'] },
      { k: 'due', l: 'Fecha límite', t: 'date' },
      { k: 'dueTime', l: 'Hora límite', t: 'time' },
      { k: 'estimate', l: 'Duración estimada (min)', t: 'number' },
      { k: 'category', l: 'Categoría', t: 'select', o: ['universidad', 'trabajo', 'aprendizaje', 'personal', 'vida', 'familia', 'espiritualidad', 'finanzas'] },
      { k: 'projectId', l: 'Proyecto', t: 'select', o: opts(state.projects) },
      { k: 'goalId', l: 'Objetivo', t: 'select', o: opts(state.goals) },
      { k: 'subjectId', l: 'Materia', t: 'select', o: opts(state.subjects) },
      { k: 'group', l: 'Es en grupo (CIPA)', t: 'bool' },
      { k: 'uploader', l: '¿Quién la sube? (vacío = yo)', t: 'text' },
      { k: 'source', l: 'Fuente', t: 'select', o: ['manual', 'gmail', 'aula', 'classroom', 'calendario', 'proyecto', 'aprendizaje', 'rutina', 'objetivo'] },
      { k: 'tags', l: 'Etiquetas (separadas por coma)', t: 'tags' },
    ],
  }),
  goal: () => ({ title: 'Objetivo', coll: 'goals', fields: [
    { k: 'name', l: 'Nombre', t: 'text', req: true }, { k: 'description', l: 'Descripción', t: 'textarea' },
    { k: 'category', l: 'Categoría', t: 'select', o: ['carrera', 'universidad', 'trabajo', 'dinero', 'aprendizaje', 'inglés', 'vida personal', 'familia', 'espiritualidad', 'proyectos', 'bienestar'] },
    { k: 'due', l: 'Fecha', t: 'date' }, { k: 'progress', l: 'Progreso manual (%)', t: 'number' }, { k: 'manual', l: 'Usar progreso manual', t: 'bool' },
  ] }),
  project: () => ({ title: 'Proyecto', coll: 'projects', fields: [
    { k: 'name', l: 'Nombre', t: 'text', req: true }, { k: 'description', l: 'Descripción', t: 'textarea' },
    { k: 'status', l: 'Estado', t: 'select', o: ['idea', 'plan', 'progreso', 'pausado', 'completado'] },
    { k: 'area', l: 'Área', t: 'select', o: ['carrera', 'freelance', 'personal', 'aprendizaje', 'universidad', 'trabajo'] },
    { k: 'goalId', l: 'Objetivo', t: 'select', o: opts(state.goals) }, { k: 'due', l: 'Fecha', t: 'date' },
    { k: 'skills', l: 'Habilidades (coma)', t: 'tags' }, { k: 'resources', l: 'Recursos / links (coma)', t: 'tags' }, { k: 'color', l: 'Color', t: 'color' },
  ] }),
  habit: () => ({ title: 'Hábito', coll: 'habits', fields: [
    { k: 'name', l: 'Nombre', t: 'text', req: true },
    { k: 'when', l: 'Momento', t: 'select', o: ['mañana', 'tarde', 'noche', 'cualquiera'] },
    { k: 'target', l: 'Días por semana', t: 'number' }, { k: 'gtList', l: 'Lista en Google Tasks (opcional)', t: 'text' }, { k: 'goalId', l: 'Objetivo', t: 'select', o: opts(state.goals) }, { k: 'color', l: 'Color', t: 'color' },
  ] }),
  event: () => ({ title: 'Evento', coll: 'events', fields: [
    { k: 'title', l: 'Título', t: 'text', req: true }, { k: 'date', l: 'Fecha', t: 'date', req: true },
    { k: 'start', l: 'Inicio', t: 'time', req: true }, { k: 'end', l: 'Fin', t: 'time', req: true },
    { k: 'type', l: 'Tipo', t: 'select', o: ['evento', 'clase', 'estudio', 'trabajo', 'familia', 'vida', 'descanso', 'rutina'] },
    { k: 'recurring', l: 'Repetir los días', t: 'weekdays' },
  ] }),
  resource: () => ({ title: 'Aprendizaje', coll: 'resources', fields: [
    { k: 'type', l: 'Tipo', t: 'select', o: ['libro', 'podcast', 'video', 'conferencia', 'nota', 'idea'] },
    { k: 'title', l: 'Título', t: 'text', req: true }, { k: 'author', l: 'Autor / fuente', t: 'text' },
    { k: 'status', l: 'Estado', t: 'select', o: ['pendiente', 'leyendo', 'escuchando', 'viendo', 'leído', 'activo'] },
    { k: 'progress', l: 'Progreso (%)', t: 'number' }, { k: 'concepts', l: 'Conceptos (coma)', t: 'tags' }, { k: 'notes', l: 'Notas e ideas', t: 'textarea' },
  ] }),
  principle: () => ({ title: 'Principio', coll: 'principles', fields: [
    { k: 'text', l: 'Principio (en tus palabras)', t: 'text', req: true }, { k: 'author', l: 'De quién', t: 'text' },
    { k: 'sourceId', l: 'Fuente', t: 'select', o: opts(state.resources, 'title') }, { k: 'action', l: 'Acción concreta', t: 'text' },
    { k: 'tags', l: 'Cuándo aplica (coma: procrastinación, mañana, límites…)', t: 'tags' },
    { k: 'status', l: 'Estado', t: 'select', o: ['idea', 'probando', 'validado', 'descartado'] },
  ] }),
  subject: () => ({ title: 'Materia', coll: 'subjects', fields: [
    { k: 'name', l: 'Nombre', t: 'text', req: true }, { k: 'short', l: 'Nombre corto', t: 'text' },
    { k: 'institution', l: 'Institución', t: 'select', o: ['UT', 'Classroom', 'Otra'] }, { k: 'teacher', l: 'Docente', t: 'text' }, { k: 'url', l: 'Enlace del curso (Tu Aula, Classroom…)', t: 'url' },
    { k: 'teacherEmail', l: 'Correo del docente (sus correos salen como importantes)', t: 'text' }, { k: 'teacherPhone', l: 'Celular del docente', t: 'text' }, { k: 'projectId', l: 'Semestre (proyecto)', t: 'select', o: opts(state.projects.filter((p) => p.area === 'universidad')) },
    { k: 'color', l: 'Color', t: 'color' }, { k: 'schedule', l: 'Horario', t: 'schedule' }, { k: 'notes', l: 'Notas y recursos', t: 'textarea' },
    { k: 'cipa', l: 'Mi CIPA (nombre del grupo)', t: 'text' }, { k: 'cipaMembers', l: 'Integrantes de la CIPA (uno por línea: Nombre · celular)', t: 'textarea' },
    { k: 'cipaLink', l: 'Grupo de WhatsApp de la CIPA (enlace)', t: 'url' },
  ] }),
  course: () => ({ title: 'Curso', coll: 'courses', fields: [
    { k: 'title', l: 'Curso', t: 'text', req: true }, { k: 'platform', l: 'Plataforma', t: 'text' }, { k: 'skill', l: 'Habilidad', t: 'text' },
    { k: 'progress', l: 'Progreso (%)', t: 'number' }, { k: 'hours', l: 'Horas', t: 'number' },
    { k: 'status', l: 'Estado', t: 'select', o: ['pendiente', 'en curso', 'completado'] },
    { k: 'goalId', l: 'Objetivo', t: 'select', o: opts(state.goals) }, { k: 'projectId', l: 'Proyecto donde lo practico', t: 'select', o: opts(state.projects) },
    { k: 'practice', l: 'Práctica real', t: 'text' },
  ] }),
  life: () => ({ title: 'Momento de vida', coll: 'life', fields: [
    { k: 'title', l: '¿Qué hiciste?', t: 'text', req: true }, { k: 'type', l: 'Tipo', t: 'select', o: ['familia', 'padres', 'mascotas', 'descanso', 'salir', 'música', 'películas', 'ocio', 'social', 'momento importante'] },
    { k: 'date', l: 'Fecha', t: 'date' }, { k: 'start', l: 'Desde (opcional)', t: 'time' }, { k: 'end', l: 'Hasta (opcional)', t: 'time' },
    { k: 'minutes', l: 'O cuántos minutos', t: 'number' }, { k: 'feeling', l: '¿Cómo te sentiste? (1–5)', t: 'number' },
    { k: 'photos', l: 'Fotos (enlace a Google Fotos o al álbum)', t: 'url' }, { k: 'note', l: 'Nota', t: 'textarea' },
  ] }),
}

const form = reactive({})
const schema = computed(() => (m.value && SCHEMAS[m.value.type] ? SCHEMAS[m.value.type]() : null))
const editing = computed(() => !!(m.value?.id && schema.value))
const editMode = ref(false)
watch(m, (v) => {
  Object.keys(form).forEach((k) => delete form[k])
  editMode.value = !!v?.edit || (!v?.id && !!schema.value)
  if (!v || !schema.value) return
  const ex = v.id ? state[schema.value.coll].find((x) => x.id === v.id) : null
  const base = { ...(v.prefill || {}) }
  schema.value.fields.forEach((f) => {
    let val = ex ? ex[f.k] : base[f.k]
    if (f.t === 'tags') val = (val || []).join(', ')
    if (f.t === 'schedule') val = JSON.parse(JSON.stringify(val || []))
    if (f.t === 'weekdays') val = [...(val || [])]
    form[f.k] = val ?? (f.t === 'select' && Array.isArray(f.o) && typeof f.o[0] === 'string' ? f.o[0] : f.t === 'date' && f.k === 'date' ? dayKey() : '')
  })
})

function save() {
  const sc = schema.value
  for (const f of sc.fields) if (f.req && !form[f.k]) return toast(`Falta: ${f.l}`)
  const data = {}
  let bad = null
  sc.fields.forEach((f) => {
    let v = form[f.k]
    if (f.t === 'tags') v = String(v || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (f.t === 'number') v = v === '' || v == null ? null : Number(v)
    if (f.t === 'select' && v === '') v = null
    if (f.t === 'date' && !v) v = null
    if (f.t === 'time' && !v) v = null
    if (f.t === 'url') { v = String(v || '').trim(); if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v; if (v && !/^https?:\/\/[^\s]+$/i.test(v)) return (bad = f.l); v = v || null }
    data[f.k] = v
  })
  if (bad) return toast(`Revisa el enlace: ${bad}`)
  // Momento con rango de horas: los minutos salen solos (si pasó la medianoche, también)
  if (sc.coll === 'life' && data.start && data.end) { let m = hm(data.end) - hm(data.start); if (m <= 0) m += 1440; data.minutes = m }
  if (sc.coll === 'life' && data.feeling != null) data.feeling = Math.min(5, Math.max(1, data.feeling))
  if (m.value.id) {
    const rec = state[sc.coll].find((x) => x.id === m.value.id)
    if ('url' in data && (data.url || null) !== (rec.url || null)) data.urlManual = true
    if ('dueTime' in data) { data.dueTime = data.dueTime || null; if (data.dueTime !== (rec.dueTime || null)) data.dueTimeManual = true }
    Object.assign(rec, data)
    editMode.value = false
    if (m.value.type !== 'task') close()
  } else {
    if (sc.coll === 'tasks') A.addTask(data)
    else if (sc.coll === 'events') A.addEvent(data)
    else if (sc.coll === 'resources') A.addResource(data)
    else if (sc.coll === 'principles') A.addPrinciple(data)
    else if (sc.coll === 'life') A.addLife(data)
    else if (sc.coll === 'habits') { const h = { id: uid('h'), target: 7, ...data }; state.habits.push(h); state.habitLogs[h.id] = {} }
    else if (sc.coll === 'courses') state.courses.unshift({ id: uid('c'), sessions: [], ...data })
    else state[sc.coll].unshift({ id: uid(sc.coll[0]), ...data, ...(sc.coll === 'subjects' ? { schedule: data.schedule || [] } : {}) })
    close()
  }
}
async function remove() {
  const sc = schema.value
  if (!(await ask('¿Eliminar? No se puede deshacer.'))) return
  // Las tareas se borran por la acción común, para que también se borren en Google Tasks
  if (sc.coll === 'tasks') A.deleteTask(m.value.id)
  else state[sc.coll] = state[sc.coll].filter((x) => x.id !== m.value.id)
  close()
}

// ---------- detalle de tarea ----------
// Evento abierto desde la agenda (incluye las marcas de "quién va")
const ev = computed(() => (m.value?.type === 'eventView' ? m.value.ev : null))
const evKey = computed(() => (ev.value ? `${ev.value.id}|${m.value.date}` : ''))
const evMark = computed(() => (evKey.value ? state.eventMarks?.[evKey.value] || null : null))
const evDate = computed(() => { if (!m.value?.date) return ''; const d = parseDay(m.value.date); return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}` })
const MARKS = [['yo', 'Voy yo', 'user'], ['otro', 'Va alguien más', 'users'], ['recordatorio', 'Solo recordatorio', 'pin'], ['hecho', 'Ya pasó', 'check']]
const who = ref('')
watch(evKey, () => { who.value = evMark.value?.who || '' }, { immediate: true })
function setMark(status) {
  state.eventMarks ||= {}
  if (evMark.value?.status === status) delete state.eventMarks[evKey.value]
  else state.eventMarks[evKey.value] = { status, who: status === 'otro' ? who.value.trim() : '', at: dayKey() }
}
function saveWho() { if (evMark.value?.status === 'otro') state.eventMarks[evKey.value] = { ...evMark.value, who: who.value.trim() } }
async function delEvent() { if (await ask(`¿Eliminar "${ev.value.title}" de tu agenda?`)) { A.deleteEvent(ev.value.id); close() } }
const task = computed(() => (m.value?.type === 'task' && m.value.id ? state.tasks.find((t) => t.id === m.value.id) : null))
// Enlace a la plataforma: el de la tarea, o el de la actividad de origen, o al menos la plataforma
function dueText(t) {
  if (!t.due) return 'Sin fecha límite'
  const d = parseDay(t.due), n = daysUntil(t.due)
  const hora = /^\d{2}:\d{2}$/.test(t.dueTime || '') ? ` a las ${fmt12s(t.dueTime)}` : ''
  const cuando = n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : n < 0 ? `hace ${-n} días` : `en ${n} días`
  return `${n < 0 ? 'Venció' : 'Vence'} el ${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}${hora} (${cuando})`
}
const SRC_NAME = { classroom: 'Classroom', gmail: 'Gmail', aula: 'Tu Aula', gtasks: 'Google Tasks' }
const linkLabel = computed(() => {
  const l = taskLink.value, t = task.value; if (!l || !t) return ''
  if (t.urlManual && t.url) return 'Abrir enlace'
  const src = SRC_NAME[l.src] || (/tasks\.google\.com/.test(l.url) ? 'Google Tasks' : /drive|docs\.google/.test(l.url) ? 'Drive' : null)
  return src ? `${l.generic ? 'Ir a' : 'Abrir en'} ${src}` : 'Abrir enlace'
})
const taskLink = computed(() => {
  const t = task.value; if (!t) return null
  if (t.urlManual && t.url) return { url: t.url, src: t.source }
  const a = state.aula.find((x) => x.taskId === t.id)
  const src = t.source || a?.source
  const url = t.url || a?.url
  if (url) return { url, src }
  const crAcc = state.integrations.google.find((g) => g.services.includes('classroom'))?.email
  if (src === 'classroom') return { url: `https://classroom.google.com/${crAcc ? '?authuser=' + encodeURIComponent(crAcc) : ''}`, src, generic: true }
  if (src === 'aula') return { url: `${(state.integrations.aula.site || 'https://tuaulavirtual.ut.edu.co').replace(/\/$/, '')}/calendar/view.php?view=upcoming`, src, generic: true }
  return null
})
const chain = computed(() => {
  const t = task.value; if (!t) return []
  const out = []
  const s = state.subjects.find((x) => x.id === t.subjectId); if (s) out.push({ icon: 'cap', text: s.name })
  const p = state.projects.find((x) => x.id === t.projectId); if (p) out.push({ icon: 'folder', text: p.name })
  const g = state.goals.find((x) => x.id === (t.goalId || p?.goalId)); if (g) out.push({ icon: goalIcon(g), text: g.name })
  return out
})
const plan = computed(() => (task.value ? planTask(task.value) : []))
const newSub = ref('')
function addSub() { if (newSub.value.trim()) { A.addSubtask(task.value.id, newSub.value.trim()); newSub.value = '' } }
function start(minutes, mode = 'pomodoro') { A.startFocus({ taskId: task.value.id, minutes, mode }); close(); A.go('enfoque') }

// ---------- búsqueda / captura rápida ----------
const q = ref('')
const results = computed(() => {
  const s = q.value.trim().toLowerCase(); if (s.length < 2) return []
  const r = []
  state.tasks.forEach((x) => x.title.toLowerCase().includes(s) && r.push({ k: 'Tarea', t: x.title, open: () => (ui.modal = { type: 'task', id: x.id }) }))
  state.projects.forEach((x) => x.name.toLowerCase().includes(s) && r.push({ k: 'Proyecto', t: x.name, open: () => { close(); A.go('proyectos', { id: x.id }) } }))
  state.goals.forEach((x) => x.name.toLowerCase().includes(s) && r.push({ k: 'Objetivo', t: x.name, open: () => { close(); A.go('objetivos') } }))
  state.resources.forEach((x) => (x.title + x.notes).toLowerCase().includes(s) && r.push({ k: x.type, t: x.title, open: () => { close(); A.go('cerebro') } }))
  state.principles.forEach((x) => x.text.toLowerCase().includes(s) && r.push({ k: 'Principio', t: x.text, open: () => { close(); A.go('experimentos') } }))
  state.notes.forEach((x) => x.text.toLowerCase().includes(s) && r.push({ k: 'Nota', t: x.text.slice(0, 60), open: () => { close(); A.go('cerebro') } }))
  return r.slice(0, 12)
})
function quick(kind) {
  const text = q.value.trim(); if (!text) return
  if (kind === 'task') { const t = A.addTask({ title: text }); ui.modal = { type: 'task', id: t.id, edit: true } }
  if (kind === 'note') { state.notes.unshift({ id: uid('n'), text, date: dayKey() }); close() }
  q.value = ''
}

const SCHED_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const prettyVal = (f, v) => {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '—'
  if (f.t === 'select' && Array.isArray(f.o) && typeof f.o[0] === 'object') return f.o.find((o) => o.v === v)?.l || '—'
  if (f.t === 'date') return `${shortDate(v)} (${relDay(v)})`
  if (Array.isArray(v)) return v.join(', ')
  return v
}
// Dictar en vez de escribir (título de tareas y captura rápida)
const dict = useDictado()
function talk(id, set) { if (!dict.supported) return toast(DICTADO_FALLBACK); dict.toggle(id, set) }
// CIPA de la materia: nombre, integrantes (Nombre · celular) y enlace del grupo
function cipaOf(t) {
  const sj = state.subjects.find((x) => x.id === t?.subjectId)
  if (!sj) return null
  const members = String(sj.cipaMembers || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const phone = (l.match(/\+?\d[\d\s-]{6,}\d/) || [''])[0].replace(/[\s-]/g, '')
    return { name: l.replace(phone ? l.match(/\+?\d[\d\s-]{6,}\d/)[0] : '', '').replace(/[·,\-–|:]+\s*$/, '').trim() || 'Integrante', phone }
  })
  return { name: sj.cipa || '', members, link: sj.cipaLink || '' }
}
</script>

<template>
  <div v-if="m" class="scrim" @click.self="close">
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="grab"></div>

      <!-- Búsqueda y captura rápida -->
      <template v-if="m.type === 'search'">
        <h2 style="margin-bottom:10px">Buscar o capturar</h2>
        <div class="row" style="gap:6px"><input class="input grow" v-model="q" placeholder="Escribe o dicta una tarea, idea o busca algo…" autofocus aria-label="Buscar o capturar" @keyup.enter="quick('task')" />
          <button type="button" class="iconbtn" :class="{ on: dict.active.value === 'q' }" :aria-label="dict.active.value === 'q' ? 'Dejar de dictar' : 'Dictar'" @click="talk('q', (t) => (q = juntar(q, t)))"><Icon name="mic" :size="18" /></button></div>
        <div class="row" style="margin:10px 0">
          <button class="btn sm primary" :disabled="!q.trim()" @click="quick('task')"><Icon name="plus" :size="15" />Crear tarea</button>
          <button class="btn sm lav" :disabled="!q.trim()" @click="quick('note')"><Icon name="brain" :size="15" />Guardar en Mi cerebro</button>
        </div>
        <div class="list">
          <button v-for="(r, i) in results" :key="i" class="item" style="all:unset;display:flex;gap:10px;padding:10px 2px;border-bottom:1px solid var(--line);cursor:pointer" @click="r.open()">
            <span class="badge">{{ r.k }}</span><span class="grow title-line">{{ r.t }}</span><Icon name="chev" :size="16" />
          </button>
        </div>
        <div class="grid3" style="margin-top:12px">
          <button class="btn sm ghost" @click="ui.modal = { type: 'event' }">+ Evento</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'resource' }">+ Aprendizaje</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'life' }">+ Momento</button>
        </div>
      </template>

      <!-- Detalle de tarea -->
      <!-- Detalle de evento: info, quién va, editar o eliminar -->
      <template v-else-if="m.type === 'eventView' && ev">
        <div class="row between">
          <span class="badge" :class="{ pink: ev.kind === 'event' }">{{ ev.kind === 'class' ? 'Clase' : ev.readonly ? (ev.calendarName || 'Google Calendar') : 'Evento' }}</span>
          <button class="iconbtn" aria-label="Cerrar" @click="close"><Icon name="x" :size="18" /></button>
        </div>
        <h2 style="margin:8px 0 4px;overflow-wrap:anywhere">{{ ev.title }}</h2>
        <div class="stack small muted" style="gap:2px">
          <span class="wi"><Icon name="calendar" :size="14" />{{ evDate }}</span>
          <span class="wi"><Icon name="clock" :size="14" />{{ ev.allDay ? 'Todo el día' : `${fmt12s(ev.start)} – ${fmt12s(ev.end)}` }}</span>
          <span v-if="ev.location" class="wi" style="overflow-wrap:anywhere"><Icon name="pin" :size="14" />{{ ev.location }}</span>
          <span v-if="ev.account" class="wi" style="overflow-wrap:anywhere"><Icon name="user" :size="14" />{{ ev.account }}</span>
        </div>
        <p v-if="ev.description || ev.notes" class="small" style="margin-top:8px;white-space:pre-line;overflow-wrap:anywhere">{{ ev.description || ev.notes }}</p>
        <template v-if="ev.kind === 'event'">
          <h3 style="margin-top:14px">¿Quién va?</h3>
          <div class="row wrap" style="margin-top:6px;gap:6px"><button v-for="mk in MARKS" :key="mk[0]" class="chip" :class="{ on: evMark?.status === mk[0] }" @click="setMark(mk[0])"><Icon :name="mk[2]" :size="14" />{{ mk[1] }}</button></div>
          <div v-if="evMark?.status === 'otro'" class="row" style="margin-top:8px"><input class="input" v-model="who" placeholder="¿Quién? ej. mi prima" aria-label="Quién va" @change="saveWho" @keyup.enter="saveWho" /></div>
          <p class="tiny muted" style="margin-top:6px">Si va alguien más o es solo un recordatorio, no te quita tiempo libre.</p>
        </template>
        <div class="row wrap" style="gap:8px;margin-top:14px">
          <a v-if="ev.url" class="btn sm lav" :href="ev.url" target="_blank" rel="noopener"><Icon name="link" :size="14" />{{ ev.readonly ? 'Editar en Google Calendar' : 'Abrir' }}</a>
          <button v-if="ev.kind === 'event' && !ev.readonly" class="btn sm ghost" @click="ui.modal = { type: 'event', id: ev.id }"><Icon name="edit" :size="14" />Editar</button>
          <button v-if="ev.kind === 'event' && !ev.readonly" class="btn sm ghost" @click="delEvent"><Icon name="trash" :size="14" />Eliminar</button>
          <button v-if="ev.kind === 'class'" class="btn sm ghost" @click="close(); A.go('universidad')">Ver materia</button>
        </div>
        <p v-if="ev.readonly" class="tiny muted" style="margin-top:8px">Este evento viene de Google Calendar: se edita o elimina allá y MuMu lo actualiza al sincronizar.</p>
      </template>

      <template v-else-if="task && !editMode">
        <div class="row between">
          <span class="badge pink">{{ task.status }}</span>
          <div class="row" style="gap:4px">
            <button class="iconbtn" aria-label="Editar" @click="editMode = true"><Icon name="edit" :size="18" /></button>
            <button class="iconbtn" aria-label="Cerrar" @click="close"><Icon name="x" :size="18" /></button>
          </div>
        </div>
        <h2 style="margin:8px 0 4px">{{ task.title }}</h2>
        <div class="stack small muted" style="gap:2px">
          <span class="wi"><Icon name="calendar" :size="14" />{{ dueText(task) }}</span>
          <span v-if="task.estimate" class="wi"><Icon name="timer" :size="14" />{{ task.spent ? `Llevas ${fmtDur(task.spent)} de unas ${fmtDur(task.estimate)}` : `Te puede tomar unas ${fmtDur(task.estimate)}` }}</span>
          <span v-if="task.postponed" class="wi"><Icon name="refresh" :size="14" />La has pospuesto {{ task.postponed }} {{ task.postponed === 1 ? 'vez' : 'veces' }}</span>
          <span v-if="task.demo" class="badge demo">ejemplo</span>
        </div>
        <div v-if="chain.length" class="row wrap" style="gap:6px;margin-top:10px">
          <span v-for="(c, i) in chain" :key="i" class="badge"><Icon :name="c.icon" :size="13" />{{ c.text }}</span>
        </div>
        <p v-if="task.notes && !/^Materia: [^\n]*$/.test(task.notes)" class="small" style="margin-top:10px;white-space:pre-line">{{ task.notes }}</p>
        <div v-if="task.subjectId || task.category === 'universidad'" class="card tight soft row wrap" style="gap:8px;margin-top:10px">
          <b class="small wi"><Icon name="target" :size="14" />Nota</b>
          <input class="input" type="number" min="0" max="5" step="0.1" inputmode="decimal" placeholder="0.0 – 5.0" style="width:110px" :value="task.grade ?? ''" @change="setGrade(task, 'grade', $event.target.value, 5)" aria-label="Nota de la tarea" />
          <span class="small muted">vale</span>
          <input class="input" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="%" style="width:80px" :value="task.weight ?? ''" @change="setGrade(task, 'weight', $event.target.value, 100)" aria-label="Porcentaje que vale" />
          <span class="small muted">%</span>
        </div>
        <a v-if="taskLink" class="btn sm lav" style="margin-top:10px" :href="taskLink.url" target="_blank" rel="noopener"><Icon name="link" :size="14" />{{ linkLabel }}</a>

        <!-- En grupo (CIPA) -->
        <div v-if="task.subjectId || task.category === 'universidad'" class="card tight soft stack" style="gap:8px;margin-top:10px">
          <label class="row small" style="gap:8px"><input type="checkbox" :checked="!!task.group" @change="task.group = $event.target.checked" /><b class="wi"><Icon name="users" :size="14" />En grupo{{ cipaOf(task)?.name ? ' · ' + cipaOf(task).name : ' (CIPA)' }}</b></label>
          <template v-if="task.group">
            <div v-if="cipaOf(task)?.members.length" class="row wrap" style="gap:4px 12px">
              <Contact v-for="mb in cipaOf(task).members" :key="mb.name" class="small" :value="mb.phone || mb.name" kind="phone" :label="mb.name" :text="`Hola ${mb.name.split(' ')[0]}, sobre «${task.title}»: `" />
            </div>
            <p v-else class="tiny muted" style="margin:0">Agrega los integrantes de tu CIPA editando la materia.</p>
            <div class="row wrap" style="gap:6px;align-items:center">
              <span class="small">La sube:</span>
              <select class="input" style="width:auto;padding:6px 10px" :value="task.uploader || ''" @change="task.uploader = $event.target.value || null" aria-label="Quién la sube">
                <option value="">Yo</option>
                <option v-for="mb in cipaOf(task)?.members || []" :key="mb.name" :value="mb.name">{{ mb.name }}</option>
                <option v-if="task.uploader && !(cipaOf(task)?.members || []).some((mb) => mb.name === task.uploader)" :value="task.uploader">{{ task.uploader }}</option>
              </select>
              <a v-if="cipaOf(task)?.link" class="btn sm ghost" :href="cipaOf(task).link" target="_blank" rel="noopener"><Icon name="chat" :size="14" />Grupo</a>
            </div>
            <button v-if="task.uploader && task.status !== 'completada'" class="btn sm lav" style="align-self:flex-start" @click="task.notes = `${task.notes ? task.notes + '\n' : ''}La subió ${task.uploader} (CIPA).`; A.completeTask(task.id)"><Icon name="check" :size="14" />Ya la subió {{ task.uploader.split(' ')[0] }}</button>
          </template>
        </div>

        <div class="card tight soft" style="margin-top:14px">
          <div class="small b" style="margin-bottom:6px">Subtareas</div>
          <label v-for="s in task.subtasks" :key="s.id" class="row small" style="padding:4px 0">
            <input type="checkbox" :checked="s.done" @change="A.toggleSubtask(task.id, s.id)" /> <span :class="{ 'done-txt': s.done }">{{ s.title }}</span>
          </label>
          <div class="row" style="margin-top:6px"><input class="input" v-model="newSub" placeholder="Dividir en un pasito…" @keyup.enter="addSub" aria-label="Nueva subtarea" /><button class="btn sm lav" @click="addSub">+</button></div>
        </div>

        <div v-if="plan.length && task.status !== 'completada'" class="card tight" style="margin-top:10px">
          <div class="small b">Bloques sugeridos para terminarla a tiempo</div>
          <div v-for="(b, i) in plan" :key="i" class="tiny muted" style="margin-top:4px">• {{ relDay(b.date) }} {{ b.start }}–{{ b.end }} ({{ b.minutes }} min)</div>
          <button class="btn sm lav" style="margin-top:8px" @click="A.scheduleTask(task.id)"><Icon name="calendar" :size="15" />Agendar estos bloques</button>
        </div>

        <div class="grid2" style="margin-top:14px">
          <button class="btn primary" @click="start(25)"><Icon name="play" :size="16" />Empezar 25 min</button>
          <button class="btn lav" @click="start(5, 'empezar')"><Icon name="sprout" :size="16" />Solo 5 min</button>
          <button class="btn ghost" @click="A.postponeTask(task.id); close()">Posponer</button>
          <button v-if="task.status !== 'completada'" class="btn ghost" @click="A.completeTask(task.id); close()"><Icon name="check" :size="16" />Completar</button>
          <button v-else class="btn ghost" @click="A.reopenTask(task.id)">Reabrir</button>
        </div>
      </template>

      <!-- Formularios -->
      <template v-else-if="schema">
        <div class="row between" style="margin-bottom:12px">
          <h2>{{ m.id ? 'Editar' : 'Nuevo' }}: {{ schema.title.toLowerCase() }}</h2>
          <button class="iconbtn" aria-label="Cerrar" @click="close"><Icon name="x" :size="18" /></button>
        </div>
        <form class="stack" @submit.prevent="save">
          <label v-for="f in schema.fields" :key="f.k" class="field">
            <span>{{ f.l }}</span>
            <textarea v-if="f.t === 'textarea'" class="input" v-model="form[f.k]"></textarea>
            <select v-else-if="f.t === 'select'" class="input" v-model="form[f.k]">
              <option v-for="o in f.o" :key="typeof o === 'string' ? o : o.v" :value="typeof o === 'string' ? o : o.v">{{ typeof o === 'string' ? o : o.l }}</option>
            </select>
            <input v-else-if="f.t === 'bool'" type="checkbox" v-model="form[f.k]" style="width:22px;height:22px" />
            <div v-else-if="f.t === 'weekdays'" class="chips">
              <Chip v-for="(d, i) in SCHED_DAYS" :key="i" :active="(form[f.k] || []).includes(i)" @click.prevent="form[f.k] = (form[f.k] || []).includes(i) ? form[f.k].filter((x) => x !== i) : [...(form[f.k] || []), i]">{{ d }}</Chip>
            </div>
            <div v-else-if="f.t === 'schedule'" class="stack" style="gap:6px">
              <div v-for="(sl, i) in form[f.k]" :key="i" class="row">
                <select class="input" v-model.number="sl.weekday" aria-label="Día"><option v-for="(d, j) in SCHED_DAYS" :key="j" :value="j">{{ d }}</option></select>
                <input class="input" type="time" v-model="sl.start" aria-label="Inicio" /><input class="input" type="time" v-model="sl.end" aria-label="Fin" />
                <button class="iconbtn" type="button" aria-label="Quitar" @click.prevent="form[f.k].splice(i, 1)"><Icon name="x" :size="16" /></button>
              </div>
              <button class="btn sm ghost" type="button" @click.prevent="form[f.k].push({ weekday: 0, start: '08:00', end: '10:00' })">+ Agregar horario</button>
            </div>
            <div v-else-if="f.k === 'title' || f.k === 'name'" class="row" style="gap:6px"><input class="input grow" type="text" v-model="form[f.k]" />
              <button type="button" class="iconbtn" :class="{ on: dict.active.value === f.k }" :aria-label="dict.active.value === f.k ? 'Dejar de dictar' : 'Dictar'" @click.prevent="talk(f.k, (t) => (form[f.k] = juntar(form[f.k], t)))"><Icon name="mic" :size="18" /></button></div>
            <input v-else class="input" :type="{ number: 'number', date: 'date', time: 'time', color: 'color' }[f.t] || 'text'" v-model="form[f.k]" :inputmode="f.t === 'url' ? 'url' : undefined" :placeholder="f.t === 'url' ? 'https://…' : undefined" />
          </label>
          <div class="row" style="margin-top:6px">
            <button v-if="m.id" type="button" class="btn ghost" @click="remove"><Icon name="trash" :size="16" />Eliminar</button>
            <span class="grow"></span>
            <button v-if="m.id && m.type === 'task'" type="button" class="btn ghost" @click="editMode = false">Cancelar</button>
            <button type="submit" class="btn primary">Guardar</button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
