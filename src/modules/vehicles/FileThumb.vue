<script setup>
// Miniatura de una foto privada del Garaje (se arma desde el servidor, sin enlace público)
import { ref, watch, onBeforeUnmount } from 'vue'
import { Icon } from '../../components/ui'
import { thumbUrl } from './files'
import { garage } from './actions'
const props = defineProps({ id: { type: String, default: null }, size: { type: Number, default: 56 }, icon: { type: String, default: 'image' }, alt: { type: String, default: '' } })
const url = ref(null); let made = null
watch(() => props.id, async (id) => { url.value = null; const m = id && garage().files.find((f) => f.id === id); if (!m) return; try { made = await thumbUrl(m); url.value = made } catch { url.value = null } }, { immediate: true })
onBeforeUnmount(() => { if (made) URL.revokeObjectURL(made) })
</script>
<template>
  <span class="fth" :style="{ width: size + 'px', height: size + 'px' }"><img v-if="url" :src="url" :alt="alt" /><Icon v-else :name="icon" :size="Math.round(size / 2.6)" /></span>
</template>
<style scoped>
.fth { display: grid; place-items: center; flex: none; border-radius: 12px; overflow: hidden; background: var(--lav-100); color: var(--lav-700); }
.fth img { width: 100%; height: 100%; object-fit: cover; }
</style>
