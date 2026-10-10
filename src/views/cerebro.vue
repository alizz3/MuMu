<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { isOpen } from '../engine/planner'
import { dayKey, uid, shortDate } from '../engine/time'
import { Icon, Pet, Bar } from '../components/ui'
import Seg from '../components/Seg.vue'
import ListBar from '../components/ListBar.vue'
import GroupCard from '../components/GroupCard.vue'
import { RESOURCE_ICON } from '../components/iconFor'

const type = computed({ get: () => state.settings.brainType || 'todos', set: (v) => (state.settings.brainType = v) })
const q = ref('')
const opened = ref({})
const TYPES = [['todos', 'Todos'], ['libro', 'Libros'], ['podcast', 'Podcasts'], ['video', 'Videos'], ['conferencia', 'Conferencias'], ['nota', 'Notas'], ['idea', 'Ideas']]
const typeOpts = computed(() => TYPES.map((t) => [t[0], t[1], t[0] === 'todos' ? null : RESOURCE_ICON[t[0]] || null, t[0] === 'todos' ? state.resources.length : state.resources.filter((r) => r.type === t[0]).length]).filter((t) => t[0] === 'todos' || t[3] || type.value === t[0]))
const COLORS = { libro: '#C3B3D4', podcast: '#BFD7F0', video: '#F7B6C2', conferencia: '#FFE29A', nota: '#B9DCCB', idea: '#FFE29A' }
const allFolded = computed(() => list.value.length > 0 && list.value.every((r) => !opened.value[r.id]))
const foldAll = () => { const v = allFolded.value; list.value.forEach((r) => (opened.value[r.id] = v)) }
function openRes(r) { opened.value[r.id] = true; setTimeout(() => document.getElementById('res-' + r.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }
const list = computed(() => state.resources.filter((r) => (type.value === 'todos' || r.type === type.value) && (!q.value || (r.title + r.author + r.notes + r.concepts.join(' ')).toLowerCase().includes(q.value.toLowerCase()))))
const continuing = computed(() => state.resources.filter((r) => ['leyendo', 'escuchando', 'viendo'].includes(r.status)))

// "Para lo que estás viviendo hoy…": detecta el contexto y busca principios/recursos relacionados
const today = computed(() => {
  const open = state.tasks.filter(isOpen)
  const tags = []
  let why = ''
  if (open.some((t) => (t.postponed || 0) >= 2)) { tags.push('procrastinación', 'empezar'); why = 'Estás posponiendo algo' }
  else if (open.length >= 8) { tags.push('prioridad', 'planificación'); why = 'Tienes muchas cosas encima' }
  else if (ui.now.getHours() < 11) { tags.push('mañana', 'rutina'); why = 'Es de mañana' }
  else { tags.push('límites', 'autoestima', 'hábitos'); why = 'Para cuidarte hoy' }
  const pr = state.principles.filter((p) => p.status !== 'descartado' && p.tags.some((t) => tags.includes(t))).slice(0, 3)
  const res = state.resources.filter((r) => pr.some((p) => p.sourceId === r.id)).slice(0, 2)
  return { why, pr, res }
})
const principlesOf = (r) => state.principles.filter((p) => p.sourceId === r.id)
const noteText = ref('')
function addNote() { if (noteText.value.trim()) { state.notes.unshift({ id: uid('n'), text: noteText.value.trim(), date: dayKey() }); noteText.value = '' } }
</script>

<template>
  <div class="stack">
    <div class="row"><label class="search grow"><Icon name="search" :size="16" /><input v-model="q" placeholder="Buscar contenido…" aria-label="Buscar en Mi cerebro" /></label>
      <button class="iconbtn add" aria-label="Agregar aprendizaje" @click="ui.modal = { type: 'resource', prefill: { type: type === 'todos' ? 'libro' : type } }"><Icon name="plus" /></button></div>
    <Seg v-model="type" :options="typeOpts" label="Tipo de contenido" />

    <div class="card pink now-card" style="min-height:150px">
      <div class="tiny b muted"><Icon name="bulb" :size="13" class="inl" /> PARA LO QUE ESTÁS VIVIENDO HOY · {{ today.why }}</div>
      <div v-for="p in today.pr" :key="p.id" style="margin-top:8px;max-width:72%">
        <div class="small b">“{{ p.text }}”</div><div class="tiny muted">{{ p.author }} → {{ p.action }}</div>
      </div>
      <div class="row" style="margin-top:10px;gap:6px">
        <button class="btn sm primary" @click="A.go('experimentos')">Convertirlo en experimento</button>
      </div>
      <Pet pose="read" :size="100" :bob="false" />
    </div>

    <div v-if="continuing.length" class="card">
      <h3>Continuar aprendiendo</h3>
      <div class="list"><div v-for="r in continuing" :key="r.id" class="item" role="button" tabindex="0" @click="openRes(r)" @keyup.enter="openRes(r)" style="cursor:pointer">
        <span class="ico lav"><Icon :name="RESOURCE_ICON[r.type] || 'pin'" :size="18" /></span>
        <div class="grow"><div class="title-line">{{ r.title }}</div><div class="tiny muted">{{ r.author }} · {{ r.type }}</div><Bar :value="r.progress" color="var(--lav-500)" style="margin-top:5px" /></div>
        <Icon name="chev" :size="16" />
      </div></div>
    </div>

    <div class="sec-title"><h2>Biblioteca viva</h2><span class="tiny muted">Contenido → Concepto → Principio → Acción → Experimento</span></div>
    <ListBar :count="list.length" one="recurso" :foldable="list.length > 1" :all-folded="allFolded" @fold="foldAll" />
    <GroupCard v-for="r in list" :id="'res-' + r.id" :key="r.id" :title="r.title" :sub="`${r.author} · ${r.status}${r.minutes ? ' · ' + r.minutes + ' min' : ''}`" :icon="RESOURCE_ICON[r.type] || 'pin'" :color="COLORS[r.type]" :open="!!opened[r.id]" @toggle="opened[r.id] = !opened[r.id]">
      <template #badge><span class="badge" :title="`${principlesOf(r).length} principios`"><Icon name="bulb" :size="12" />{{ principlesOf(r).length }}</span></template>

      <div class="stack" style="gap:8px">
        <div class="row wrap" style="gap:4px"><span v-for="c in r.concepts" :key="c" class="badge pink">{{ c }}</span></div>
        <p v-if="r.notes" class="quote small">{{ r.notes }}</p>
        <div v-for="p in principlesOf(r)" :key="p.id" class="card tight soft">
          <div class="small b">{{ p.text }}</div><div class="tiny muted">→ {{ p.action }} · <span class="badge">{{ p.status }}</span></div>
          <button v-if="p.status !== 'probando'" class="btn sm lav" style="margin-top:6px" @click="A.startExperiment(p.id); A.go('experimentos')"><Icon name="flask" :size="14" />Probar 7 días</button>
        </div>
        <p class="tiny muted">Son ideas y perspectivas para probar, no verdades absolutas.</p>
        <div class="row" style="gap:6px">
          <button class="btn sm primary" @click="ui.modal = { type: 'principle', prefill: { sourceId: r.id, author: r.author, status: 'idea' } }">+ Principio</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'resource', id: r.id }"><Icon name="edit" :size="14" />Editar</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'task', prefill: { title: `Aprender: ${r.title}`, category: 'aprendizaje', source: 'aprendizaje' } }">+ Sesión</button>
        </div>
      </div>
    </GroupCard>
    <p v-if="!list.length" class="small muted" style="text-align:center">{{ q ? 'No encontré nada con eso' : 'Nada de este tipo todavía' }}</p>

    <div class="card">
      <h3>Mis notas e ideas</h3>
      <div class="row" style="margin-top:8px"><input class="input" v-model="noteText" placeholder="Algo que aprendí hoy…" @keyup.enter="addNote" /><button class="btn sm lav" @click="addNote">+</button></div>
      <div v-for="n in state.notes" :key="n.id" class="item small"><span class="grow">{{ n.text }}</span><span class="tiny muted">{{ shortDate(n.date) }}</span>
        <button class="iconbtn" style="width:28px;height:28px" aria-label="Borrar nota" @click="state.notes = state.notes.filter((x) => x.id !== n.id)"><Icon name="x" :size="14" /></button></div>
    </div>
  </div>
</template>

<style scoped>
.search { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 0 12px; color: var(--muted); min-width: 0; }
.search input { border: 0; background: transparent; color: var(--ink); font: inherit; padding: 11px 0; width: 100%; outline: none; }
.search:focus-within { border-color: var(--pink-300); }
</style>
