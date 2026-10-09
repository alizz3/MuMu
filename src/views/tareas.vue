<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import { isOpen, effectivePriority, scoreTask, currentContext } from '../engine/planner'
import { daysUntil } from '../engine/time'
import { Chip, Empty, Icon } from '../components/ui'
import TaskRow from '../components/TaskRow.vue'
import { inScope } from '../engine/modoU'
import { gtAccounts, syncGTasks } from '../services/api'
import { toast } from '../engine/game'
const gtOn = computed(() => gtAccounts().length > 0)
const gtBusy = ref(false)
async function gtSync() { gtBusy.value = true; try { await syncGTasks() } catch (e) { toast(e.message) } finally { gtBusy.value = false } }

// Vistas tipo base de datos: mismo set de tareas, diferentes filtros y agrupaciones
const filter = ref('abiertas')
const group = ref('fecha')
const cat = ref('todas')
const q = ref('')
// Filtro por proyecto o materia (como las listas de Google Tasks)
const where = ref('todos')
const LISTS = computed(() => [...state.projects.filter((p) => state.tasks.some((t) => t.projectId === p.id)).map((p) => ({ v: 'p:' + p.id, l: '📁 ' + p.name })), ...state.subjects.filter((x) => state.tasks.some((t) => t.subjectId === x.id)).map((x) => ({ v: 's:' + x.id, l: '📚 ' + x.name }))])
const CATS = ['todas', 'universidad', 'trabajo', 'aprendizaje', 'personal', 'vida']
const list = computed(() => {
  let ts = state.tasks.filter((t) => inScope('task', t))
  if (filter.value === 'abiertas') ts = ts.filter(isOpen)
  if (filter.value === 'hoy') ts = ts.filter((t) => isOpen(t) && t.due && daysUntil(t.due) <= 0)
  if (filter.value === 'semana') ts = ts.filter((t) => isOpen(t) && t.due && daysUntil(t.due) <= 7)
  if (filter.value === 'pospuestas') ts = ts.filter((t) => isOpen(t) && (t.postponed || 0) > 0)
  if (filter.value === 'completadas') ts = ts.filter((t) => t.status === 'completada')
  if (cat.value !== 'todas') ts = ts.filter((t) => t.category === cat.value)
  if (where.value !== 'todos') { const [k, id] = where.value.split(':'); ts = ts.filter((t) => (k === 'p' ? t.projectId : t.subjectId) === id) }
  if (q.value) ts = ts.filter((t) => t.title.toLowerCase().includes(q.value.toLowerCase()))
  return ts
})
const groups = computed(() => {
  const ctx = currentContext()
  const g = {}
  const key = (t) => {
    if (group.value === 'fecha') { const d = daysUntil(t.due); return !t.due ? '5 Sin fecha' : d < 0 ? '0 Atrasadas (sin culpa)' : d === 0 ? '1 Hoy' : d === 1 ? '2 Mañana' : d <= 7 ? '3 Esta semana' : '4 Más adelante' }
    if (group.value === 'prioridad') return { alta: '0 Alta', media: '1 Media', baja: '2 Baja' }[effectivePriority(t)]
    if (group.value === 'proyecto') return state.projects.find((p) => p.id === t.projectId)?.name || state.subjects.find((s) => s.id === t.subjectId)?.name || 'Sin proyecto'
    if (group.value === 'estado') return t.status
    if (group.value === 'fuente') return t.source
  }
  ;[...list.value].sort((a, b) => scoreTask(b, ctx) - scoreTask(a, ctx)).forEach((t) => (g[key(t)] = g[key(t)] || []).push(t))
  return Object.entries(g).sort((a, b) => (a[0] > b[0] ? 1 : -1)).map(([k, v]) => ({ k: k.replace(/^\d /, ''), v }))
})
</script>

<template>
  <div class="stack">
    <div class="row">
      <input class="input grow" v-model="q" placeholder="Buscar tareas…" aria-label="Buscar tareas" />
      <button v-if="gtOn" class="iconbtn" :aria-label="gtBusy ? 'Sincronizando con Google Tasks' : 'Sincronizar con Google Tasks'" title="Sincronizar con Google Tasks" :disabled="gtBusy" @click="gtSync"><Icon name="refresh" /></button>
      <button class="iconbtn add" aria-label="Nueva tarea" @click="ui.modal = { type: 'task' }"><Icon name="plus" /></button>
    </div>
    <div class="chips"><Chip v-for="f in ['abiertas', 'hoy', 'semana', 'pospuestas', 'completadas', 'todas']" :key="f" :active="filter === f" @click="filter = f">{{ f }}</Chip></div>
    <div class="chips"><Chip v-for="c in CATS" :key="c" :active="cat === c" @click="cat = c">{{ c }}</Chip></div>
    <div class="row wrap small muted" style="gap:8px 14px">
      <label class="row" style="gap:6px">Lista
        <select class="input" style="width:auto;max-width:220px;padding:6px 10px" v-model="where" aria-label="Filtrar por proyecto o materia">
          <option value="todos">Todas</option><option v-for="o in LISTS" :key="o.v" :value="o.v">{{ o.l }}</option>
        </select></label>
      <label class="row" style="gap:6px">Agrupar por
        <select class="input" style="width:auto;padding:6px 10px" v-model="group" aria-label="Agrupar por">
          <option value="fecha">fecha</option><option value="prioridad">prioridad</option><option value="proyecto">proyecto / materia</option><option value="estado">estado</option><option value="fuente">fuente</option>
        </select></label>
    </div>
    <div v-for="g in groups" :key="g.k" class="card">
      <div class="row between"><h3>{{ g.k }}</h3><span class="badge">{{ g.v.length }}</span></div>
      <div class="list"><TaskRow v-for="t in g.v" :key="t.id" :task="t" /></div>
    </div>
    <Empty v-if="!list.length" pose="celebrate" text="Nada por aquí. ¡Disfruta ese espacio! ✨" />
  </div>
</template>
