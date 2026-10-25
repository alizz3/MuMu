<script setup>
// Fotos del vehículo (guardadas en privado). Si hay varias, se turnan con un fundido suave.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '../../components/ui'
import { thumbUrl } from './files'
import { garage } from './actions'
import { photosOf } from './logic'
const props = defineProps({
  vehicle: { type: Object, required: true }, size: { type: [Number, String], default: 52 }, height: { type: [Number, String], default: null },
  radius: { type: Number, default: 16 }, icon: { type: String, default: 'moto' }, every: { type: Number, default: 4500 }, dots: { type: Boolean, default: false },
})
const px = (x) => (typeof x === 'number' ? x + 'px' : x)
const iconSize = Math.min(64, Math.round((typeof props.height === 'number' ? props.height : typeof props.size === 'number' ? props.size : 120) / 2.4))
const urls = ref({}) // id -> objectURL
const ids = computed(() => photosOf(props.vehicle))
const ready = computed(() => ids.value.filter((id) => urls.value[id]))
const idx = ref(0)
watch(ids, async (list) => {
  idx.value = 0
  for (const id of list) {
    if (urls.value[id]) continue
    const meta = garage().files.find((f) => f.id === id)
    if (!meta) continue
    try { const u = await thumbUrl(meta); urls.value = { ...urls.value, [id]: u } } catch { /* sin conexión: se queda el ícono */ }
  }
}, { immediate: true })
let timer = null
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function start() {
  stop()
  if (calm()) return
  // Cada tarjeta arranca un poco desfasada para que no cambien todas a la vez
  const offset = (props.vehicle.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 1500
  timer = setTimeout(function tick() { if (ready.value.length > 1 && !document.hidden) idx.value = (idx.value + 1) % ready.value.length; timer = setTimeout(tick, props.every) }, props.every + offset)
}
function stop() { clearTimeout(timer); timer = null }
onMounted(start)
onBeforeUnmount(() => { stop(); Object.values(urls.value).forEach((u) => URL.revokeObjectURL(u)) })
</script>

<template>
  <span class="vph" :style="{ width: px(size), height: px(height ?? size), borderRadius: radius + 'px' }">
    <template v-if="ready.length">
      <img v-for="(id, i) in ready" :key="id" :src="urls[id]" :alt="i === idx % ready.length ? `Foto de ${vehicle.name}` : ''" :class="{ on: i === idx % ready.length }" />
      <span v-if="dots && ready.length > 1" class="vdots" aria-hidden="true"><i v-for="(id, i) in ready" :key="id" :class="{ on: i === idx % ready.length }"></i></span>
    </template>
    <Icon v-else :name="icon" :size="iconSize" />
  </span>
</template>

<style scoped>
.vph { position: relative; display: grid; place-items: center; flex: none; overflow: hidden; background: color-mix(in srgb, #C3B3D4 40%, var(--surface)); color: var(--ink); }
.vph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.04); transition: opacity 1.2s ease, transform 6s ease-out; }
.vph img.on { opacity: 1; transform: scale(1); }
.vdots { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); display: flex; gap: 5px; padding: 4px 7px; border-radius: 999px; background: rgba(30, 20, 30, .28); }
.vdots i { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, .55); transition: background .4s, width .4s; }
.vdots i.on { background: #fff; width: 14px; border-radius: 3px; }
@media (prefers-reduced-motion: reduce) { .vph img { transition: none; transform: none; } }
</style>
