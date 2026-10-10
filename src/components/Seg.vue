<script setup>
// Pestañas del mismo estilo que Tareas. Si no caben, se desplazan de lado (nunca se parten en dos líneas).
// options: [[valor, 'Texto', 'icono'?, cuenta?], ...]
import { nextTick, ref, watch, onMounted } from 'vue'
import { Icon } from './ui'

const props = defineProps({ modelValue: { type: [String, Number], default: null }, options: { type: Array, required: true }, label: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const el = ref(null)
const pick = (v) => emit('update:modelValue', v)
// Deja visible la pestaña activa sin mover la página
function reveal() {
  const box = el.value, b = box?.querySelector('[aria-selected="true"]')
  if (!box || !b || box.scrollWidth <= box.clientWidth) return
  const l = b.offsetLeft - 8, r = b.offsetLeft + b.offsetWidth + 8
  if (l < box.scrollLeft) box.scrollTo({ left: l, behavior: 'smooth' })
  else if (r > box.scrollLeft + box.clientWidth) box.scrollTo({ left: r - box.clientWidth, behavior: 'smooth' })
}
watch(() => props.modelValue, () => nextTick(reveal))
onMounted(reveal)
function key(e) {
  const i = props.options.findIndex((o) => o[0] === props.modelValue)
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!d) return
  e.preventDefault()
  const n = props.options[(i + d + props.options.length) % props.options.length]
  pick(n[0])
  nextTick(() => el.value?.querySelector('[aria-selected="true"]')?.focus())
}
</script>

<template>
  <div ref="el" class="seg sc" role="tablist" :aria-label="label" @keydown="key">
    <button v-for="o in options" :key="o[0]" type="button" role="tab" :aria-selected="modelValue === o[0]" :tabindex="modelValue === o[0] ? 0 : -1" :class="{ on: modelValue === o[0] }" @click="pick(o[0])">
      <Icon v-if="o[2]" :name="o[2]" :size="14" /><span>{{ o[1] }}</span><span v-if="o[3] != null" class="n">{{ o[3] }}</span>
    </button>
  </div>
</template>

<style scoped>
.sc { grid-auto-columns: minmax(max-content, 1fr); overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; max-width: 100%; }
.sc::-webkit-scrollbar { display: none; }
.sc button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; padding: 7px 11px; cursor: pointer; font: inherit; font-size: 13px; }
.sc button.on { font-weight: 600; }
.n { font-size: 11px; font-weight: 600; min-width: 18px; padding: 0 5px; border-radius: 999px; background: var(--surface-3); color: var(--ink-2); line-height: 17px; }
.sc button.on .n { background: var(--pink-100); color: var(--pink-700); }
</style>
