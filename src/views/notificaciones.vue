<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import { go, openAulaTask } from '../store/actions'
import { ask, toast } from '../engine/game'
import { MONTHS, WEEKDAYS_LONG, fmt12s, toHM } from '../engine/time'
import { Empty, Icon } from '../components/ui'
import { stripEmoji } from '../components/iconFor'
import Seg from '../components/Seg.vue'
import ListBar from '../components/ListBar.vue'
import GroupCard from '../components/GroupCard.vue'

// Agrupadas como en Facebook: Hoy, Ayer, Esta semana, Antes
const startOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
const today = () => startOf(Date.now())
function group(iso) {
  const t = new Date(iso).getTime(), d0 = today()
  if (t >= d0) return 'Hoy'
  if (t >= d0 - 86400e3) return 'Ayer'
  if (t >= d0 - 6 * 86400e3) return 'Esta semana'
  return 'Antes'
}
function ago(iso) {
  const d = new Date(iso), m = Math.round((Date.now() - d) / 60000)
  const hora = fmt12s(toHM(d.getHours() * 60 + d.getMinutes()))
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const g = group(iso)
  if (g === 'Hoy') { const h = Math.round(m / 60); return `hace ${h} ${h === 1 ? 'hora' : 'horas'}` }
  if (g === 'Ayer') return `ayer a las ${hora}`
  if (g === 'Esta semana') return `el ${WEEKDAYS_LONG[d.getDay()]} a las ${hora}`
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`
}
// Filtro (Todas / Sin leer) y grupos plegables, como en Tareas
const filt = computed({ get: () => state.settings.notifFilter || 'todas', set: (v) => (state.settings.notifFilter = v) })
const shown = computed(() => state.notifications.filter((n) => filt.value === 'todas' || !n.read))
const GMETA = { Hoy: { icon: 'sun', color: '#FFE29A' }, Ayer: { icon: 'clock', color: '#F7B6C2' }, 'Esta semana': { icon: 'calendar', color: '#C3B3D4' }, Antes: { icon: 'list', color: '#E7E1EE' } }
const nFold = computed(() => (state.settings.notifFolded ||= {}))
const allFolded = computed(() => groups.value.length > 0 && groups.value.every((g) => nFold.value[g.name]))
const foldAll = () => { const v = !allFolded.value; groups.value.forEach((g) => (nFold.value[g.name] = v)) }
const groups = computed(() => {
  const out = []
  for (const n of shown.value) {
    const g = group(n.at)
    let last = out[out.length - 1]
    if (!last || last.name !== g) out.push((last = { name: g, items: [] }))
    last.items.push(n)
  }
  return out
})
const unread = computed(() => state.notifications.filter((n) => !n.read).length)
const readAll = () => state.notifications.forEach((n) => (n.read = true))
const remove = (n) => { state.notifications = state.notifications.filter((x) => x.id !== n.id) }
async function clearAll() { if (await ask('¿Borrar todas las notificaciones?')) state.notifications = [] }

// Al tocarla te lleva justo a lo que dice (la tarea, la actividad, el correo…)
// Materia de la notificación (también para las viejas, buscando la actividad de origen)
const aulaOf = (n) => (n.key?.startsWith('aula:') ? state.aula.find((x) => `aula:${x.id}` === n.key) : null)
const subjectOf = (n) => n.subject || state.subjects.find((s) => s.id === aulaOf(n)?.courseId)?.name || null
function openN(n) {
  n.read = true
  let target = n.open
  // Si la tarea ya no existe (el profe la quitó de Tu Aula), se avisa en vez de llevarte a cualquier lado
  if (n.key?.startsWith('aula:')) {
    let t = target?.type === 'task' ? state.tasks.find((x) => x.id === target.id) : state.tasks.find((x) => x.id === aulaOf(n)?.taskId)
    // La actividad sigue en Tu Aula pero su tarea se perdió: se vuelve a crear con sus datos
    if (!t && aulaOf(n)) { t = openAulaTask(aulaOf(n).id); if (t) return }
    if (!t) { const sj = subjectOf(n); return toast(`Esa actividad ya no está${sj ? ` en ${sj}` : ''}: parece que la quitaron de Tu Aula`) }
    target = { type: 'task', id: t.id }
  }
  if (!target && n.key?.startsWith('aula:')) { const a = state.aula.find((x) => `aula:${x.id}` === n.key); if (a?.taskId) target = { type: 'task', id: a.taskId } }
  if (!target && n.key?.startsWith('intent:')) target = { type: 'task', id: n.key.slice(7) }
  if (target?.type === 'task' && !state.tasks.some((t) => t.id === target.id)) target = null
  if (n.go) go(n.go)
  if (target) ui.modal = target
}
const ICONS = { aula: 'cap', mail: 'mail', class: 'calendar', free: 'sparkles', habits: 'heart', due: 'check', intent: 'timer' }
const iconOf = (n) => ICONS[(n.key || '').split(':')[0]] || 'bell'

// Deslizar a la derecha para borrar
const drag = ref({ id: null, x0: 0, dx: 0 })
let moved = false
const down = (n, e) => { drag.value = { id: n.id, x0: e.clientX, dx: 0 }; moved = false }
const move = (e) => { if (drag.value.id) { drag.value.dx = Math.max(0, e.clientX - drag.value.x0); if (drag.value.dx > 8) moved = true } }
function up(n) {
  if (drag.value.id === n.id && drag.value.dx > 110) remove(n)
  drag.value = { id: null, x0: 0, dx: 0 }
}
const click = (n) => { if (!moved) openN(n) }
const offset = (n) => (drag.value.id === n.id ? drag.value.dx : 0)
</script>

<template>
  <div class="stack">
    <Seg v-if="state.notifications.length" v-model="filt" :options="[['todas', 'Todas', 'bell', state.notifications.length], ['sinleer', 'Sin leer', 'eye', unread]]" label="Qué notificaciones ver" />
    <ListBar v-if="state.notifications.length" :count="shown.length" one="notificación" many="notificaciones" :foldable="groups.length > 1" :all-folded="allFolded" @fold="foldAll">
      <button v-if="unread" class="tool" aria-label="Marcar todo como leído" title="Marcar todo como leído" @click="readAll"><Icon name="check" :size="16" /></button>
      <button v-if="state.notifications.length" class="tool" aria-label="Borrar todas" title="Borrar todas" @click="clearAll"><Icon name="trash" :size="16" /></button>
    </ListBar>
    <template v-if="shown.length">
      <GroupCard v-for="g in groups" :key="g.name" :title="g.name" :icon="GMETA[g.name].icon" :color="GMETA[g.name].color" :count="g.items.length" :open="!nFold[g.name]" @toggle="nFold[g.name] = !nFold[g.name]">
          <div v-for="n in g.items" :key="n.id" class="nt-row">
            <span class="nt-bg" :style="{ opacity: Math.min(1, offset(n) / 110) }"><Icon name="trash" :size="16" /> Borrar</span>
            <div class="nt" role="button" tabindex="0" :style="{ transform: `translateX(${offset(n)}px)` }" @pointerdown="down(n, $event)" @pointermove="move" @pointerup="up(n)" @pointercancel="up(n)" @click="click(n)" @keyup.enter="openN(n)">
              <span class="ico" :class="{ lav: n.read }"><Icon :name="iconOf(n)" :size="17" /></span>
              <div class="grow" style="min-width:0"><div class="small" :class="{ b: !n.read }" style="overflow-wrap:anywhere">{{ stripEmoji(n.text) }}</div><div class="tiny muted">{{ ago(n.at) }}<span v-if="subjectOf(n)"> · <Icon name="book" :size="12" class="inl" /> {{ subjectOf(n) }}</span></div></div>
              <span v-if="!n.read" class="dot-unread" aria-label="Sin leer"></span>
              <button class="x" :aria-label="`Borrar notificación: ${n.text}`" @click.stop="remove(n)"><Icon name="x" :size="14" /></button>
            </div>
          </div>
      </GroupCard>
      <p class="tiny muted" style="text-align:center">Desliza una notificación a la derecha para borrarla</p>
    </template>
    <Empty v-else-if="state.notifications.length" pose="happy" text="Ya leíste todo. Bien ahí." />
    <Empty v-else pose="happy" text="Todo tranquilo por aquí. Te aviso cuando haya algo importante." />
    <button class="btn ghost" @click="go('ajustes')">Configurar notificaciones</button>
  </div>
</template>

<style scoped>
.nt-row { position: relative; overflow: hidden; border-bottom: 1px solid var(--line); }
.nt-row:last-child { border-bottom: 0; }
.nt-bg { position: absolute; inset: 0; display: flex; align-items: center; gap: 6px; padding-left: 14px; font-size: 13px; font-weight: 600; color: #fff; background: var(--pink-700); border-radius: 10px; }
.nt { position: relative; display: flex; gap: 12px; align-items: center; padding: 11px 2px; cursor: pointer; background: var(--surface); touch-action: pan-y; transition: transform .15s; user-select: none; }
.tool { width: 32px; height: 32px; border-radius: 10px; border: 0; background: var(--surface-3); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; flex: none; }
.tool:hover { color: var(--pink-700); }
.dot-unread { width: 8px; height: 8px; border-radius: 50%; background: var(--pink-700); flex: none; }
.x { border: 0; background: transparent; color: var(--muted); width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; flex: none; }
.x:hover { background: var(--pink-100); color: var(--pink-700); }
</style>
