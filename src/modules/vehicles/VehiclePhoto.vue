<script setup>
// Foto del vehículo (guardada en privado): se arma en el equipo desde el servidor, sin enlace público
import { ref, watch, onBeforeUnmount } from 'vue'
import { Icon } from '../../components/ui'
import { thumbUrl } from './files'
import { garage } from './actions'
const props = defineProps({ vehicle: { type: Object, required: true }, size: { type: [Number, String], default: 52 }, height: { type: [Number, String], default: null }, radius: { type: Number, default: 16 }, icon: { type: String, default: 'moto' } })
const url = ref(null)
let made = null
const px = (x) => (typeof x === 'number' ? x + 'px' : x)
const iconSize = Math.min(64, Math.round((typeof props.height === 'number' ? props.height : typeof props.size === 'number' ? props.size : 120) / 2.4))
watch(() => props.vehicle.photoFileId, async (id) => {
  url.value = null
  const meta = id && garage().files.find((f) => f.id === id)
  if (!meta) return
  try { made = await thumbUrl(meta); url.value = made } catch { url.value = null }
}, { immediate: true })
onBeforeUnmount(() => { if (made) URL.revokeObjectURL(made) })
</script>
<template>
  <span class="vph" :style="{ width: px(size), height: px(height ?? size), borderRadius: radius + 'px' }">
    <img v-if="url" :src="url" :alt="`Foto de ${vehicle.name}`" />
    <Icon v-else :name="icon" :size="iconSize" />
  </span>
</template>
<style scoped>
.vph { display: grid; place-items: center; flex: none; border-radius: 16px; overflow: hidden; background: color-mix(in srgb, #C3B3D4 40%, var(--surface)); color: var(--ink); }
.vph img { width: 100%; height: 100%; object-fit: cover; }
</style>
