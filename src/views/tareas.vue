<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import { isOpen, effectivePriority, scoreTask, currentContext } from '../engine/planner'
import { daysUntil } from '../engine/time'
import { Empty, Icon } from '../components/ui'
import TaskRow from '../components/TaskRow.vue'
import { inScope } from '../engine/modoU'
import { gtAccounts, syncGTasks } from '../services/api'
import { toast } from '../engine/game'

const gtOn = computed(() => gtAccounts().length > 0)
const gtBusy = ref(false)
async function gtSync() { gtBusy.value = true; try { await syncGTasks() } catch (e) { toast(e.message) } finally { gtBusy.value = false } }

// Qué ver (pestañas) y cómo agrupar. Se recuerda lo que elijas.
const TABS = [['abiertas', 'Pendientes'], ['hoy', 'Hoy'], ['semana', 'Semana'], ['completadas', 'Hechas'], ['todas', 'Todas']]
const VIEWS = [['lista', 'Listas', 'list'], ['fecha', 'Fecha', 'calendar'], ['prioridad', 'Prioridad', 'bolt']]
const pref = (k, d) => computed({ get: () => state.settings[k] || d, set: (v) => (state.settings[k] = v) })
const filter = pref('taskFilter', 'abiertas')
const group = pref('taskGroup', 'lista')
if (!VIEWS.some((v) => v[0] === group.value)) group.value = 'lista'
const q = ref('')

const list = computed(() => {
  let ts = state.tasks.filter((t) => inScope('task', t) && t.status !== 'cancelada')
  if (filter.value === 'abiertas') ts = ts.filter(isOpen)
  if (filter.value === 'hoy') ts = ts.filter((t) => isOpen(t) && t.due && daysUntil(t.due) <= 0)
  if (filter.value === 'semana') ts = ts.filter((t) => isOpen(t) && t.due && daysUntil(t.due) <= 7)
  if (filter.value === 'completadas') ts = ts.filter((t) => t.status === 'completada')
  if (q.value) ts = ts.filter((t) => t.title.toLowerCase().includes(q.value.toLowerCase()))
  return ts
})

// Cada grupo trae su ícono y su color, del mismo estilo que el resto de MuMu
const gtListName = (t) => { if (!t.gtask) return null; const c = state.integrations.gtasks?.[t.gtask.acc]; return c?.lists?.find((l) => l.id === t.gtask.list)?.title || null }
function meta(t) {
  if (group.value === 'lista') {
    const h = t.habitId && state.habits.find((x) => x.id === t.habitId)
    if (h) return { key: 'h' + h.id, order: 1, label: h.name, icon: 'heart', color: h.color || '#F7B6C2' }
    const p = state.projects.find((x) => x.id === t.projectId)
    if (p) return { key: 'p' + p.id, order: 1, label: p.name, icon: 'folder', color: p.color || '#C3B3D4' }
    const s = state.subjects.find((x) => x.id === t.subjectId)
    if (s) return { key: 's' + s.id, order: 2, label: s.name, icon: 'cap', color: s.color || '#C3B3D4' }
    const g = gtListName(t)
    if (g) return { key: 'g' + g, order: 0, label: g, icon: 'check', color: '#BFD7F0' }
    return { key: 'none', order: 3, label: 'Sin lista', icon: 'list', color: '#E7E1EE' }
  }
  if (group.value === 'fecha') {
    const d = daysUntil(t.due)
    if (!t.due) return { key: 'f5', order: 5, label: 'Sin fecha', icon: 'list', color: '#E7E1EE' }
    if (d < 0) return { key: 'f0', order: 0, label: 'Atrasadas (sin culpa)', icon: 'clock', color: '#F7B6C2' }
    if (d === 0) return { key: 'f1', order: 1, label: 'Hoy', icon: 'sun', color: '#FFE29A' }
    if (d === 1) return { key: 'f2', order: 2, label: 'Mañana', icon: 'calendar', color: '#C3B3D4' }
    if (d <= 7) return { key: 'f3', order: 3, label: 'Esta semana', icon: 'calendar', color: '#BFD7F0' }
    return { key: 'f4', order: 4, label: 'Más adelante', icon: 'calendar', color: '#B9DCCB' }
  }
  const p = effectivePriority(t)
  return { alta: { key: 'a', order: 0, label: 'Alta', icon: 'bolt', color: '#F7B6C2' }, media: { key: 'm', order: 1, label: 'Media', icon: 'bolt', color: '#FFE29A' }, baja: { key: 'b', order: 2, label: 'Baja', icon: 'bolt', color: '#B9DCCB' } }[p]
}
const groups = computed(() => {
  const ctx = currentContext()
  const g = {}
  ;[...list.value].sort((a, b) => scoreTask(b, ctx) - scoreTask(a, ctx)).forEach((t) => { const m = meta(t); (g[m.key] ||= { ...m, v: [] }).v.push(t) })
  return Object.values(g).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
})
// Grupos plegables
const folded = computed(() => (state.settings.taskFolded ||= {}))
const toggle = (k) => { folded.value[k] = !folded.value[k] }
const allFolded = computed(() => groups.value.length > 0 && groups.value.every((g) => folded.value[g.key]))
const foldAll = () => { const v = !allFolded.value; groups.value.forEach((g) => (folded.value[g.key] = v)) }
const tint = (c) => ({ background: `color-mix(in srgb, ${c} 38%, var(--surface))`, color: 'var(--ink)' })
</script>

<template>
  <div class="stack">
    <div class="row">
      <label class="search grow"><Icon name="search" :size="16" /><input v-model="q" placeholder="Buscar tareas…" aria-label="Buscar tareas" /></label>
      <button v-if="gtOn" class="iconbtn" :aria-label="gtBusy ? 'Sincronizando con Google Tasks' : 'Sincronizar con Google Tasks'" title="Sincronizar con Google Tasks" :disabled="gtBusy" @click="gtSync"><Icon name="refresh" :class="{ spinning: gtBusy }" /></button>
      <button class="iconbtn add" aria-label="Nueva tarea" @click="ui.modal = { type: 'task' }"><Icon name="plus" /></button>
    </div>

    <div class="seg" role="tablist" aria-label="Qué tareas ver">
      <button v-for="t in TABS" :key="t[0]" role="tab" :aria-selected="filter === t[0]" :class="{ on: filter === t[0] }" @click="filter = t[0]">{{ t[1] }}</button>
    </div>

    <div class="row between">
      <span class="small muted">{{ list.length }} {{ list.length === 1 ? 'tarea' : 'tareas' }}</span>
      <div class="row" style="gap:6px">
      <button v-if="groups.length > 1" class="fold" :aria-label="allFolded ? 'Expandir todo' : 'Contraer todo'" :title="allFolded ? 'Expandir todo' : 'Contraer todo'" @click="foldAll"><Icon :name="allFolded ? 'expand' : 'collapse'" :size="16" /></button>
      <div class="views" role="radiogroup" aria-label="Agrupar">
        <button v-for="v in VIEWS" :key="v[0]" role="radio" :aria-checked="group === v[0]" :class="{ on: group === v[0] }" :title="`Agrupar por ${v[1].toLowerCase()}`" @click="group = v[0]"><Icon :name="v[2]" :size="14" /><span>{{ v[1] }}</span></button>
      </div>
      </div>
    </div>

    <section v-for="g in groups" :key="g.key" class="card grp">
      <button class="grp-head" :aria-expanded="!folded[g.key]" @click="toggle(g.key)">
        <span class="gico" :style="tint(g.color)"><Icon :name="g.icon" :size="16" /></span>
        <h3 class="grow">{{ g.label }}</h3>
        <span class="badge">{{ g.v.length }}</span>
        <Icon name="chev" :size="16" class="muted" :style="{ transform: folded[g.key] ? 'none' : 'rotate(90deg)', transition: 'transform .2s' }" />
      </button>
      <div v-if="!folded[g.key]" class="list"><TaskRow v-for="t in g.v" :key="t.id" :task="t" /></div>
    </section>
    <Empty v-if="!list.length" pose="celebrate" :text="q ? 'No encontré tareas con eso' : 'Nada por aquí. ¡Disfruta ese espacio!'" />
  </div>
</template>

<style scoped>
.search { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 0 12px; color: var(--muted); min-width: 0; }
.search input { border: 0; background: transparent; color: var(--ink); font: inherit; padding: 11px 0; width: 100%; outline: none; }
.search:focus-within { border-color: var(--pink-300); }
.views { display: inline-flex; background: var(--surface-3); border-radius: 12px; padding: 3px; gap: 2px; }
.views button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--ink-2); font: inherit; font-size: 12.5px; padding: 6px 10px; border-radius: 9px; cursor: pointer; }
.views button.on { background: var(--surface); color: var(--pink-700); font-weight: 600; box-shadow: var(--shadow); }
.fold { width: 32px; height: 32px; border-radius: 10px; border: 0; background: var(--surface-3); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; }
.fold:hover { color: var(--pink-700); }
.grp { padding-top: 12px; padding-bottom: 12px; }
.grp-head { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
.grp-head h3 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; }
.grp .list { margin-top: 6px; }
.spinning { animation: spin .8s linear infinite; }
@media (max-width: 380px) { .views button span { display: none; } }
</style>
