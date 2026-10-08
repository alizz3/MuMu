<script setup>
import { computed, ref, watch } from 'vue'
import { listDrive, driveAccount } from '../services/api'
import { Icon } from './ui'

// Explorador de Drive dentro de MuMu: carpetas, archivos y vista previa sin salir de la app
const props = defineProps({ root: { type: String, required: true }, height: { type: Number, default: 0 }, title: { type: String, default: '' } })
// Con título se ve plegado: solo el encabezado; al tocarlo se abre y al tocarlo otra vez se cierra
const open = ref(!props.title)
const rootName = ref('')
const path = ref([])            // [{ id, name }]
const items = ref([])
const loading = ref(false)
const error = ref('')
const preview = ref(null)
const acc = computed(() => driveAccount())
const here = computed(() => path.value[path.value.length - 1]?.id || props.root)
const au = computed(() => (acc.value?.email ? `authuser=${encodeURIComponent(acc.value.email)}` : ''))

async function load() {
  if (!acc.value) return
  loading.value = true; error.value = ''
  try {
    const r = await listDrive(here.value)
    items.value = r.items
    if (!path.value.length) { path.value = [{ id: r.folder.id, name: r.folder.name }]; rootName.value = r.folder.name }
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
watch(() => [props.root, acc.value?.id], () => { path.value = []; load() }, { immediate: true })
function openItem(f) {
  if (f.folder) { path.value = [...path.value, { id: f.id, name: f.name }]; load() }
  else preview.value = f
}
function goTo(i) { path.value = path.value.slice(0, i + 1); load() }

const ICON = (m) => (m.includes('folder') ? '📁' : m.includes('pdf') ? '📕' : m.includes('document') || m.includes('word') ? '📄' : m.includes('spreadsheet') || m.includes('excel') ? '📊' : m.includes('presentation') || m.includes('powerpoint') ? '📽️' : m.startsWith('image/') ? '🖼️' : m.startsWith('video/') ? '🎬' : m.startsWith('audio/') ? '🎧' : '📎')
function previewUrl(f) {
  const q = au.value ? `?${au.value}` : ''
  if (f.mime === 'application/vnd.google-apps.document') return `https://docs.google.com/document/d/${f.id}/preview${q}`
  if (f.mime === 'application/vnd.google-apps.spreadsheet') return `https://docs.google.com/spreadsheets/d/${f.id}/preview${q}`
  if (f.mime === 'application/vnd.google-apps.presentation') return `https://docs.google.com/presentation/d/${f.id}/preview${q}`
  return `https://drive.google.com/file/d/${f.id}/preview${q}`
}
const openUrl = (f) => (f.url ? f.url + (au.value ? (f.url.includes('?') ? '&' : '?') + au.value : '') : `https://drive.google.com/drive/folders/${f.id}${au.value ? '?' + au.value : ''}`)
const fdate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '')
const fsize = (b) => (!b ? '' : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`)
</script>

<template>
  <div class="drv">
    <button v-if="title" type="button" class="drv-head" :aria-expanded="open" @click="open = !open">
      <span class="grow" style="min-width:0"><b>{{ title }}</b><span v-if="rootName" class="drv-sub">{{ rootName }}</span></span>
      <Icon name="chev" :size="18" :style="{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }" />
    </button>
    <template v-if="open">
    <!-- Sin permiso de Drive: vista simple de Google (necesita tener la sesión de esa cuenta abierta en el navegador) -->
    <template v-if="!acc">
      <iframe class="embed" :src="`https://drive.google.com/embeddedfolderview?id=${root}#list`" title="Carpeta de Drive" loading="lazy"></iframe>
      <p class="tiny muted">Para navegar carpetas y ver los archivos aquí mismo, dale a tu cuenta de la UT el permiso <b>Google Drive</b> en Configuración → Cuentas.</p>
    </template>
    <template v-else>
      <nav class="crumbs" aria-label="Ruta en Drive">
        <template v-for="(c, i) in path" :key="c.id"><span v-if="i" class="muted">›</span><button class="link" :disabled="i === path.length - 1" @click="goTo(i)">{{ c.name }}</button></template>
        <span class="grow"></span>
        <a class="link small" :href="openUrl({ id: here })" target="_blank" rel="noopener">Abrir en Drive ↗</a>
      </nav>
      <p v-if="error" class="notice">{{ error }}</p>
      <div v-else-if="loading" class="row small muted" style="padding:14px 4px;gap:8px"><span class="spin" style="width:18px;height:18px;border-width:2px"></span>Cargando Drive…</div>
      <div v-else class="files" :style="height ? { maxHeight: height + 'px' } : {}">
        <button v-for="f in items" :key="f.id" class="file" @click="openItem(f)">
          <span class="ic" aria-hidden="true">{{ ICON(f.mime) }}</span>
          <span class="nm">{{ f.name }}</span>
          <span class="meta">{{ f.folder ? '' : fsize(f.size) }} {{ fdate(f.modified) }}</span>
        </button>
        <p v-if="!items.length" class="tiny muted" style="padding:10px 4px">Carpeta vacía</p>
      </div>
    </template>
    </template>

    <!-- Vista previa del archivo -->
    <div v-if="preview" class="pv" role="dialog" aria-modal="true" :aria-label="preview.name" @click.self="preview = null">
      <div class="pv-box">
        <div class="pv-top">
          <b class="pv-name">{{ ICON(preview.mime) }} {{ preview.name }}</b>
          <a class="btn sm lav" :href="openUrl(preview)" target="_blank" rel="noopener">Abrir en Drive ↗</a>
          <button class="iconbtn" aria-label="Cerrar vista previa" @click="preview = null"><Icon name="x" :size="18" /></button>
        </div>
        <iframe class="pv-frame" :src="previewUrl(preview)" :title="preview.name" allow="autoplay; fullscreen" allowfullscreen></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drv-head { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
.drv-sub { display: block; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.drv { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.embed { width: 100%; height: 320px; border: 1px solid var(--line); border-radius: 14px; background: #fff; }
.crumbs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; min-width: 0; }
.crumbs .link { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crumbs .link:disabled { color: var(--ink); font-weight: 600; cursor: default; text-decoration: none; }
.files { display: flex; flex-direction: column; overflow-y: auto; border: 1px solid var(--line); border-radius: 14px; }
.file { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.file:last-child { border-bottom: 0; }
.file:hover { background: var(--lav-50); }
.ic { font-size: 18px; }
.nm { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.pv { position: fixed; inset: 0; z-index: 80; background: rgba(20, 12, 24, .55); display: grid; place-items: center; padding: 12px; }
.pv-box { width: min(1000px, 100%); height: min(92dvh, 900px); background: var(--surface); border-radius: 18px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, .3); }
.pv-top { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
.pv-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.pv-frame { flex: 1; width: 100%; border: 0; background: #fff; }
</style>
