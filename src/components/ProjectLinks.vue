<script setup>
// Enlaces con nombre (repo, página, Figma, Drive…). Cada uno: { id, name, url }.
// Se editan en línea: tocar el lápiz abre nombre + enlace en la misma fila.
import { computed, ref, nextTick } from 'vue'
import { toast, ask } from '../engine/game'
import { uid } from '../engine/time'
import { Icon } from './ui'
import GroupCard from './GroupCard.vue'
import { state } from '../store'

const props = defineProps({ target: { type: Object, required: true }, field: { type: String, default: 'links' }, title: { type: String, default: 'Enlaces' }, hint: { type: String, default: '' } })
const list = computed(() => props.target[props.field] || [])
// Plegable como las demás tarjetas; se recuerda abierta o cerrada por proyecto
const isOpen = computed(() => !!(state.settings.linksOpen || {})[props.target.id || props.title])
function toggleOpen() { state.settings.linksOpen = { ...(state.settings.linksOpen || {}), [props.target.id || props.title]: !isOpen.value } }

const KINDS = [
  [/github\.com|gitlab\.com|bitbucket\.org/, 'laptop', 'Repositorio'],
  [/drive\.google\.com\/drive\/(u\/\d+\/)?folders/, 'folder', 'Carpeta de Drive'],
  [/docs\.google\.com|drive\.google\.com|notion\.so|dropbox\.com/, 'note', 'Documento'],
  [/figma\.com|canva\.com/, 'image', 'Diseño'],
  [/claude\.ai/, 'robot', 'Chat con Claude'],
  [/youtube\.com|youtu\.be|loom\.com/, 'play', 'Video'],
  [/console\.firebase|firebase\.google/, 'flame', 'Firebase'],
  [/vercel\.(app|com)|netlify\.(app|com)|github\.io|pages\.dev/, 'globe', 'Página'],
  [/trello\.com|linear\.app|jira/, 'list', 'Tablero'],
]
function kindOf(url) { return KINDS.find(([re]) => re.test(url || '')) || [null, 'globe', 'Página'] }
const iconOf = (url) => kindOf(url)[1]
const host = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, '') } catch { return u } }

function normUrl(raw) {
  let u = String(raw || '').trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try { const x = new URL(u); if (!/\./.test(x.hostname) || /\s/.test(u)) return null; return x.href } catch { return null }
}

const adding = ref(false), name = ref(''), url = ref('')
const editId = ref(null), eName = ref(''), eUrl = ref('')
const urlIn = ref(null)

function openAdd() { adding.value = !adding.value; editId.value = null; if (adding.value) nextTick(() => urlIn.value?.focus()) }
function add() {
  const u = normUrl(url.value)
  if (!u) return toast('Ese enlace no se ve bien')
  props.target[props.field] = [...list.value, { id: uid('l'), name: name.value.trim() || kindOf(u)[2], url: u }]
  name.value = ''; url.value = ''; adding.value = false
}
function startEdit(l) { editId.value = l.id; eName.value = l.name; eUrl.value = l.url; adding.value = false }
function saveEdit(l) {
  const u = normUrl(eUrl.value)
  if (!u) return toast('Ese enlace no se ve bien')
  props.target[props.field] = list.value.map((x) => (x.id === l.id ? { ...x, name: eName.value.trim() || kindOf(u)[2], url: u } : x))
  editId.value = null
}
async function remove(l) { if (await ask(`¿Quitar "${l.name}"?`)) props.target[props.field] = list.value.filter((x) => x.id !== l.id) }
</script>

<template>
  <GroupCard :title="title" icon="link" color="#BFD7F0" :count="list.length || null" :sub="list.length ? '' : 'Repo, página, Figma, Drive…'" :open="isOpen" @toggle="toggleOpen">
    <div class="row" style="justify-content:flex-end;margin-top:4px"><button class="link" @click="openAdd">{{ adding ? 'Cancelar' : '+ Enlace' }}</button></div>
    <ul v-if="list.length" class="plk-list">
      <li v-for="l in list" :key="l.id" class="plk-row">
        <template v-if="editId === l.id">
          <div class="plk-form">
            <input class="input" v-model="eName" placeholder="Nombre" aria-label="Nombre del enlace" @keyup.enter="saveEdit(l)" @keyup.esc="editId = null" />
            <input class="input" v-model="eUrl" inputmode="url" placeholder="https://…" aria-label="Enlace" @keyup.enter="saveEdit(l)" @keyup.esc="editId = null" />
            <div class="row" style="gap:6px;justify-content:flex-end"><button class="btn sm ghost" @click="editId = null">Cancelar</button><button class="btn sm primary" @click="saveEdit(l)">Guardar</button></div>
          </div>
        </template>
        <template v-else>
          <a class="plk-a" :href="l.url" target="_blank" rel="noopener">
            <span class="plk-ic"><Icon :name="iconOf(l.url)" :size="16" /></span>
            <span class="plk-t"><span class="small b">{{ l.name }}</span><span class="tiny muted">{{ host(l.url) }}</span></span>
          </a>
          <button type="button" class="plk-b" :aria-label="`Editar ${l.name}`" @click="startEdit(l)"><Icon name="edit" :size="15" /></button>
          <button type="button" class="plk-b" :aria-label="`Quitar ${l.name}`" @click="remove(l)"><Icon name="trash" :size="15" /></button>
        </template>
      </li>
    </ul>
    <p v-else-if="!adding" class="tiny muted" style="margin-top:6px">{{ hint || 'Guarda aquí el repo de GitHub, la página publicada, el Figma o la carpeta de Drive.' }}</p>
    <div v-if="adding" class="plk-form" style="margin-top:8px">
      <input ref="urlIn" class="input" v-model="url" inputmode="url" placeholder="Pega el enlace (github.com/…, vercel.app…)" aria-label="Enlace" @keyup.enter="add" />
      <input class="input" v-model="name" :placeholder="url ? `Nombre (${kindOf(normUrl(url))[2]})` : 'Nombre, ej. Repositorio de GitHub'" aria-label="Nombre del enlace" @keyup.enter="add" />
      <div class="row" style="justify-content:flex-end"><button class="btn sm primary" :disabled="!url.trim()" @click="add">Guardar enlace</button></div>
    </div>
  </GroupCard>
</template>

<style scoped>
.plk-list { list-style: none; margin: 6px 0 0; padding: 0; }
.plk-row { display: flex; align-items: center; gap: 2px; border-bottom: 1px solid var(--line); padding: 4px 0; }
.plk-row:last-child { border-bottom: 0; }
.plk-a { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; color: inherit; text-decoration: none; padding: 6px 2px; border-radius: 12px; }
.plk-a:hover .b { color: var(--pink-700); }
.plk-ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; flex: none; background: var(--lav-50); border: 1px solid var(--line); color: var(--ink-2); }
.plk-t { display: flex; flex-direction: column; min-width: 0; }
.plk-t > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plk-b { width: 32px; height: 32px; border: 0; background: transparent; color: var(--muted); border-radius: 10px; display: grid; place-items: center; cursor: pointer; flex: none; }
.plk-b:hover { background: var(--pink-100); color: var(--pink-700); }
.plk-form { display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 4px 0; }
</style>
