<script setup>
import { computed } from 'vue'
import { toast } from '../engine/game'
import { Icon } from './ui'

// Correo o celular: se puede tocar (correo → Gmail, celular → WhatsApp) y copiar con el cuadrito
const props = defineProps({ value: { type: String, required: true }, kind: { type: String, default: '' }, as: { type: String, default: '' }, label: { type: String, default: '' }, text: { type: String, default: '' } })
const type = computed(() => props.kind || (props.value.includes('@') ? 'email' : 'phone'))
const wa = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d }
const href = computed(() => type.value === 'email'
  ? `https://mail.google.com/mail/?view=cm&fs=1${props.as ? '&authuser=' + encodeURIComponent(props.as) : ''}&to=${encodeURIComponent(props.value)}${props.text ? '&body=' + encodeURIComponent(props.text) : ''}`
  : wa(props.value).length < 7 ? null : `https://wa.me/${wa(props.value)}${props.text ? '?text=' + encodeURIComponent(props.text) : ''}`)
async function copy() {
  try { await navigator.clipboard.writeText(props.value); toast(`${type.value === 'email' ? 'Correo' : 'Número'} copiado`) } catch { toast('No pude copiar; mantén presionado el texto') }
}
</script>

<template>
  <span class="contact">
    <a v-if="href" :href="href" target="_blank" rel="noopener" :title="type === 'email' ? 'Escribir correo' : 'Abrir WhatsApp'"><Icon v-if="!label" :name="type === 'email' ? 'mail' : 'chat'" :size="14" class="inl" /> {{ label || value }}</a>
    <span v-else>{{ label || value }}</span>
    <button type="button" class="cp" :aria-label="`Copiar ${value}`" title="Copiar" @click.stop.prevent="copy">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></svg>
    </button>
  </span>
</template>

<style scoped>
.contact { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; }
.contact a { color: inherit; text-decoration: none; overflow-wrap: anywhere; }
.contact a:hover { color: var(--pink-700); }
.cp { border: 0; background: transparent; color: var(--muted); padding: 4px; border-radius: 8px; cursor: pointer; display: inline-grid; place-items: center; min-width: 24px; min-height: 24px; }
.cp:hover { background: var(--pink-100); color: var(--pink-700); }
</style>
