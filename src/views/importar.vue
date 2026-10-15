<script setup>
// Importar: pega el JSON que te dio ChatGPT (o un enlace #importar=) y MuMu lo agrega
import { computed, ref } from 'vue'
import { ui } from '../store'
import * as A from '../store/actions'
import { Icon } from '../components/ui'
import { toast } from '../engine/game'
import prompt from '../../docs/PROMPT-IMPORTAR.md?raw'

const txt = ref('')
function parse(t) {
  t = t.trim()
  const link = t.match(/#importar=([\w-]+)/)
  if (link) return JSON.parse(decodeURIComponent(escape(atob(link[1].replace(/-/g, '+').replace(/_/g, '/')))))
  const block = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (block) t = block[1]
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  return JSON.parse(t.slice(a, b + 1))
}
const data = computed(() => { if (!txt.value.trim()) return null; try { return parse(txt.value) } catch { return false } })
const resumen = computed(() => {
  const d = data.value; if (!d) return []
  const n = (arr, one, many) => (arr?.length ? `${arr.length} ${arr.length === 1 ? one : many}` : null)
  return [
    d.project?.name && ['folder', `Proyecto «${d.project.name}»`],
    n(d.tasks, 'tarea', 'tareas') && ['list', n(d.tasks, 'tarea', 'tareas')],
    n(d.goals, 'objetivo', 'objetivos') && ['target', `${n(d.goals, 'objetivo', 'objetivos')}: ${d.goals.map((g) => g.name).join(', ')}`],
    n(d.habits, 'hábito', 'hábitos') && ['heart', `${n(d.habits, 'hábito', 'hábitos')}: ${d.habits.map((h) => h.name).join(', ')}`],
    n(d.subjects, 'materia o curso', 'materias o cursos') && ['cap', `${d.subjects.map((x) => x.name).join(', ')}`],
    n(d.events, 'sesión', 'sesiones') && ['calendar', `${n(d.events, 'sesión', 'sesiones')} en la agenda`],
    n(d.subjectTasks, 'tarea del curso', 'tareas del curso') && ['check', n(d.subjectTasks, 'tarea del curso', 'tareas del curso')],
  ].filter(Boolean)
})
function agregar() {
  try {
    const p = A.importProject(data.value)
    toast('Listo, agregado')
    txt.value = ''
    if (p) A.go('proyectos', { id: p.id })
    else A.go(data.value?.subjects?.length ? 'universidad' : data.value?.goals?.length ? 'objetivos' : data.value?.habits?.length ? 'habitos' : 'tareas')
  } catch (e) { toast('No pude agregarlo: revisa que el JSON esté completo') }
}
async function copiar() { try { await navigator.clipboard.writeText(prompt); toast('Instrucciones copiadas: pégalas en ChatGPT una sola vez') } catch { toast('No pude copiar') } }
async function pegar() { try { txt.value = await navigator.clipboard.readText() } catch { toast('Pega con mantener presionado el cuadro') } }
</script>

<template>
  <div class="stack">
    <div class="card soft stack" style="gap:8px">
      <b class="wi"><Icon name="robot" :size="16" />Crea cosas con otra IA, sin gastar de más</b>
      <ol class="tiny pasos">
        <li>Copia las instrucciones y pégalas en ChatGPT (o Gemini, o Groq) al empezar un chat. Puedes dejarlas como "instrucciones personalizadas" de un proyecto de ChatGPT.</li>
        <li>Pídele lo que necesites: "créame el proyecto de tarjetas digitales con sus tareas", "un objetivo para el inglés"…</li>
        <li>Copia el bloque que te responde, pégalo aquí y toca <b>Agregar</b>.</li>
      </ol>
      <button class="btn sm lav" style="align-self:flex-start" @click="copiar"><Icon name="copy" :size="14" />Copiar instrucciones para la IA</button>
    </div>
    <div class="card stack" style="gap:8px">
      <div class="row between"><b class="small">Pega aquí lo que te dio la IA</b><button class="link tiny" @click="pegar">Pegar</button></div>
      <textarea class="input" v-model="txt" rows="8" placeholder='{ "project": { "name": "…" }, "tasks": [ … ] }' aria-label="JSON para importar" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12.5px"></textarea>
      <p v-if="data === false" class="tiny" style="color:var(--danger);margin:0">Eso no se ve completo. Copia todo el bloque que te dio la IA.</p>
      <div v-if="resumen.length" class="stack" style="gap:4px">
        <div class="tiny muted">Se va a agregar:</div>
        <div v-for="(r, i) in resumen" :key="i" class="small wi" style="gap:6px"><Icon :name="r[0]" :size="14" />{{ r[1] }}</div>
      </div>
      <button class="btn primary" :disabled="!resumen.length" @click="agregar"><Icon name="plus" :size="16" />Agregar a MuMu</button>
    </div>
  </div>
</template>

<style scoped>
.pasos { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
</style>
