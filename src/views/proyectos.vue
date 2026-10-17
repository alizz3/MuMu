<script setup>
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { shortDate, uid } from '../engine/time'
import { Icon, Ring, Bar } from '../components/ui'
import { goalIcon } from '../components/iconFor'
import { ask, toast } from '../engine/game'
import { resumen, f1 } from '../engine/notas'
import TaskRow from '../components/TaskRow.vue'
import Seg from '../components/Seg.vue'
import ListBar from '../components/ListBar.vue'
import GroupCard from '../components/GroupCard.vue'
import ProjectLinks from '../components/ProjectLinks.vue'
import { syncClickUp } from '../services/api'

const FLOW = [['idea', 'Idea'], ['plan', 'Plan'], ['progreso', 'En progreso'], ['pausado', 'Pausado'], ['completado', 'Completado']]
// Vista y área se recuerdan, como en Tareas
const pref = (k, d) => computed({ get: () => state.settings[k] || d, set: (v) => (state.settings[k] = v) })
const view = pref('projView', 'tablero')
const area = pref('projArea', 'todas')
const sel = computed(() => state.projects.find((p) => p.id === ui.params.id))
// ClickUp: el proyecto unido a un espacio (ej. Acriz) se puede sincronizar a mano
const cuBusy = ref(false)
async function cuSync() { cuBusy.value = true; try { await syncClickUp() } catch (e) { toast(e.message) } finally { cuBusy.value = false } }
const cuWho = (t) => (String(t.notes || '').match(/^Responsable: (.+)$/m) || [])[1] || null
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
// Filtro de áreas: solo las que tienen proyectos (más la elegida, para no perderla)
const AREA_ICON = { carrera: 'briefcase', freelance: 'laptop', personal: 'heart', aprendizaje: 'book', universidad: 'cap', trabajo: 'briefcase' }
const areaOpts = computed(() => {
  const n = (a) => state.projects.filter((p) => p.area === a).length
  const extra = [...new Set(state.projects.map((p) => p.area).filter((a) => a && !AREAS.includes(a)))]
  return [['todas', 'Todas', null, state.projects.length], ...[...AREAS, ...extra].filter((a) => n(a) || area.value === a).map((a) => [a, a[0].toUpperCase() + a.slice(1), AREA_ICON[a] || null, n(a)])]
})
if (area.value !== 'todas' && !state.projects.some((p) => p.area === area.value)) area.value = 'todas'
// Columnas plegables de lado (tipo Kanban compacto). Se recuerda por tablero (área) y columna.
// Las vacías empiezan plegadas, salvo que la hayas abierto (se guarda false explícito).
const kfold = () => (state.settings.kanbanFolded ||= {})
const kkey = (col) => `${area.value}:${col}`
const isFolded = (col) => { const v = state.settings.kanbanFolded?.[kkey(col)]; return v == null ? byStatus(col).length === 0 : v }
// Al plegar/desplegar, el foco sigue en la misma columna (para teclado)
function toggleCol(col) {
  kfold()[kkey(col)] = !isFolded(col)
  const had = document.activeElement?.closest?.(`[data-col="${col}"]`)
  if (had) nextTick(() => document.querySelector(`[data-col="${col}"] .strip-btn, [data-col="${col}"] .col-toggle`)?.focus())
}
// Vista de lista: grupos por etapa, plegables
const lfold = computed(() => (state.settings.projListFolded ||= {}))
const listGroups = computed(() => FLOW.map((f) => ({ key: f[0], ...COL[f[0]], v: byStatus(f[0]) })).filter((g) => g.v.length))
const allFolded = computed(() => (view.value === 'tablero' ? FLOW.every((f) => isFolded(f[0])) : listGroups.value.length > 0 && listGroups.value.every((g) => lfold.value[g.key])))
function foldAll() {
  const v = !allFolded.value
  if (view.value === 'tablero') FLOW.forEach((f) => (kfold()[kkey(f[0])] = v))
  else listGroups.value.forEach((g) => (lfold.value[g.key] = v))
}
const tint = (c) => ({ background: `color-mix(in srgb, ${c} 38%, var(--surface))`, color: 'var(--ink)' })
const move = (p, dir) => { const i = FLOW.findIndex((f) => f[0] === p.status); p.status = FLOW[Math.max(0, Math.min(FLOW.length - 1, i + dir))][0] }
const prettyUrl = (r) => { try { const u = new URL(r); return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '') } catch { return r } }

// ---------- Enlaces del proyecto ----------
// Antes eran "recursos": una lista de URLs sueltas. Al abrir el proyecto se pasan a enlaces con nombre
// ({ id, name, url }). Lo que no parezca un enlace se queda en resources (se muestra como nota).
const looksUrl = (r) => /^(https?:\/\/)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(String(r || '').trim())
function migrateLinks(p) {
  if (!p || !Array.isArray(p.resources) || !p.resources.some(looksUrl)) return
  const have = new Set((p.links || []).map((l) => l.url))
  const add = []
  p.resources.filter(looksUrl).forEach((r) => {
    let u = String(r).trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u
    if (!have.has(u)) { have.add(u); add.push({ id: uid('l'), name: prettyUrl(u), url: u }) }
  })
  p.links = [...(p.links || []), ...add]
  p.resources = p.resources.filter((r) => !looksUrl(r))
}
watch(sel, migrateLinks, { immediate: true })

// ---------- Tareas: abiertas arriba, terminadas plegadas abajo ----------
const openTasks = computed(() => (sel.value ? tasksOf(sel.value).filter((t) => t.status !== 'completada') : []))
const doneTasks = computed(() => (sel.value ? tasksOf(sel.value).filter((t) => t.status === 'completada') : []))
const doneOpen = computed({ get: () => !!state.settings.projDoneOpen, set: (v) => (state.settings.projDoneOpen = v) })

// ---------- Orden dentro de cada columna ----------
const SORTS = [['manual', 'Manual'], ['name', 'Nombre (A–Z)'], ['created', 'Fecha de creación'], ['due', 'Fecha límite'], ['progress', 'Progreso']]
const sortOf = (col) => state.settings.kanbanSort?.[col] || 'manual'
const sortName = (col) => SORTS.find((s) => s[0] === sortOf(col))[1]
function setSort(col, v) { (state.settings.kanbanSort ||= {})[col] = v; sortOpen.value = null }
const sortOpen = ref(null)
const idxOf = (p) => state.projects.indexOf(p)
const ordOf = (p) => (typeof p.order === 'number' ? p.order : 1e6 + idxOf(p))
const CMP = {
  manual: (a, b) => ordOf(a) - ordOf(b),
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base', numeric: true }),
  created: (a, b) => idxOf(a) - idxOf(b), // los nuevos entran de primeros en state.projects: más recientes arriba
  due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999'),
  progress: (a, b) => A.projectProgress(b) - A.projectProgress(a),
}
const cols = computed(() => Object.fromEntries(FLOW.map(([st]) => [st, byStatus(st).slice().sort(CMP[sortOf(st)] || CMP.manual)])))
// Pone el proyecto en la columna st, en la posición index (contando sin él). Si la columna está ordenada por
// otro criterio y reordenas dentro de ella, pasa a orden manual partiendo de lo que ves.
function place(p, st, index) {
  if (sortOf(st) !== 'manual' && p.status !== st) { p.status = st; return }
  const list = cols.value[st].filter((x) => x !== p) // en el orden que se ve ahora
  if (sortOf(st) !== 'manual') { setSort(st, 'manual'); toast(`${COL[st].name}: ahora en orden manual`) }
  list.splice(Math.max(0, Math.min(index, list.length)), 0, p)
  p.status = st
  list.forEach((x, i) => (x.order = i))
}
function nudge(p, dir) {
  const i = cols.value[p.status].indexOf(p)
  place(p, p.status, i + dir)
  nextTick(() => document.querySelector(`[data-pid="${p.id}"] .mv-${dir < 0 ? 'up' : 'down'}:not(:disabled)`)?.focus())
}

// ---------- Arrastrar (pointer events: mouse y touch) ----------
// Mouse: arrastra al moverlo 5px. Touch: mantén presionado ~0,3 s y luego arrastra (si mueves antes, es scroll).
const drag = ref(null) // { id, col, index, x, y, w, h, ox, oy, name, color }
let pend = null, raf = 0, justDragged = false
const board = ref(null)
function onDown(e, p) {
  if (e.button > 0 || e.target.closest('button')) return
  const el = e.currentTarget, r = el.getBoundingClientRect()
  pend = { p, el, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, h: r.height, touch: e.pointerType !== 'mouse', timer: 0 }
  if (pend.touch) pend.timer = setTimeout(() => pend && start(pend.x, pend.y), 300)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
}
function start(x, y) {
  const { p, ox, oy, w, h } = pend
  const from = cols.value[p.status].indexOf(p)
  drag.value = { id: p.id, col: p.status, from, index: from, x, y, w, h, ox, oy, name: p.name, color: p.color }
  navigator.vibrate?.(15)
  raf = requestAnimationFrame(tick)
}
function onMove(e) {
  if (!pend) return
  pend.x = e.clientX; pend.y = e.clientY
  if (!drag.value) {
    const d = Math.hypot(e.clientX - pend.sx, e.clientY - pend.sy)
    if (pend.touch) { if (d > 8) cleanup() } // se está desplazando, no arrastrando
    else if (d > 5) start(e.clientX, e.clientY)
    return
  }
  drag.value.x = e.clientX; drag.value.y = e.clientY
  locate()
}
function locate() {
  const d = drag.value; if (!d) return
  const colEl = document.elementFromPoint(d.x, d.y)?.closest?.('[data-col]')
  if (!colEl) return
  const st = colEl.dataset.col
  const cards = [...colEl.querySelectorAll('.kcard:not(.lifted)')]
  let i = cards.findIndex((c) => { const r = c.getBoundingClientRect(); return d.y < r.top + r.height / 2 })
  d.col = st; d.index = i < 0 ? cards.length : i
}
// Desplaza solo el tablero / la columna cuando el dedo llega al borde
function tick() {
  const d = drag.value; if (!d) return
  const k = board.value
  if (k) {
    const r = k.getBoundingClientRect(), edge = 44
    if (d.x < r.left + edge) k.scrollLeft -= 10; else if (d.x > r.right - edge) k.scrollLeft += 10
  }
  const body = document.querySelector(`[data-col="${d.col}"] .col-body`)
  if (body) {
    const r = body.getBoundingClientRect(), edge = 40
    if (d.y < r.top + edge && d.y > r.top - 30) body.scrollTop -= 8; else if (d.y > r.bottom - edge && d.y < r.bottom + 30) body.scrollTop += 8
  }
  locate()
  raf = requestAnimationFrame(tick)
}
function onUp() {
  const d = drag.value
  if (d) {
    const p = state.projects.find((x) => x.id === d.id)
    if (p && (d.col !== p.status || d.index !== d.from)) place(p, d.col, d.index)
    justDragged = true; setTimeout(() => (justDragged = false), 0)
  }
  cleanup()
}
function onCancel() { cleanup() }
function cleanup() {
  if (pend?.timer) clearTimeout(pend.timer)
  pend = null; drag.value = null; cancelAnimationFrame(raf)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
}
// Deslizar el tablero de lado: con el dedo es nativo; con el mouse, arrastrando el fondo; con la rueda o el touchpad, sobre los títulos o el fondo
let pan = null
function onBoardDown(e) {
  if (e.pointerType !== 'mouse' || e.button > 0 || e.target.closest('.kcard, button, a, input, select, .col-body')) return
  pan = { x: e.clientX, left: board.value.scrollLeft, moved: false }
  board.value.classList.add('panning')
  window.addEventListener('pointermove', onPanMove); window.addEventListener('pointerup', onPanUp)
}
function onPanMove(e) { if (!pan) return; const dx = e.clientX - pan.x; if (Math.abs(dx) > 3) pan.moved = true; board.value.scrollLeft = pan.left - dx }
function onPanUp() { pan = null; board.value?.classList.remove('panning'); window.removeEventListener('pointermove', onPanMove); window.removeEventListener('pointerup', onPanUp) }
function onWheel(e) {
  const k = board.value; if (!k || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
  const body = e.target.closest('.col-body')
  if (body && body.scrollHeight > body.clientHeight + 1) return // dentro de una columna con scroll: baja normal
  if (k.scrollWidth <= k.clientWidth) return
  e.preventDefault(); k.scrollLeft += e.deltaY
}
// Mientras se arrastra con el dedo, la página no se desplaza
const blockTouch = (e) => { if (drag.value) e.preventDefault() }
const blockMenu = (e) => { if (pend?.touch || drag.value) e.preventDefault() }
const openCard = (p) => { if (!justDragged) A.go('proyectos', { id: p.id }) }
// La tarjeta que se arrastra no se quita del DOM (solo se oculta): si se quitara, el navegador dejaría de
// mandarnos los touchmove y la página empezaría a hacer scroll en vez de arrastrar.
const colCards = (st) => (drag.value ? cols.value[st].filter((p) => p.id !== drag.value.id) : cols.value[st])
const visIdx = (st, p) => colCards(st).indexOf(p)

// ---------- Alto del tablero: llega justo hasta encima de la barra de abajo ----------
const boardH = ref(null)
function fit() {
  const el = board.value; if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY
  const nav = document.querySelector('nav.bottom'), nr = nav?.getBoundingClientRect()
  const limit = nr && nr.height ? nr.top - 10 : window.innerHeight - 16
  boardH.value = Math.max(320, Math.floor(limit - top))
}
let ro = null, fitT = 0
onMounted(() => {
  window.addEventListener('resize', fit)
  window.addEventListener('touchmove', blockTouch, { passive: false })
  window.addEventListener('contextmenu', blockMenu)
  ro = new ResizeObserver(() => fit())
  watch(board, (el) => { ro.disconnect(); if (el) { ro.observe(el.parentElement); fit(); clearTimeout(fitT); fitT = setTimeout(fit, 400) } }, { immediate: true, flush: 'post' })
})
onBeforeUnmount(() => {
  onPanUp()
  window.removeEventListener('resize', fit)
  window.removeEventListener('touchmove', blockTouch)
  window.removeEventListener('contextmenu', blockMenu)
  ro?.disconnect(); clearTimeout(fitT); cleanup()
})
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
        <p v-if="sel.clickupSpace" class="row tiny muted" style="margin-top:4px;gap:8px"><span class="grow"><Icon name="check" :size="13" class="inl" /> Unido con el espacio "{{ state.integrations.clickup?.space?.name || sel.name }}" de ClickUp</span><button class="link" :disabled="cuBusy" @click="cuSync">{{ cuBusy ? 'Sincronizando…' : 'Sincronizar' }}</button></p>
        <template v-if="picking">
          <label class="row small" style="gap:8px;padding:8px 2px;border-bottom:1px solid var(--line)"><input type="checkbox" :checked="picked.length === tasksOf(sel).length" @change="picked = picked.length === tasksOf(sel).length ? [] : tasksOf(sel).map((t) => t.id)" /> <b>Todas</b></label>
          <label v-for="t in tasksOf(sel)" :key="t.id" class="row small" style="gap:8px;padding:8px 2px;border-bottom:1px solid var(--line)"><input type="checkbox" :checked="picked.includes(t.id)" @change="picked = picked.includes(t.id) ? picked.filter((x) => x !== t.id) : [...picked, t.id]" /> <span class="grow" :class="{ 'done-txt': t.status === 'completada' }">{{ t.title }}</span><span v-if="t.gtask" class="tiny muted">Google</span><span v-if="t.clickup" class="tiny muted">ClickUp{{ cuWho(t) ? ' · ' + cuWho(t) : '' }}</span></label>
          <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm ghost" :disabled="!picked.length" @click="doneMany">Marcar hechas</button><button class="btn sm primary" :disabled="!picked.length" @click="delMany"><Icon name="trash" :size="14" />Borrar {{ picked.length || '' }}</button></div>
        </template>
        <template v-else>
          <div v-if="openTasks.length" class="list"><TaskRow v-for="t in openTasks" :key="t.id" :task="t" /></div>
          <p v-else class="tiny muted" style="margin-top:6px">{{ doneTasks.length ? 'Todo al día: no quedan tareas pendientes.' : 'Aún no hay tareas en este proyecto.' }}</p>
        </template>
      </div>
      <GroupCard v-if="doneTasks.length && !picking" title="Tareas terminadas" icon="check" color="#B9DCCB" :count="doneTasks.length" :open="doneOpen" @toggle="doneOpen = !doneOpen">
        <div class="list"><TaskRow v-for="t in doneTasks" :key="t.id" :task="t" /></div>
      </GroupCard>
      <ProjectLinks :target="sel" field="links" />
      <div class="card" v-if="(sel.resources || []).length || coursesOf(sel).length">
        <h3>Aprendizaje</h3>
        <div v-for="r in sel.resources" :key="r" class="small wi" style="padding:4px 0;display:flex"><Icon name="note" :size="14" />{{ r }}</div>
        <div v-for="c in coursesOf(sel)" :key="c.id" class="small wi" style="padding:4px 0;display:flex"><Icon name="book" :size="14" />{{ c.title }} — práctica: {{ c.practice }}</div>
      </div>
    </template>

    <!-- Tablero kanban / lista -->
    <template v-else>
      <div class="row" style="gap:8px">
        <Seg v-model="area" :options="areaOpts" label="Área" class="grow" style="min-width:0" />
        <button class="iconbtn add" aria-label="Nuevo proyecto" @click="ui.modal = { type: 'project', prefill: { status: 'idea' } }"><Icon name="plus" /></button>
      </div>
      <ListBar :count="projects.length" one="proyecto" foldable :all-folded="allFolded" :views="[['tablero', 'Tablero', 'grid'], ['lista', 'Lista', 'list']]" v-model:view="view" views-label="Vista" verb="Ver como" @fold="foldAll" />

      <div v-if="view === 'tablero'" ref="board" class="kanban" @pointerdown="onBoardDown" @wheel="onWheel" :class="{ dragging: drag }" :style="boardH ? { height: boardH + 'px' } : null">
        <section v-for="f in FLOW" :key="f[0]" :data-col="f[0]" class="col" :class="{ over: drag && drag.col === f[0], folded: isFolded(f[0]) }">
          <!-- Plegada: tira angosta; tocar en cualquier parte la abre -->
          <button v-if="isFolded(f[0])" type="button" class="strip-btn" :aria-expanded="false" :aria-label="`Expandir columna ${COL[f[0]].name} (${byStatus(f[0]).length})`" :title="`Expandir ${COL[f[0]].name}`" @click="toggleCol(f[0])">
            <span class="gico" :style="tint(COL[f[0]].color)"><Icon :name="COL[f[0]].icon" :size="15" /></span>
            <span class="badge">{{ byStatus(f[0]).length }}</span>
            <b class="vname">{{ COL[f[0]].name }}</b>
            <span class="xbtn"><Icon name="expand" :size="15" style="transform:rotate(90deg)" /></span>
          </button>
          <template v-else>
            <header class="col-head" @click.self="toggleCol(f[0])">
              <button type="button" class="col-toggle" :aria-expanded="true" :aria-label="`Contraer columna ${COL[f[0]].name}`" :title="`Contraer ${COL[f[0]].name}`" @click="toggleCol(f[0])">
                <span class="gico" :style="tint(COL[f[0]].color)"><Icon :name="COL[f[0]].icon" :size="15" /></span>
                <b class="grow cname">{{ COL[f[0]].name }}</b>
                <span class="badge">{{ byStatus(f[0]).length }}</span>
                <span class="fold-ic"><Icon name="collapse" :size="14" style="transform:rotate(90deg)" /></span>
              </button>
              <button class="mini" :class="{ on: sortOf(f[0]) !== 'manual' }" :aria-expanded="sortOpen === f[0]" :aria-label="`Ordenar ${COL[f[0]].name}: ${sortName(f[0])}`" :title="`Orden: ${sortName(f[0])}`" @click.stop="sortOpen = sortOpen === f[0] ? null : f[0]"><Icon name="menu" :size="14" /></button>
              <button class="mini" :aria-label="`Nuevo proyecto en ${COL[f[0]].name}`" @click.stop="ui.modal = { type: 'project', prefill: { status: f[0] } }"><Icon name="plus" :size="14" /></button>
            </header>
            <div v-if="sortOpen === f[0]" class="sortmenu" role="menu" :aria-label="`Orden de ${COL[f[0]].name}`">
              <button v-for="o in SORTS" :key="o[0]" type="button" role="menuitemradio" :aria-checked="sortOf(f[0]) === o[0]" :class="{ on: sortOf(f[0]) === o[0] }" @click="setSort(f[0], o[0])"><span class="ck"><Icon v-if="sortOf(f[0]) === o[0]" name="check" :size="13" /></span>{{ o[1] }}</button>
            </div>
            <div class="col-body">
              <template v-for="(p, i) in cols[f[0]]" :key="p.id">
              <div v-if="drag && drag.col === f[0] && drag.id !== p.id && drag.index === visIdx(f[0], p)" class="kdrop" :style="{ height: drag.h + 'px' }"></div>
              <article class="kcard" :class="{ lifted: drag && drag.id === p.id }" :data-pid="p.id" @pointerdown="onDown($event, p)" @click="openCard(p)">
                <span class="strip" :style="{ background: p.color || 'var(--lav-300)' }"></span>
                <div class="b small kname">{{ p.name }}</div>
                <div class="tiny muted kmeta"><span>{{ p.area }}</span><span v-if="p.due">· {{ shortDate(p.due) }}</span></div>
                <Bar :value="A.projectProgress(p)" style="margin-top:8px" :color="p.color" />
                <div class="row between" style="margin-top:8px">
                  <span class="tiny muted row" style="gap:4px"><Icon name="check" :size="12" />{{ tasksOf(p).filter((t) => t.status === 'completada').length }}/{{ tasksOf(p).length }}</span>
                  <span class="row" style="gap:0">
                    <button class="mini mv-up" :disabled="i === 0" :aria-label="`Subir ${p.name} en la columna`" @click.stop="nudge(p, -1)"><Icon name="chev" :size="13" style="transform:rotate(-90deg)" /></button>
                    <button class="mini mv-down" :disabled="i === cols[f[0]].length - 1" :aria-label="`Bajar ${p.name} en la columna`" @click.stop="nudge(p, 1)"><Icon name="chev" :size="13" style="transform:rotate(90deg)" /></button>
                    <button class="mini" :disabled="f[0] === FLOW[0][0]" :aria-label="`Mover ${p.name} a la etapa anterior`" @click.stop="move(p, -1)"><Icon name="back" :size="13" /></button>
                    <button class="mini" :disabled="f[0] === FLOW[FLOW.length - 1][0]" :aria-label="`Mover ${p.name} a la siguiente etapa`" @click.stop="move(p, 1)"><Icon name="chev" :size="13" /></button>
                  </span>
                </div>
              </article>
              </template>
              <div v-if="drag && drag.col === f[0] && drag.index >= colCards(f[0]).length" class="kdrop" :style="{ height: drag.h + 'px' }"></div>
              <p v-if="!colCards(f[0]).length && !(drag && drag.col === f[0])" class="tiny muted empty-col">Arrastra un proyecto aquí</p>
            </div>
          </template>
        </section>
    <div v-if="drag" class="kghost" :style="{ left: drag.x - drag.ox + 'px', top: drag.y - drag.oy + 'px', width: drag.w + 'px' }" aria-hidden="true">
          <span class="strip" :style="{ background: drag.color || 'var(--lav-300)' }"></span><div class="b small kname">{{ drag.name }}</div>
        </div>
      </div>

      <template v-else>
        <GroupCard v-for="g in listGroups" :key="g.key" :title="g.name" :icon="g.icon" :color="g.color" :count="g.v.length" :open="!lfold[g.key]" @toggle="lfold[g.key] = !lfold[g.key]">
          <div class="list">
            <button v-for="p in g.v" :key="p.id" class="prow" @click="A.go('proyectos', { id: p.id })">
              <Ring :value="A.projectProgress(p)" :size="40" /><div class="grow" style="min-width:0"><div class="b small kname">{{ p.name }}</div><div class="tiny muted" style="text-transform:capitalize">{{ p.area }}{{ p.due ? ' · ' + shortDate(p.due) : '' }}</div></div><Icon name="chev" :size="16" class="muted" />
            </button>
          </div>
        </GroupCard>
        <p v-if="!projects.length" class="small muted" style="text-align:center">No hay proyectos en esta área todavía.</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.kanban { display: flex; align-items: stretch; gap: 10px; overflow-x: auto; overflow-y: hidden; padding: 0 4px 6px; margin: 0 -4px; scroll-snap-type: x proximity; min-height: 320px; overscroll-behavior-x: contain; }
.kanban.dragging, .kanban.panning { scroll-snap-type: none; user-select: none; }
.kanban { scrollbar-width: none; touch-action: pan-x pan-y; cursor: grab; -webkit-overflow-scrolling: touch; }
.kanban::-webkit-scrollbar { display: none; }
.kanban.panning { cursor: grabbing; }
.col { flex: 1 0 250px; min-width: 0; background: var(--surface-3); border-radius: 18px; padding: 10px; display: flex; flex-direction: column; gap: 10px; min-height: 0; scroll-snap-align: start; transition: flex-basis .28s ease, flex-grow .28s ease, box-shadow .15s, padding .28s; overflow: hidden; }
.col.over { box-shadow: inset 0 0 0 2px var(--pink-300); }
.col.folded { flex: 0 0 48px; padding: 6px 0; }
.col-head { display: flex; align-items: center; gap: 4px; font-size: 14px; padding: 2px 0 0 2px; cursor: pointer; }
.col-toggle { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; padding: 0; cursor: pointer; border-radius: 10px; }
.col-toggle:focus-visible, .strip-btn:focus-visible { outline: 2px solid var(--pink-300); outline-offset: 2px; }
.fold-ic { width: 24px; height: 24px; display: grid; place-items: center; color: var(--muted); border-radius: 8px; flex: none; }
.col-toggle:hover .fold-ic { color: var(--pink-700); background: var(--surface); }
.cname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.strip-btn { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 14px; padding: 4px 0; cursor: pointer; border-radius: 14px; }
.strip-btn:hover { background: color-mix(in srgb, var(--pink-100) 50%, transparent); }
.vname { writing-mode: vertical-rl; white-space: nowrap; letter-spacing: .02em; margin-top: 4px; }
.xbtn { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: var(--muted); background: var(--surface); flex: none; margin-top: auto; }
.strip-btn:hover .xbtn { color: var(--pink-700); }
.gico { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; flex: none; }
.col-body { display: flex; flex-direction: column; gap: 8px; min-width: 228px; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; margin: 0 -4px; padding: 2px 4px 6px; scrollbar-width: none; touch-action: pan-x pan-y; }
.col-body::-webkit-scrollbar { display: none; }
.prow { display: flex; gap: 12px; align-items: center; width: 100%; padding: 10px 2px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.prow:last-child { border-bottom: 0; }
.kcard { flex: none; touch-action: manipulation; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; position: relative; background: var(--surface); border-radius: 14px; padding: 12px 12px 10px 16px; box-shadow: var(--shadow); cursor: grab; overflow: hidden; }
.kcard:active { cursor: grabbing; }
.kcard.lifted { display: none; }
.kdrop { flex: none; border-radius: 14px; border: 2px dashed var(--pink-300); background: color-mix(in srgb, var(--pink-100) 45%, transparent); }
.kghost { position: fixed; z-index: 60; pointer-events: none; background: var(--surface); border-radius: 14px; padding: 12px 12px 12px 16px; box-shadow: var(--shadow-lg); overflow: hidden; transform: rotate(2deg); opacity: .95; }
.mini.on { color: var(--pink-700); background: var(--pink-100); }
.sortmenu { display: flex; flex-direction: column; background: var(--surface); border-radius: 12px; padding: 4px; box-shadow: var(--shadow); flex: none; }
.sortmenu button { display: flex; align-items: center; gap: 6px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 13px; text-align: left; padding: 7px 8px; border-radius: 9px; cursor: pointer; }
.sortmenu button:hover { background: var(--surface-3); }
.sortmenu button.on { color: var(--pink-700); font-weight: 600; }
.sortmenu .ck { width: 14px; display: grid; place-items: center; flex: none; }
.strip { position: absolute; left: 0; top: 0; bottom: 0; width: 5px; }
.kname { overflow-wrap: anywhere; }
.kmeta { display: flex; gap: 4px; margin-top: 2px; text-transform: capitalize; }
.mini { flex: none; width: 26px; height: 26px; border-radius: 8px; border: 0; background: transparent; color: var(--muted); display: grid; place-items: center; cursor: pointer; }
.mini:hover:not(:disabled) { background: var(--surface-3); color: var(--pink-700); }
.mini:disabled { opacity: .3; cursor: default; }
.subj { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: inherit; font: inherit; text-align: left; padding: 10px 2px; cursor: pointer; }
.subj:last-child { border-bottom: 0; }
.empty-col { text-align: center; padding: 18px 6px; border: 1.5px dashed var(--line); border-radius: 12px; }
</style>
