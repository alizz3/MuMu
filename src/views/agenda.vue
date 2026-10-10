<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { itemsOn, freeBlocks, dueOn, rankedTasks, isOpen } from '../engine/planner'
import { dayKey, parseDay, addDays, WEEKDAYS, MONTHS, fmt12s, fmt12, fmtDur, hm, toHM, longDate, relDay, nowMin } from '../engine/time'
import { syncCalendar, canUseBackend } from '../services/api'
import { Icon, Pet } from '../components/ui'
import TaskRow from '../components/TaskRow.vue'
import GroupCard from '../components/GroupCard.vue'
import { inScope } from '../engine/modoU'

const view = ref('dia')
const sel = ref(dayKey())
const selD = computed(() => parseDay(sel.value))
const week = computed(() => { const d = selD.value; const start = addDays(d, -((d.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => addDays(start, i)) })
const TYPES = { clase: ['lav', 'cap'], bloque: ['cream', 'timer'], familia: ['mint', 'heart'], vida: ['mint', 'leaf'], trabajo: ['', 'briefcase'], descanso: ['mint', 'moon'], estudio: ['lav', 'book'], rutina: ['cream', 'routine'], recordatorio: ['pink', 'bell'] }
const timeline = computed(() => {
  const k = sel.value
  const from = k === dayKey() ? nowMin() : null
  const items = itemsOn(k).filter((i) => inScope('event', i)).map((i) => ({ ...i, at: i.allDay ? -1 : hm(i.start) }))
  const free = freeBlocks(k, from).map((b) => ({ id: 'free' + b.start, free: true, at: b.start, ...b }))
  const tasks = [...dueOn(k), ...doneOn(k)].filter((t) => timed(t) && inScope('task', t)).map((t) => ({ id: 'tk' + t.id, task: t, at: hm(t.dueTime) }))
  // Línea de "ahora", como en Google Calendar (solo hoy)
  let now = []
  if (k === dayKey()) {
    const m = nowMin(ui.now)
    const cur = items.find((i) => !i.allDay && hm(i.start) <= m && hm(i.end) > m)
    if (cur) cur.nowPct = Math.round(((m - hm(cur.start)) / (hm(cur.end) - hm(cur.start))) * 100)
    else now = [{ id: 'now', now: true, at: m + 0.5 }]
  }
  return [...items, ...tasks, ...free, ...now].sort((a, b) => a.at - b.at)
})
const suggestion = computed(() => rankedTasks()[0]?.t)
function useFree(b) {
  const t = suggestion.value; if (!t) return
  const len = Math.min(b.minutes, t.estimate - (t.spent || 0), 50)
  t.blocks = [...(t.blocks || []), { date: sel.value, start: toHM(b.start), end: toHM(b.start + Math.max(15, len)), minutes: len, done: false }]
}
const month = computed(() => {
  const d = selD.value, first = new Date(d.getFullYear(), d.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => { const x = addDays(start, i), k = dayKey(x); return { k, d: x.getDate(), out: x.getMonth() !== d.getMonth(), n: itemsOn(k).length + dueOn(k).length + doneOn(k).length } })
})
const listDays = computed(() => Array.from({ length: 14 }, (_, i) => { const k = dayKey(addDays(new Date(), i)); return { k, items: itemsOn(k), due: dueOn(k), done: doneOn(k) } }).filter((x) => x.items.length || x.due.length || x.done.length))
const shift = (n) => { sel.value = dayKey(addDays(selD.value, view.value === 'mes' ? n * 30 : n * 7)) }
// Al tocar un evento o clase se abre su ventanita con la info, quién va, editar o eliminar
const openEv = (i) => { if (i.kind === 'event' || i.kind === 'class') ui.modal = { type: 'eventView', ev: { ...i }, date: sel.value } }
const MARK_TXT = { yo: 'Voy yo', recordatorio: 'Recordatorio', hecho: 'Ya pasó' }
const MARK_ICON = { yo: 'user', otro: 'users', recordatorio: 'pin', hecho: 'check' }
const markText = (m) => m && (m.status === 'otro' ? (m.who ? 'Va ' + m.who : 'Va alguien más') : MARK_TXT[m.status])
const doneBlock = (i) => { const t = state.tasks.find((x) => x.id === i.taskId); const b = t?.blocks.find((x) => x.start === i.start && x.date === sel.value); if (b) b.done = !b.done }
// Tareas del día: las que vencen y las que ya hiciste ese día
const doneOn = (k) => state.tasks.filter((t) => t.status === 'completada' && (t.due ? t.due === k : t.completedAt === k))
const timed = (t) => /^\d{2}:\d{2}$/.test(t.dueTime || '')
const dayTasks = computed(() => { const k = sel.value; const due = dueOn(k).filter((t) => inScope('task', t) && !timed(t)); const done = doneOn(k).filter((t) => inScope('task', t) && !timed(t)); return { due, done, n: due.length + done.length } })
const tasksOpen = computed({ get: () => state.settings.agendaTasksOpen !== false, set: (v) => (state.settings.agendaTasksOpen = v) })
const tasksSub = computed(() => [dayTasks.value.due.length && `${dayTasks.value.due.length} vence${dayTasks.value.due.length === 1 ? '' : 'n'}`, dayTasks.value.done.length && `${dayTasks.value.done.length} hecha${dayTasks.value.done.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ') || 'Nada para este día')
const googleOn = computed(() => state.integrations.google.some((a) => a.services.includes('calendar')))
</script>

<template>
  <div class="stack">
    <div class="seg" role="tablist">
      <button v-for="v in [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['lista', 'Agenda']]" :key="v[0]" :class="{ on: view === v[0] }" role="tab" :aria-selected="view === v[0]" @click="view = v[0]">{{ v[1] }}</button>
    </div>

    <div class="row between">
      <button class="iconbtn" aria-label="Anterior" @click="shift(-1)"><Icon name="back" /></button>
      <div class="b">{{ MONTHS[selD.getMonth()][0].toUpperCase() + MONTHS[selD.getMonth()].slice(1) }} {{ selD.getFullYear() }}</div>
      <div class="row" style="gap:4px">
        <button class="btn sm ghost" @click="sel = dayKey()">Hoy</button>
        <button class="iconbtn" aria-label="Siguiente" @click="shift(1)"><Icon name="chev" /></button>
        <button class="iconbtn" aria-label="Nuevo recordatorio" title="Recordatorio (ej. hay quiz)" @click="ui.modal = { type: 'reminder', prefill: { date: sel, study: true } }"><Icon name="bell" /></button>
        <button class="iconbtn add" aria-label="Nuevo evento" @click="ui.modal = { type: 'event', prefill: { date: sel } }"><Icon name="plus" /></button>
      </div>
    </div>

    <div v-if="view === 'dia' || view === 'semana'" class="days card tight">
      <button v-for="d in week" :key="dayKey(d)" :class="{ on: dayKey(d) === sel }" @click="sel = dayKey(d)">
        {{ WEEKDAYS[d.getDay()] }}<b>{{ d.getDate() }}</b><i v-if="itemsOn(dayKey(d)).length || dueOn(dayKey(d)).length || doneOn(dayKey(d)).length"></i>
      </button>
    </div>

    <!-- Día -->
    <template v-if="view === 'dia'">
      <div class="row between"><h2 style="font-size:16px">{{ longDate(selD) }}</h2>
        <button v-if="googleOn && canUseBackend()" class="btn sm lav" @click="syncCalendar"><Icon name="refresh" :size="14" />Google</button></div>
      <div class="tl">
        <div v-for="i in timeline" :key="i.id" class="tl-row">
          <div class="tl-time" :class="{ 'now-t': i.now }">{{ i.allDay ? 'Todo el día' : fmt12(Math.floor(i.at)) }}</div>
          <div v-if="i.now" class="now-line" role="presentation"><i></i></div>
          <div v-else-if="i.task" class="tl-task" :class="{ hecha: i.task.status === 'completada' }"><TaskRow :task="i.task" compact /></div>
          <div v-else-if="i.free" class="tl-card free">
            <Icon name="sparkles" :size="18" />
            <div class="grow small"><b>Tienes {{ fmtDur(i.minutes) }} libres</b><div class="tiny" v-if="suggestion">Podrías avanzar: {{ suggestion.title }}</div></div>
            <button v-if="suggestion && i.minutes >= 20" class="btn sm lav" @click="useFree(i)">Usar</button>
          </div>
          <div v-else class="tl-card" :class="{ click: i.kind === 'event' || i.kind === 'class', rem: i.type === 'recordatorio', dim: ['otro', 'recordatorio', 'hecho'].includes(i.mark?.status) }" :style="{ borderLeftColor: i.color || (i.type === 'clase' ? 'var(--lav-300)' : i.type === 'bloque' ? 'var(--butter)' : i.type === 'familia' || i.type === 'vida' ? 'var(--mint)' : 'var(--pink-300)'), background: i.type === 'familia' || i.type === 'vida' ? 'color-mix(in srgb, var(--mint) 22%, var(--surface))' : '' }" @click="openEv(i)">
            <span v-if="i.nowPct != null" class="now-over" :style="{ top: i.nowPct + '%' }" :title="fmt12(nowMin(ui.now))"><i></i></span>
            <span class="ico" :class="(TYPES[i.type] || [])[0]" style="width:32px;height:32px"><Icon :name="(TYPES[i.type] || ['', 'calendar'])[1]" :size="16" /></span>
            <div class="grow tl-txt"><div class="small b tl-title" :class="{ 'done-txt': i.done }">{{ i.title }}</div><div class="tiny muted">{{ i.allDay ? 'Todo el día' : i.type === 'recordatorio' ? 'Recordatorio · ' + fmt12s(i.start) : `${fmt12s(i.start)} – ${fmt12s(i.end)}` }}<span v-if="i.calendarName && i.calendarName !== i.account"> · {{ i.calendarName }}</span><span v-if="i.account"> · {{ i.account }}</span><span v-if="i.source === 'rutina'"> · rutina</span></div><span v-if="i.mark" class="badge tl-badge" :class="{ green: i.mark.status === 'otro' || i.mark.status === 'hecho' }"><Icon v-if="MARK_ICON[i.mark.status]" :name="MARK_ICON[i.mark.status]" :size="12" />{{ markText(i.mark) }}</span></div>
            <button v-if="i.kind === 'block'" class="check" :class="{ on: i.done }" aria-label="Bloque hecho" @click.stop="doneBlock(i)"><Icon v-if="i.done" name="check" :size="14" :stroke="3" /></button>
            <button v-if="i.kind === 'block' && !i.done" class="btn sm primary" @click.stop="A.startFocus({ taskId: i.taskId, minutes: hm(i.end) - hm(i.start) }); A.go('enfoque')"><Icon name="play" :size="12" /></button>
          </div>
        </div>
        <div v-if="!timeline.some((x) => !x.now)" class="empty"><Pet pose="sleep" :size="90" /><p>Día terminado. A descansar.</p></div>
      </div>
      <GroupCard v-if="dayTasks.n" title="Tareas del día" :sub="tasksSub" icon="check" color="#F7B6C2" :count="dayTasks.n" :open="tasksOpen" @toggle="tasksOpen = !tasksOpen">
        <div v-if="dayTasks.due.length" class="tiny muted b dt-h"><Icon name="pin" :size="12" />Vence {{ sel === dayKey() ? 'hoy' : 'este día' }}</div>
        <div v-if="dayTasks.due.length" class="list"><TaskRow v-for="t in dayTasks.due" :key="t.id" :task="t" /></div>
        <div v-if="dayTasks.done.length" class="tiny muted b dt-h"><Icon name="check" :size="12" />Ya hecha</div>
        <div v-if="dayTasks.done.length" class="list hecha"><TaskRow v-for="t in dayTasks.done" :key="t.id" :task="t" /></div>
        <button class="btn sm ghost" style="margin-top:8px" @click="ui.modal = { type: 'task', prefill: { due: sel } }"><Icon name="plus" :size="14" />Tarea para este día</button>
      </GroupCard>
    </template>

    <!-- Semana -->
    <template v-if="view === 'semana'">
      <div class="stack" style="gap:8px">
        <div v-for="d in week" :key="dayKey(d)" class="card tight" @click="sel = dayKey(d); view = 'dia'" style="cursor:pointer">
          <div class="row between"><b class="small">{{ WEEKDAYS[d.getDay()] }} {{ d.getDate() }}</b><span class="tiny muted">{{ fmtDur(freeBlocks(dayKey(d)).reduce((a, b) => a + b.minutes, 0)) }} libres</span></div>
          <div class="row wrap" style="gap:4px;margin-top:6px">
            <span v-for="i in itemsOn(dayKey(d))" :key="i.id" class="badge wk-badge" :class="{ pink: i.type !== 'clase', green: i.type === 'familia' || i.type === 'vida', dim: ['otro', 'recordatorio', 'hecho'].includes(i.mark?.status) }">{{ i.allDay ? '' : i.start }} {{ i.title }}</span>
            <span v-for="t in dueOn(dayKey(d))" :key="t.id" class="badge red wk-badge"><Icon name="pin" :size="12" />{{ t.title }}</span>
            <span v-for="t in doneOn(dayKey(d))" :key="t.id" class="badge green wk-badge dim"><Icon name="check" :size="12" />{{ t.title }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Mes -->
    <template v-if="view === 'mes'">
      <div class="card tight">
        <div class="month" style="margin-bottom:4px"><span v-for="w in ['L', 'M', 'M', 'J', 'V', 'S', 'D']" :key="w + Math.random()" class="tiny muted" style="text-align:center">{{ w }}</span></div>
        <div class="month">
          <button v-for="c in month" :key="c.k" class="cell" :class="{ out: c.out, today: c.k === dayKey() }" @click="sel = c.k; view = 'dia'">
            {{ c.d }}<span class="dots"><i v-for="n in Math.min(3, c.n)" :key="n"></i></span>
          </button>
        </div>
      </div>
    </template>

    <!-- Lista -->
    <template v-if="view === 'lista'">
      <div v-for="d in listDays" :key="d.k" class="card">
        <h3 style="margin-bottom:6px">{{ relDay(d.k)[0].toUpperCase() + relDay(d.k).slice(1) }} <span class="muted small">· {{ longDate(parseDay(d.k)) }}</span></h3>
        <div v-for="i in d.items" :key="i.id" class="row small" style="padding:4px 0"><span class="muted" style="width:66px">{{ i.allDay ? 'Todo el día' : fmt12s(i.start) }}</span>{{ i.title }}</div>
        <TaskRow v-for="t in d.due" :key="t.id" :task="t" compact />
        <TaskRow v-for="t in d.done" :key="t.id" :task="t" compact />
      </div>
    </template>
  </div>
</template>
