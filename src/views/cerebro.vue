<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { isOpen } from '../engine/planner'
import { dayKey, uid, shortDate } from '../engine/time'
import { Icon, Pet, Chip, Bar } from '../components/ui'

const type = ref('todos')
const q = ref('')
const open = ref(null)
const TYPES = [['todos', 'Todos'], ['libro', 'Libros'], ['podcast', 'Podcasts'], ['video', 'Videos'], ['conferencia', 'Conferencias'], ['nota', 'Notas'], ['idea', 'Ideas']]
const EMO = { libro: '📖', podcast: '🎧', video: '🎬', conferencia: '🎤', nota: '📝', idea: '💡' }
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
    <div class="row"><input class="input grow" v-model="q" placeholder="Buscar contenido…" aria-label="Buscar en Mi cerebro" />
      <button class="iconbtn add" aria-label="Agregar aprendizaje" @click="ui.modal = { type: 'resource', prefill: { type: type === 'todos' ? 'libro' : type } }"><Icon name="plus" /></button></div>
    <div class="chips"><Chip v-for="t in TYPES" :key="t[0]" :active="type === t[0]" @click="type = t[0]">{{ t[1] }}</Chip></div>

    <div class="card pink now-card" style="min-height:150px">
      <div class="tiny b muted">PARA LO QUE ESTÁS VIVIENDO HOY 💡 · {{ today.why }}</div>
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
      <div class="list"><div v-for="r in continuing" :key="r.id" class="item" @click="open = r.id" style="cursor:pointer">
        <span class="ico lav" style="font-size:18px">{{ EMO[r.type] }}</span>
        <div class="grow"><div class="title-line">{{ r.title }}</div><div class="tiny muted">{{ r.author }} · {{ r.type }}</div><Bar :value="r.progress" color="var(--lav-500)" style="margin-top:5px" /></div>
        <Icon name="chev" :size="16" />
      </div></div>
    </div>

    <div class="sec-title"><h2>Biblioteca viva</h2><span class="tiny muted">Contenido → Concepto → Principio → Acción → Experimento</span></div>
    <div v-for="r in list" :key="r.id" class="card">
      <button class="row" style="all:unset;display:flex;gap:10px;align-items:center;width:100%;cursor:pointer" @click="open = open === r.id ? null : r.id" :aria-expanded="open === r.id">
        <span class="ico" style="font-size:18px">{{ EMO[r.type] || '📌' }}</span>
        <div class="grow"><div class="b small">{{ r.title }}</div><div class="tiny muted">{{ r.author }} · {{ r.status }}{{ r.minutes ? ' · ' + r.minutes + ' min' : '' }}</div></div>
        <span class="badge">{{ principlesOf(r).length }} principios</span>
      </button>
      <div v-if="open === r.id" class="stack" style="gap:8px;margin-top:10px">
        <div class="row wrap" style="gap:4px"><span v-for="c in r.concepts" :key="c" class="badge pink">{{ c }}</span></div>
        <p v-if="r.notes" class="quote small">{{ r.notes }}</p>
        <div v-for="p in principlesOf(r)" :key="p.id" class="card tight soft">
          <div class="small b">{{ p.text }}</div><div class="tiny muted">→ {{ p.action }} · <span class="badge">{{ p.status }}</span></div>
          <button v-if="p.status !== 'probando'" class="btn sm lav" style="margin-top:6px" @click="A.startExperiment(p.id); A.go('experimentos')">🧪 Probar 7 días</button>
        </div>
        <p class="tiny muted">Son ideas y perspectivas para probar, no verdades absolutas.</p>
        <div class="row" style="gap:6px">
          <button class="btn sm primary" @click="ui.modal = { type: 'principle', prefill: { sourceId: r.id, author: r.author, status: 'idea' } }">+ Principio</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'resource', id: r.id }"><Icon name="edit" :size="14" />Editar</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'task', prefill: { title: `Aprender: ${r.title}`, category: 'aprendizaje', source: 'aprendizaje' } }">+ Sesión</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Mis notas e ideas</h3>
      <div class="row" style="margin-top:8px"><input class="input" v-model="noteText" placeholder="Algo que aprendí hoy…" @keyup.enter="addNote" /><button class="btn sm lav" @click="addNote">+</button></div>
      <div v-for="n in state.notes" :key="n.id" class="item small"><span class="grow">{{ n.text }}</span><span class="tiny muted">{{ shortDate(n.date) }}</span>
        <button class="iconbtn" style="width:28px;height:28px" aria-label="Borrar nota" @click="state.notes = state.notes.filter((x) => x.id !== n.id)"><Icon name="x" :size="14" /></button></div>
    </div>
  </div>
</template>
