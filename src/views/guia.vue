<script setup>
// Guía de MuMu: se lee de docs/MUMU.md, así siempre está al día con la app
import { computed, ref } from 'vue'
import { state } from '../store'
import GroupCard from '../components/GroupCard.vue'
import { Icon } from '../components/ui'
import raw from '../../docs/MUMU.md?raw'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>')
function toHtml(lines) {
  let html = '', depth = 0
  for (const l of lines) {
    const m = l.match(/^(\s*)- (.*)$/)
    if (m) {
      const d = Math.floor(m[1].length / 2) + 1
      while (depth < d) { html += '<ul>'; depth++ }
      while (depth > d) { html += '</ul>'; depth-- }
      html += `<li>${inline(m[2])}</li>`
      continue
    }
    while (depth > 0) { html += '</ul>'; depth-- }
    if (/^###\s/.test(l)) html += `<h4>${inline(l.slice(4))}</h4>`
    else if (l.trim() === '---') html += ''
    else if (l.trim()) html += `<p>${inline(l)}</p>`
  }
  while (depth > 0) { html += '</ul>'; depth-- }
  return html
}
const ICONS = { 'Lo básico': 'sparkles', Inicio: 'home', Agenda: 'calendar', Tareas: 'list', Universidad: 'cap', Proyectos: 'folder', Hábitos: 'heart', Rutinas: 'routine', Alarmas: 'alarm', 'App de Android': 'phone', 'Celular y redes': 'phone', 'Espacio con Dios': 'dove', 'Modo enfoque': 'timer', 'Más secciones': 'more', 'Privacidad y seguridad': 'lock' }
const doc = computed(() => {
  const parts = raw.split(/\n(?=## )/)
  const intro = parts[0].split('\n').filter((l) => !/^# /.test(l))
  const secs = parts.slice(1).map((p) => { const [h, ...rest] = p.split('\n'); const title = h.replace(/^##\s*/, ''); return { title, icon: ICONS[title.replace(/\s*\(.*\)$/, '')] || 'book', html: toHtml(rest) } })
  return { intro: toHtml(intro), secs }
})
const q = ref('')
const shown = computed(() => doc.value.secs.filter((s) => !q.value || (s.title + s.html).toLowerCase().includes(q.value.toLowerCase())))
if (!state.settings.guiaOpen) state.settings.guiaOpen = { 'Lo básico': true }
const open = computed(() => state.settings.guiaOpen)
</script>

<template>
  <div class="stack">
    <div class="card soft guia" v-html="doc.intro"></div>
    <label class="search"><Icon name="search" :size="16" /><input v-model="q" placeholder="Buscar en la guía…" aria-label="Buscar en la guía" /></label>
    <GroupCard v-for="s in shown" :key="s.title" :title="s.title" :icon="s.icon" color="#F7B6C2" :open="!!q || !!open[s.title]" @toggle="open[s.title] = !open[s.title]">
      <div class="guia" v-html="s.html"></div>
    </GroupCard>
  </div>
</template>

<style scoped>
.search { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 0 12px; color: var(--muted); }
.search input { border: 0; background: transparent; color: var(--ink); font: inherit; padding: 11px 0; width: 100%; outline: none; }
.guia :deep(p) { margin: 6px 0; font-size: 14px; }
.guia :deep(ul) { margin: 6px 0; padding-left: 18px; font-size: 14px; line-height: 1.5; }
.guia :deep(li) { margin: 3px 0; }
.guia :deep(code) { font-size: 12px; background: var(--surface-3); padding: 1px 5px; border-radius: 6px; overflow-wrap: anywhere; }
.guia :deep(b) { color: var(--ink); }
</style>
