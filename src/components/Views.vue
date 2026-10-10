<script setup>
// Selector compacto con íconos (Listas / Fecha / Prioridad…), igual al de Tareas.
// options: [[valor, 'Texto', 'icono'], ...]
import { Icon } from './ui'
defineProps({ modelValue: { type: [String, Number], default: null }, options: { type: Array, required: true }, label: { type: String, default: 'Vista' }, verb: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="views" role="radiogroup" :aria-label="label">
    <button v-for="v in options" :key="v[0]" type="button" role="radio" :aria-checked="modelValue === v[0]" :class="{ on: modelValue === v[0] }" :title="verb ? `${verb} ${v[1].toLowerCase()}` : v[1]" @click="emit('update:modelValue', v[0])"><Icon v-if="v[2]" :name="v[2]" :size="14" /><span>{{ v[1] }}</span></button>
  </div>
</template>

<style scoped>
.views { display: inline-flex; background: var(--surface-3); border-radius: 12px; padding: 3px; gap: 2px; flex: 0 1 auto; min-width: 0; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
.views::-webkit-scrollbar { display: none; }
.views button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--ink-2); font: inherit; font-size: 12.5px; padding: 6px 10px; border-radius: 9px; cursor: pointer; white-space: nowrap; }
.views button.on { background: var(--surface); color: var(--pink-700); font-weight: 600; box-shadow: var(--shadow); }
@media (max-width: 380px) { .views button:has(svg) span { display: none; } .views button { padding: 6px 8px; } }
</style>
