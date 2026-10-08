<script setup>
import { computed, ref } from 'vue'
import { toast, ask } from '../engine/game'
import { uid } from '../engine/time'
import { Icon } from './ui'

// Enlaces guardados (carpeta de Drive, chat con Claude, Tu Aula…): se pega el enlace y MuMu reconoce qué es
const props = defineProps({ target: { type: Object, required: true }, field: { type: String, default: 'links' }, title: { type: String, default: 'Enlaces' }, hint: { type: String, default: '' } })
const list = computed(() => props.target[props.field] || [])
const KINDS = [
  [/drive\.google\.com\/drive\/(u\/\d+\/)?folders/, '📁', 'Carpeta de Drive'],
  [/drive\.google\.com|docs\.google\.com\/(document|spreadsheets|presentation)/, '📄', 'Archivo de Drive'],
  [/claude\.ai\/(chat|project)/, '🤖', 'Chat con Claude'],
  [/tuaulavirtual|moodle/, '🎓', 'Tu Aula'],
  [/classroom\.google\.com/, '🏫', 'Classroom'],
  [/meet\.google\.com|zoom\.us|teams\.microsoft/, '🎥', 'Videollamada'],
  [/youtube\.com|youtu\.be/, '▶️', 'Video'],
]
const kindOf = (url) => KINDS.find(([re]) => re.test(url)) || [null, '🔗', 'Enlace']
const adding = ref(false), url = ref(''), label = ref('')
function add() {
  let u = url.value.trim()
  if (!u) return
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  if (!/^https?:\/\/[^\s]+$/i.test(u)) return toast('Ese enlace no se ve bien 🤔')
  props.target[props.field] = [...list.value, { id: uid('l'), url: u, label: label.value.trim() || kindOf(u)[2] }]
  url.value = ''; label.value = ''; adding.value = false
}
async function remove(l) { if (await ask(`¿Quitar "${l.label}"?`)) props.target[props.field] = list.value.filter((x) => x.id !== l.id) }
</script>

<template>
  <div class="stack" style="gap:8px">
    <div class="row between"><h3>{{ title }}</h3><button class="link" @click="adding = !adding">{{ adding ? 'Cancelar' : '+ Enlace' }}</button></div>
    <div v-if="list.length" class="row wrap" style="gap:6px">
      <span v-for="l in list" :key="l.id" class="lk">
        <a :href="l.url" target="_blank" rel="noopener">{{ kindOf(l.url)[1] }} {{ l.label }}</a>
        <button type="button" class="x" :aria-label="`Quitar ${l.label}`" @click="remove(l)"><Icon name="x" :size="12" /></button>
      </span>
    </div>
    <p v-else-if="!adding" class="tiny muted">{{ hint || 'Guarda aquí la carpeta de Drive, tu chat con Claude o lo que uses para esta materia.' }}</p>
    <div v-if="adding" class="stack" style="gap:6px">
      <input class="input" v-model="url" inputmode="url" placeholder="Pega el enlace (Drive, Claude, Tu Aula…)" aria-label="Enlace" @keyup.enter="add" />
      <div class="row"><input class="input" v-model="label" :placeholder="url ? kindOf(url)[2] : 'Nombre (opcional)'" aria-label="Nombre del enlace" @keyup.enter="add" /><button class="btn sm primary" @click="add">Guardar</button></div>
    </div>
  </div>
</template>

<style scoped>
.lk { display: inline-flex; align-items: center; gap: 2px; background: var(--lav-50); border: 1px solid var(--line); border-radius: 999px; padding: 4px 4px 4px 12px; max-width: 100%; }
.lk a { color: inherit; text-decoration: none; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk a:hover { color: var(--pink-700); }
.x { border: 0; background: transparent; color: var(--muted); border-radius: 50%; width: 24px; height: 24px; display: grid; place-items: center; cursor: pointer; flex: none; }
.x:hover { background: var(--pink-100); color: var(--pink-700); }
</style>
