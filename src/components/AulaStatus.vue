<script setup>
import { computed, onMounted } from 'vue'
import { ui } from '../store'
import { aulaStatus, canUseBackend } from '../services/api'
import { Icon } from './ui'

const s = computed(() => ui.aulaStatus)
onMounted(() => { if (canUseBackend()) aulaStatus() })
const label = computed(() => {
  if (!canUseBackend()) return { t: 'Estado de Tu Aula: necesita el servidor', c: 'demo' }
  const x = s.value
  if (!x || x.checking) return { t: 'Revisando Tu Aula…', c: '' }
  if (x.error) return { t: 'No pude revisar Tu Aula', c: 'yellow' }
  if (x.online && x.slow) return { t: `Tu Aula en línea, pero lenta (${(x.ms / 1000).toFixed(1)} s)`, c: 'yellow' }
  if (x.online) return { t: 'Tu Aula en línea', c: 'green' }
  return { t: `Tu Aula caída · ${x.reason || 'error ' + x.status}`, c: 'red' }
})
const ago = computed(() => (s.value?.checkedAt && !s.value.checking ? new Date(s.value.checkedAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : ''))
</script>

<template>
  <div class="row" style="gap:8px" role="status" aria-live="polite">
    <span class="badge" :class="label.c" style="font-size:12px;padding:5px 10px">
      <i style="width:8px;height:8px;border-radius:50%;display:inline-block" :style="{ background: label.c === 'green' ? 'var(--ok)' : label.c === 'red' ? 'var(--danger)' : label.c === 'yellow' ? 'var(--warn)' : 'var(--muted)' }"></i>
      {{ label.t }}
    </span>
    <span v-if="ago" class="tiny muted">{{ ago }}</span>
    <button v-if="canUseBackend()" class="iconbtn" style="width:30px;height:30px" aria-label="Revisar de nuevo Tu Aula" :disabled="s?.checking" @click="aulaStatus(true)"><Icon name="refresh" :size="15" /></button>
  </div>
</template>
