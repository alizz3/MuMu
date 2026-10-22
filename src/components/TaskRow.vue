<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { state, ui } from '../store'
import { completeTask, reopenTask } from '../store/actions'
import { effectivePriority } from '../engine/planner'
import { relDay, daysUntil, fmtDur, fmt12s } from '../engine/time'
import { Icon } from './ui'

// ids recién completados: la fila que los recibe en otra lista entra con animación
const justDone = globalThis.__mumuJustDone || (globalThis.__mumuJustDone = new Set())
const props = defineProps({ task: Object, compact: Boolean })
const t = computed(() => props.task)
const done = computed(() => t.value.status === 'completada')
const subj = computed(() => state.subjects.find((s) => s.id === t.value.subjectId))
const proj = computed(() => state.projects.find((p) => p.id === t.value.projectId))
const prio = computed(() => effectivePriority(t.value))
const d = computed(() => daysUntil(t.value.due))
const SRC = { aula: ['cap', 'Aula'], gmail: ['mail', 'Gmail'], classroom: ['book', 'Classroom'], calendar: ['calendar', ''] }
// Al completar: se raya el título, la fila se recoge y la tarea reaparece suave al fondo (o en "Completadas")
const root = ref(null), striking = ref(false)
let alive = true
onBeforeUnmount(() => { alive = false })
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function arrive(el) { el?.animate?.([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }) }
onMounted(() => { if (justDone.delete(t.value.id) && !calm()) arrive(root.value) })
async function toggle() {
  if (striking.value) return
  if (done.value) return reopenTask(t.value.id)
  const id = t.value.id, el = root.value
  if (calm() || !el?.animate) return completeTask(id)
  striking.value = true
  await wait(480) // se ve la raya y el chulito
  const h = el.offsetHeight, cs = getComputedStyle(el)
  const out = el.animate([
    { height: h + 'px', opacity: 1, transform: 'none', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom },
    { height: '0px', opacity: 0, transform: 'translateY(10px)', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' },
  ], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
  el.style.overflow = 'hidden'
  await out.finished.catch(() => {})
  justDone.add(id)
  completeTask(id)
  await nextTick()
  if (alive) { el.style.overflow = ''; out.cancel(); striking.value = false; justDone.delete(id); arrive(el) } // la lista no la movió: solo reaparece
}
const subs = computed(() => t.value.subtasks?.length ? `${t.value.subtasks.filter((s) => s.done).length}/${t.value.subtasks.length}` : '')
</script>

<template>
  <div ref="root" class="item" :class="{ striking }">
    <button class="check" :class="{ on: done || striking }" :aria-label="done ? 'Marcar como pendiente' : 'Completar tarea'" @click="toggle"><Icon v-if="done || striking" name="check" :size="15" :stroke="3" /></button>
    <button class="grow" style="all:unset;cursor:pointer;min-width:0;flex:1" @click="ui.modal = { type: 'task', id: t.id }">
      <div class="title-line" :class="{ 'done-txt': done }"><span class="tl-txt">{{ t.title }}</span></div>
      <div class="row wrap tiny muted" style="gap:6px;margin-top:3px">
        <span v-if="t.due && !done" :style="{ color: d < 0 ? 'var(--danger)' : d <= 1 ? 'var(--pink-700)' : '' }">{{ d < 0 ? 'Atrasada · ' : '' }}{{ relDay(t.due) }}{{ /^\d{2}:\d{2}$/.test(t.dueTime || '') ? ' ' + fmt12s(t.dueTime) : '' }}</span>
        <span v-if="!compact">· {{ fmtDur(t.estimate) }}</span>
        <span v-if="subj">· {{ subj.short }}</span>
        <span v-else-if="proj">· {{ proj.name }}</span>
        <span v-if="t.links?.length" class="wi" style="gap:3px" :aria-label="`${t.links.length} ${t.links.length === 1 ? 'recurso' : 'recursos'}`">· <Icon name="link" :size="12" />{{ t.links.length }}</span>
        <span v-if="subs" class="wi" style="gap:3px">· <Icon name="check" :size="12" />{{ subs }}</span>
        <span v-if="SRC[t.source] && !compact" class="wi" style="gap:3px" :aria-label="SRC[t.source][1] || 'Google Calendar'">· <Icon :name="SRC[t.source][0]" :size="12" />{{ SRC[t.source][1] }}</span>
        <span v-if="t.group" class="wi" style="gap:3px">· <Icon name="users" :size="12" />CIPA{{ t.uploader ? ' · la sube ' + t.uploader.split(' ')[0] : '' }}</span>
        <span v-if="t.demo" class="badge demo">ejemplo</span>
      </div>
    </button>
    <span v-if="t.grade != null" class="badge" :class="t.grade >= 4 ? 'green' : t.grade >= 3 ? '' : 'pink'"><Icon name="target" :size="12" />{{ (+t.grade).toFixed(1) }}</span>
    <span v-if="!done && prio === 'alta'" class="badge red">alta</span>
    <span v-if="t.status === 'en progreso'" class="badge">en curso</span>
  </div>
</template>

<style scoped>
.tl-txt { background: linear-gradient(currentColor, currentColor) no-repeat 0 56% / 0 1.5px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.striking .tl-txt { animation: strike .42s cubic-bezier(.4,0,.2,1) forwards; }
.striking .title-line { color: var(--muted); transition: color .42s; }
@keyframes strike { to { background-size: 100% 1.5px; } }
</style>
