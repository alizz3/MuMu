<script setup>
// La barrita de Tareas: "12 tareas" a la izquierda; a la derecha plegar todo y (opcional) cómo agrupar.
import { Icon } from './ui'
import Views from './Views.vue'
defineProps({
  count: { type: Number, default: 0 }, one: { type: String, default: 'elemento' }, many: { type: String, default: '' },
  foldable: { type: Boolean, default: false }, allFolded: { type: Boolean, default: false },
  views: { type: Array, default: null }, view: { type: [String, Number], default: null }, viewsLabel: { type: String, default: 'Agrupar' }, verb: { type: String, default: 'Agrupar por' },
})
const emit = defineEmits(['fold', 'update:view'])
</script>

<template>
  <div class="lbar">
    <span class="small muted"><slot name="count">{{ count }} {{ count === 1 ? one : many || one + 's' }}</slot></span>
    <div class="lbar-r">
      <slot />
      <button v-if="foldable" type="button" class="fold" :aria-label="allFolded ? 'Expandir todo' : 'Contraer todo'" :title="allFolded ? 'Expandir todo' : 'Contraer todo'" @click="emit('fold')"><Icon :name="allFolded ? 'expand' : 'collapse'" :size="16" /></button>
      <Views v-if="views" :model-value="view" :options="views" :label="viewsLabel" :verb="verb" @update:model-value="emit('update:view', $event)" />
      <slot name="end" />
    </div>
  </div>
</template>

<style scoped>
.lbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
.lbar > span { flex: none; }
.lbar-r { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex: 0 1 auto; min-width: 0; }
.fold { width: 32px; height: 32px; border-radius: 10px; border: 0; background: var(--surface-3); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; flex: none; }
.fold:hover { color: var(--pink-700); }
</style>
