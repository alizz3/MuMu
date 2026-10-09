<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { shortDate } from '../engine/time'
import { Icon, Ring, Chip, Bar } from '../components/ui'
import { goalIcon } from '../components/iconFor'
import { ask } from '../engine/game'
import { resumen, f1 } from '../engine/notas'
import TaskRow from '../components/TaskRow.vue'

const FLOW = [['idea', 'Idea'], ['plan', 'Plan'], ['progreso', 'En progreso'], ['pausado', 'Pausado'], ['completado', 'Completado']]
const view = ref('tablero')
const area = ref('todas')
const sel = computed(() => state.projects.find((p) => p.id === ui.params.id))
const projects = computed(() => state.projects.filter((p) => area.value === 'todas' || p.area === area.value))
const tasksOf = (p) => state.tasks.filter((t) => t.projectId === p.id)
const goalOf = (p) => state.goals.find((g) => g.id === p.goalId)
const coursesOf = (p) => state.courses.filter((c) => c.projectId === p.id)
// Selección múltiple: borrar o completar varias (si están en Google Tasks, también se borran allá)
const picking = ref(false), picked = ref([])
async function delMany() { if (await ask(`¿Borrar ${picked.value.length} tarea${picked.value.length === 1 ? '' : 's'}? Si están en Google Tasks también se borran allá.`)) { picked.value.forEach((id) => A.deleteTask(id)); picked.value = []; picking.value = false } }
function doneMany() { picked.value.forEach((id) => A.completeTask(id)); picked.value = []; picking.value = false }
const gtList = (p) => { const n = normName(p.name); for (const c of Object.values(state.integrations.gtasks || {})) { const l = (c.lists || []).find((x) => normName(x.title) === n); if (l) return l.title } return null }
const normName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const AREAS = ['carrera', 'freelance', 'personal', 'aprendizaje', 'universidad', 'trabajo']
const COL = { idea: { name: 'Idea', icon: 'sparkles', color: '#FFE29A' }, plan: { name: 'Plan', icon: 'list', color: '#BFD7F0' }, progreso: { name: 'En progreso', icon: 'rocket', color: '#F7B6C2' }, pausado: { name: 'Pausado', icon: 'pause', color: '#D9D5E0' }, completado: { name: 'Completado', icon: 'check', color: '#B9DCCB' } }
const pickSubj = ref(false)
const subjTasks = (s) => state.tasks.filter((t) => t.subjectId === s.id && t.status !== 'cancelada')
const isOpenT = (t) => t.status !== 'completada'
const subjPct = (s) => { const ts = subjTasks(s); return ts.length ? Math.round(ts.filter((t) => t.status === 'completada').length / ts.length * 100) : 0 }
const notaOf = (s) => { const r = resumen(subjTasks(s)); return r ? f1(r.promedio) : null }
const openSubject = (s) => { ui.params = {}; A.go('universidad'); ui.openSubject = s.id }
const byStatus = (st) => projects.value.filter((p) => p.status === st)
const tint = (c) => ({ background: `color-mix(in srgb, ${c} 38%, var(--surface))`, color: 'var(--ink)' })
// Arrastrar y soltar entre columnas (en celular: flechitas en cada tarjeta)
const dragId = ref(null), overCol = ref(null)
function drop(st) { const p = state.projects.find((x) => x.id === dragId.value); if (p) p.status = st; dragId.value = null; overCol.value = null }
const move = (p, dir) => { const i = FLOW.findIndex((f) => f[0] === p.status); p.status = FLOW[Math.max(0, Math.min(FLOW.length - 1, i + dir))][0] }
</script>

<template>
  <div class="stack">
    <!-- Detalle -->
    <template v-if="sel">
      <div class="card" :style="{ borderTop: `5px solid ${sel.color || 'var(--lav-300)'}` }">
        <div class="row"><Ring :value="A.projectProgress(sel)" :size="60" :label="sel.name" /><div class="grow"><h2>{{ sel.name }}</h2><div class="small muted">{{ sel.description }}</div></div>
          <button class="iconbtn" aria-label="Editar proyecto" @click="ui.modal = { type: 'project', id: sel.id }"><Icon name="edit" :size="18" /></button></div>
        <div class="row wrap" style="gap:6px;margin-top:10px">
          <span class="badge pink"><Icon v-if="COL[sel.status]" :name="COL[sel.status].icon" :size="13" />{{ FLOW.find((f) => f[0] === sel.status)?.[1] }}</span>
          <span v-if="goalOf(sel)" class="badge"><Icon :name="goalIcon(goalOf(sel))" :size="13" />{{ goalOf(sel).name }}</span>
          <span v-if="sel.due" class="badge"><Icon name="calendar" :size="13" />{{ shortDate(sel.due) }}</span>
          <span v-for="s in sel.skills || []" :key="s" class="badge green">{{ s }}</span>
        </div>
        <div class="row" style="gap:6px;margin-top:10px"><button class="btn sm ghost" @click="move(sel, -1)"><Icon name="back" :size="14" />Etapa</button><button class="btn sm lav" @click="move(sel, 1)">Siguiente etapa<Icon name="chev" :size="14" /></button></div>
      </div>
      <div v-if="sel.area === 'universidad'" class="card">
        <div class="row between"><h3>Materias</h3><button class="link" @click="pickSubj = !pickSubj">{{ pickSubj ? 'Listo' : 'Unir materias' }}</button></div>
        <template v-if="pickSubj">
          <label v-for="s in state.subjects" :key="s.id" class="row small" style="gap:8px;padding:8px 2px;border-bottom:1px solid var(--line)"><input type="checkbox" :checked="s.projectId === sel.id" @change="s.projectId = s.projectId === sel.id ? null : sel.id" /> <span class="grow">{{ s.name }}</span></label>
        </template>
        <template v-else>
          <button v-for="s in A.subjectsOfProject(sel)" :key="s.id" class="subj" @click="openSubject(s)">
            <span class="gico" :style="tint(s.color || '#C3B3D4')"><Icon name="cap" :size="15" /></span>
            <div class="grow" style="min-width:0"><div class="small b">{{ s.name }}</div><div class="tiny muted">{{ subjTasks(s).filter(isOpenT).length }} pendientes{{ notaOf(s) ? ' · nota ' + notaOf(s) : '' }}</div></div>
            <Ring :value="subjPct(s)" :size="36" :color="s.color" />
          </button>
          <p v-if="!A.subjectsOfProject(sel).length" class="tiny muted" style="margin-top:6px">Toca "Unir materias" para conectar las materias de este semestre. Su avance y sus notas se suman aquí.</p>
        </template>
      </div>
      <div class="card">
        <div class="row between"><h3>Tareas</h3><div class="row" style="gap:14px"><button v-if="tasksOf(sel).length" class="link" @click="picking = !picking; picked = []">{{ picking ? 'Listo' : 'Seleccionar' }}</button><button class="link" @click="ui.modal = { type: 'task', prefill: { projectId: sel.id, goalId: sel.goalId, category: 'trabajo' } }">+ Tarea</button></div></div>
        <p v-if="gtList(sel)" class="tiny muted" style="margin-top:4px"><Icon name="check" :size="13" class="inl" /> Unido con tu lista "{{ gtList(sel) }}" de Google Tasks</p>
        <template v-if="picking">
          <label class="row small" style="gap:8px;padding:8px 2px;border-bottom:1px solid var(--line)"><input type="checkbox" :checked="picked.length === tasksOf(sel).length" @change="picked = picked.length === tasksOf(sel).length ? [] : tasksOf(sel).map((t) => t.id)" /> <b>Todas</b></label>
          <label v-for="t in tasksOf(sel)" :key="t.id" class="row small" style="gap:8px;padding:8px 2px;border-bottom:1px solid var(--line)"><input type="checkbox" :checked="picked.includes(t.id)" @change="picked = picked.includes(t.id) ? picked.filter((x) => x !== t.id) : [...picked, t.id]" /> <span class="grow" :class="{ 'done-txt': t.status === 'completada' }">{{ t.title }}</span><span v-if="t.gtask" class="tiny muted">Google</span></label>
          <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm ghost" :disabled="!picked.length" @click="doneMany">Marcar hechas</button><button class="btn sm primary" :disabled="!picked.length" @click="delMany"><Icon name="trash" :size="14" />Borrar {{ picked.length || '' }}</button></div>
        </template>
        <div v-else class="list"><TaskRow v-for="t in tasksOf(sel)" :key="t.id" :task="t" /></div>
      </div>
      <div class="card" v-if="(sel.resources || []).length || coursesOf(sel).length">
        <h3>Recursos y aprendizaje</h3>
        <div v-for="r in sel.resources" :key="r" class="small wi" style="padding:4px 0;display:flex"><Icon name="link" :size="14" />{{ r }}</div>
        <div v-for="c in coursesOf(sel)" :key="c.id" class="small wi" style="padding:4px 0;display:flex"><Icon name="book" :size="14" />{{ c.title }} — práctica: {{ c.practice }}</div>
      </div>
    </template>

    <!-- Tablero kanban / lista -->
    <template v-else>
      <div class="row between" style="gap:8px">
        <div class="views" role="radiogroup" aria-label="Vista">
          <button v-for="v in [['tablero', 'Tablero', 'grid'], ['lista', 'Lista', 'list']]" :key="v[0]" role="radio" :aria-checked="view === v[0]" :class="{ on: view === v[0] }" @click="view = v[0]"><Icon :name="v[2]" :size="14" /><span>{{ v[1] }}</span></button>
        </div>
        <div class="row" style="gap:8px">
          <select class="input area" v-model="area" aria-label="Área"><option value="todas">Todas las áreas</option><option v-for="a in AREAS" :key="a" :value="a">{{ a[0].toUpperCase() + a.slice(1) }}</option></select>
          <button class="iconbtn add" aria-label="Nuevo proyecto" @click="ui.modal = { type: 'project', prefill: { status: 'idea' } }"><Icon name="plus" /></button>
        </div>
      </div>

      <div v-if="view === 'tablero'" class="kanban">
        <section v-for="f in FLOW" :key="f[0]" class="col" :class="{ over: overCol === f[0] }" @dragover.prevent="overCol = f[0]" @dragleave="overCol = overCol === f[0] ? null : overCol" @drop.prevent="drop(f[0])">
          <header class="col-head">
            <span class="gico" :style="tint(COL[f[0]].color)"><Icon :name="COL[f[0]].icon" :size="15" /></span>
            <b class="grow">{{ COL[f[0]].name }}</b>
            <span class="badge">{{ byStatus(f[0]).length }}</span>
            <button class="mini" :aria-label="`Nuevo proyecto en ${COL[f[0]].name}`" @click="ui.modal = { type: 'project', prefill: { status: f[0] } }"><Icon name="plus" :size="14" /></button>
          </header>
          <div class="col-body">
            <article v-for="p in byStatus(f[0])" :key="p.id" class="kcard" draggable="true" :class="{ dragging: dragId === p.id }" @dragstart="dragId = p.id" @dragend="dragId = null; overCol = null" @click="A.go('proyectos', { id: p.id })">
              <span class="strip" :style="{ background: p.color || 'var(--lav-300)' }"></span>
              <div class="b small kname">{{ p.name }}</div>
              <div class="tiny muted kmeta"><span>{{ p.area }}</span><span v-if="p.due">· {{ shortDate(p.due) }}</span></div>
              <Bar :value="A.projectProgress(p)" style="margin-top:8px" :color="p.color" />
              <div class="row between" style="margin-top:8px">
                <span class="tiny muted row" style="gap:4px"><Icon name="check" :size="12" />{{ tasksOf(p).filter((t) => t.status === 'completada').length }}/{{ tasksOf(p).length }}</span>
                <span class="row" style="gap:2px">
                  <button class="mini" :disabled="f[0] === FLOW[0][0]" :aria-label="`Mover ${p.name} a la etapa anterior`" @click.stop="move(p, -1)"><Icon name="back" :size="13" /></button>
                  <button class="mini" :disabled="f[0] === FLOW[FLOW.length - 1][0]" :aria-label="`Mover ${p.name} a la siguiente etapa`" @click.stop="move(p, 1)"><Icon name="chev" :size="13" /></button>
                </span>
              </div>
            </article>
            <p v-if="!byStatus(f[0]).length" class="tiny muted empty-col">Arrastra un proyecto aquí</p>
          </div>
        </section>
      </div>

      <div v-else class="card"><div class="list">
        <button v-for="p in projects" :key="p.id" class="item" style="all:unset;display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer" @click="A.go('proyectos', { id: p.id })">
          <Ring :value="A.projectProgress(p)" :size="40" /><div class="grow"><div class="b small">{{ p.name }}</div><div class="tiny muted">{{ p.area }} · {{ COL[p.status]?.name }}</div></div><Icon name="chev" :size="16" />
        </button>
      </div></div>
    </template>
  </div>
</template>

<style scoped>
.views { display: inline-flex; background: var(--surface-3); border-radius: 12px; padding: 3px; gap: 2px; }
.views button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--ink-2); font: inherit; font-size: 12.5px; padding: 6px 10px; border-radius: 9px; cursor: pointer; }
.views button.on { background: var(--surface); color: var(--pink-700); font-weight: 600; box-shadow: var(--shadow); }
.area { width: auto; padding: 6px 10px; font-size: 13px; }
.kanban { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(250px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; margin: 0 -4px; padding-left: 4px; padding-right: 4px; }
.col { background: var(--surface-3); border-radius: 18px; padding: 10px; display: flex; flex-direction: column; gap: 10px; min-height: 160px; scroll-snap-align: start; transition: box-shadow .15s; }
.col.over { box-shadow: inset 0 0 0 2px var(--pink-300); }
.col-head { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 2px 2px 0; }
.gico { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; flex: none; }
.col-body { display: flex; flex-direction: column; gap: 8px; }
.kcard { position: relative; background: var(--surface); border-radius: 14px; padding: 12px 12px 10px 16px; box-shadow: var(--shadow); cursor: grab; overflow: hidden; }
.kcard:active { cursor: grabbing; }
.kcard.dragging { opacity: .45; }
.strip { position: absolute; left: 0; top: 0; bottom: 0; width: 5px; }
.kname { overflow-wrap: anywhere; }
.kmeta { display: flex; gap: 4px; margin-top: 2px; text-transform: capitalize; }
.mini { width: 26px; height: 26px; border-radius: 8px; border: 0; background: transparent; color: var(--muted); display: grid; place-items: center; cursor: pointer; }
.mini:hover:not(:disabled) { background: var(--surface-3); color: var(--pink-700); }
.mini:disabled { opacity: .3; cursor: default; }
.subj { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: inherit; font: inherit; text-align: left; padding: 10px 2px; cursor: pointer; }
.subj:last-child { border-bottom: 0; }
.empty-col { text-align: center; padding: 18px 6px; border: 1.5px dashed var(--line); border-radius: 12px; }
</style>
