<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { projectProgress } from '../store/actions'
import { recommend, freeBlocks, rankedTasks, isOpen, currentContext, itemsOn } from '../engine/planner'
import { petState } from '../engine/game'
import { insights } from '../engine/insights'
import { dayKey, fmtDur, relDay, toHM, daysUntil } from '../engine/time'
import { askAssistant, canUseBackend } from '../services/api'
import { Icon, Pet } from './ui'

const altIdx = ref(0)
const rec = computed(() => recommend())
const shown = computed(() => {
  const r = rec.value
  if (altIdx.value === 0 || !r.alternatives?.length) return r
  const t = r.alternatives[(altIdx.value - 1) % r.alternatives.length]
  return { ...r, kind: 'task', task: t, title: t.title, minutes: Math.min(25, t.estimate || 25), reason: `Otra opción: "${t.title}"${t.due ? `, vence ${relDay(t.due)}` : ''}.` }
})
const pet = computed(() => petState())
const msgs = ref([])
const input = ref('')
const box = ref(null)
const busy = ref(false)

const contextual = computed(() => {
  const out = []
  const ctx = currentContext()
  if (ctx.freeNow && !freeBlocks(dayKey(), ctx.m).some((x) => x.minutes >= 45)) out.push({ text: `Tienes ${fmtDur(ctx.freeNow.minutes)} libres.`, icon: 'clock' })
  const aulaPending = state.tasks.find((t) => t.source === 'aula' && t.status === 'pendiente' && !(t.spent > 0))
  if (aulaPending) out.push({ text: `Sin empezar: ${aulaPending.title}`, icon: 'cap', task: aulaPending })
  const stuck = state.tasks.find((t) => isOpen(t) && (t.postponed || 0) >= 2)
  if (stuck) {
    const p = state.principles.find((x) => x.tags.includes('empezar'))
    const src = state.resources.find((r) => r.id === p?.sourceId)
    if (p) out.push({ text: `Esto se parece a algo que aprendiste de ${src?.title || p.author}: "${p.text}". ¿5 minutos con "${stuck.title}"?`, icon: 'brain', task: stuck, five: true })
  }
  const b = freeBlocks(dayKey(), ctx.m).find((x) => x.minutes >= 45)
  if (b) out.push({ text: `Libre ${b.label} (${fmtDur(b.minutes)})`, icon: 'calendar', block: b })
  const ins = insights()[0]
  if (ins) out.push({ text: ins.text, icon: ins.icon || 'eye' })
  return out.slice(0, 3)
})

function useBlock(b) {
  const t = rankedTasks()[0]?.t
  if (!t) return
  const len = Math.min(50, b.minutes)
  t.blocks = [...(t.blocks || []), { date: dayKey(), start: toHM(b.start), end: toHM(b.start + len), minutes: len, done: false }]
  say(`Listo. Reservé ${len} min de ${b.label.split(' – ')[0]} para "${t.title}".`)
}

function startRec() {
  const r = shown.value
  if (r.kind === 'rest') { ui.assistantOpen = false; A.go('rutinas'); return }
  if (r.kind === 'life') { ui.assistantOpen = false; A.go('vida'); return }
  A.startFocus({ taskId: r.task?.id, minutes: r.minutes || 25, mode: r.kind === 'micro' ? 'empezar' : 'pomodoro' })
  ui.assistantOpen = false; A.go('enfoque')
}
function postpone() { if (shown.value.task) { A.postponeTask(shown.value.task.id); altIdx.value++ } }
function details() { if (shown.value.task) ui.modal = { type: 'task', id: shown.value.task.id } }

function say(text, from = 'pet') { msgs.value.push({ from, text }); nextTick(() => box.value?.scrollTo?.({ top: 1e6, behavior: 'smooth' })) }

const byDone = (a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || ''))
function summary() {
  const k = dayKey()
  const open = state.tasks.filter(isOpen)
  const subj = (id) => state.subjects.find((x) => x.id === id)
  const t2 = (t) => ({ titulo: t.title, vence: t.due || undefined, hora: t.dueTime || undefined, prioridad: t.priority, estado: t.status, min: t.estimate || undefined })
  const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d) }
  return {
    hoy: k, hora: toHM(new Date().getHours() * 60 + new Date().getMinutes()), enCasa: state.presence?.home,
    proyectos: state.projects.filter((p) => p.status !== 'completado').map((p) => ({
      nombre: p.name, estado: p.status, vence: p.due || undefined, avance: `${projectProgress(p)}%`, descripcion: (p.description || '').slice(0, 160) || undefined,
      pendientes: open.filter((t) => t.projectId === p.id).slice(0, 12).map(t2),
      hechas: state.tasks.filter((t) => t.projectId === p.id && t.status === 'completada').sort(byDone).slice(0, 15).map((t) => t.title),
    })),
    proyectosTerminados: state.projects.filter((p) => p.status === 'completado').map((p) => p.name),
    estudios: state.subjects.filter((s) => !s.archived).map((s) => ({ materia: s.name, institucion: s.institution, pendientes: open.filter((t) => t.subjectId === s.id).slice(0, 8).map(t2), hechas: state.tasks.filter((t) => t.subjectId === s.id && t.status === 'completada').sort(byDone).slice(0, 6).map((t) => t.title) })),
    hechasUltimaSemana: state.tasks.filter((t) => t.status === 'completada' && t.completedAt && Date.now() - new Date(t.completedAt).getTime() < 7 * 864e5).sort(byDone).slice(0, 20).map((t) => t.title),
    otrasTareas: open.filter((t) => !t.projectId && !t.subjectId).slice(0, 20).map(t2),
    agendaHoy: itemsOn(k).map((e) => `${e.start || ''}-${e.end || ''} ${e.title}`),
    agendaManana: itemsOn(inDays(1)).map((e) => `${e.start || ''}-${e.end || ''} ${e.title}`),
    libresHoy: freeBlocks(k, currentContext().m).map((b) => b.label),
    habitos: state.habits.map((h) => ({ nombre: h.name, hechoHoy: !!state.habitLogs[h.id]?.[k]?.done })),
    objetivos: state.goals.map((g) => g.name),
    principios: state.principles.filter((p) => p.status !== 'descartado').slice(0, 8).map((p) => `${p.text} (${p.author})`),
    sueñoAnoche: state.sleep.find((s) => s.date === k)?.minutes,
  }
}

let lastProject = null
// Respuestas sin IA (instantáneas, y de respaldo si la IA falla)
function localReply(text) {
  const s = text.toLowerCase()
  const mm = s.match(/(\d+)\s*(min|minutos|h|hora)/)
  if (mm) {
    const mins = Number(mm[1]) * (mm[2].startsWith('h') ? 60 : 1)
    const t = rankedTasks().map((r) => r.t).find((x) => (x.estimate - (x.spent || 0)) <= mins + 10) || rankedTasks()[0]?.t
    return t ? `Con ${fmtDur(mins)} te recomiendo "${t.title}"${t.due ? ` (vence ${relDay(t.due)})` : ''}. ¿Empezamos?` : 'Con ese tiempo puedes descansar o leer algo de Mi cerebro.'
  }
  if (/libre|disponible|hueco/.test(s)) { const b = freeBlocks(dayKey(), currentContext().m); return b.length ? `Tienes libre: ${b.map((x) => x.label).join(', ')}.` : 'Hoy ya no te quedan bloques libres. Descansar también cuenta.' }
  if (/h[aá]bito/.test(s)) { const p = state.habits.filter((h) => !state.habitLogs[h.id]?.[dayKey()]?.done); return p.length ? `Te faltan: ${p.map((h) => h.name).join(', ')}. Con uno chiquito ya cuenta.` : '¡Todos tus hábitos de hoy están listos!' }
  if (/vence|entrega|pendiente/.test(s)) { const d = state.tasks.filter((t) => isOpen(t) && daysUntil(t.due) <= 3).sort((a, b) => (a.due > b.due ? 1 : -1)); return d.length ? d.map((t) => `• ${t.title} — ${relDay(t.due)}`).join('\n') : 'Nada vence en los próximos 3 días.' }
  const pr = state.projects.find((p) => s.includes(String(p.name).toLowerCase())) || lastProject
  if (pr && /\b(hice|hechas?|termin|complet|llevo)/.test(s)) {
    lastProject = pr
    const d = state.tasks.filter((t) => t.projectId === pr.id && t.status === 'completada').sort(byDone)
    return d.length ? `De ${pr.name} ya hiciste ${d.length}:\n${d.slice(0, 10).map((t) => `• ${t.title}`).join('\n')}${d.length > 10 ? `\n…y ${d.length - 10} más` : ''}` : `En ${pr.name} todavía no has terminado tareas.`
  }
  if (pr && state.projects.some((p) => s.includes(String(p.name).toLowerCase()))) {
    lastProject = pr; const ts = state.tasks.filter((t) => t.projectId === pr.id && isOpen(t)); return `${pr.name} va en ${projectProgress(pr)}%. ${ts.length ? `Te falta:\n${ts.slice(0, 8).map((t) => `• ${t.title}${t.due ? ` — ${relDay(t.due)}` : ''}`).join('\n')}` : 'No tiene tareas pendientes.'}` }
  if (/qu[eé] hago|ahora|recomi/.test(s)) return shown.value.reason
  return null
}

async function send() {
  const text = input.value.trim(); if (!text) return
  input.value = ''
  say(text, 'me')
  if (/no quiero|procrastin|me da pereza|no puedo empezar/i.test(text)) { say('Te entiendo. Vamos al modo "No quiero hacer esto": solo 5 minuticos.'); setTimeout(() => { ui.assistantOpen = false; A.go('enfoque', { avoid: 1 }) }, 900); return }
  if (!canUseBackend()) { say(localReply(text) || 'Puedo ayudarte con: "¿qué hago ahora?", "tengo 30 min", "no quiero hacer esto", "qué vence", "hábitos", "tiempo libre" o el nombre de un proyecto.'); return }
  busy.value = true
  try { const r = await askAssistant(text, summary(), msgs.value.slice(-7, -1)); say(r.reply || localReply(text) || 'Mmm, no supe qué decir. ¿Me lo preguntas de otra forma?') }
  catch (e) { const l = localReply(text); say(l ? `${l}\n\n(Sin IA por ahora: ${e.message})` : `No pude pensar con la IA ahora (${e.message}). Igual aquí estoy.`) }
  finally { busy.value = false }
}

watch(() => ui.assistantOpen, (o) => { if (o) { altIdx.value = 0; if (!msgs.value.length) say(pet.value.msg) } })
</script>

<template>
  <div v-if="ui.assistantOpen" class="scrim" @click.self="ui.assistantOpen = false">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Asistente">
      <div class="grab"></div>
      <div class="row">
        <Pet :pose="pet.pose" :size="70" />
        <div class="grow"><div class="b">Tu vaquita asistente</div><div class="tiny muted">Conoce tu agenda, tareas, hábitos y lo que aprendes</div></div>
        <button class="iconbtn" aria-label="Cerrar" @click="ui.assistantOpen = false"><Icon name="x" /></button>
      </div>

      <div class="card pink" style="margin-top:12px">
        <div class="tiny b" style="color:var(--pink-700)">¿QUÉ DEBERÍA HACER AHORA?</div>
        <h3 style="margin:4px 0 6px;font-size:16px">{{ shown.title }}</h3>
        <p class="small">{{ shown.reason }}</p>
        <p v-if="shown.principle" class="tiny muted" style="margin-top:6px"><Icon name="bulb" :size="13" class="inl" /> {{ shown.principle.author }}: “{{ shown.principle.text }}”</p>
        <div class="row wrap" style="margin-top:12px;gap:6px">
          <button class="btn sm primary" @click="startRec"><Icon name="play" :size="14" />Empezar</button>
          <button v-if="shown.task" class="btn sm ghost" @click="postpone">Posponer</button>
          <button v-if="rec.alternatives?.length" class="btn sm ghost" @click="altIdx++">Cambiar</button>
          <button class="btn sm ghost" @click="ui.assistantOpen = false">Ignorar</button>
          <button v-if="shown.task" class="btn sm ghost" @click="details">Ver detalles</button>
        </div>
      </div>

      <div v-if="contextual.length" class="card tight hints">
        <div v-for="(c, i) in contextual" :key="i" class="hint">
          <Icon :name="c.icon" :size="14" class="hico" />
          <span class="grow">{{ c.text }}</span>
          <button v-if="c.block" class="link" @click="useBlock(c.block)">Usar</button>
          <button v-if="c.five" class="link" @click="A.startFocus({ taskId: c.task.id, minutes: 5, mode: 'empezar' }); ui.assistantOpen = false; A.go('enfoque')">5 min</button>
          <button v-else-if="c.task" class="link" @click="ui.modal = { type: 'task', id: c.task.id }">Ver</button>
        </div>
      </div>

      <div ref="box" class="stack" style="gap:8px;margin-top:14px;max-height:38dvh;overflow-y:auto">
        <div v-for="(mm, i) in msgs" :key="i" :style="{ alignSelf: mm.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '85%', whiteSpace: 'pre-line' }" class="small card tight" :class="{ pink: mm.from === 'me' }">{{ mm.text }}</div>
        <div v-if="busy" class="small muted">La vaquita está pensando…</div>
      </div>
      <form class="row" style="margin-top:10px" @submit.prevent="send">
        <input class="input" v-model="input" placeholder="Pregúntame: ¿qué hago ahora? / tengo 30 min…" aria-label="Mensaje al asistente" />
        <button class="btn primary" type="submit" aria-label="Enviar"><Icon name="rocket" :size="16" /></button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.hints { margin-top: 10px; padding: 6px 12px; display: flex; flex-direction: column; }
.hint { display: flex; align-items: center; gap: 8px; font-size: 12.5px; line-height: 1.3; padding: 6px 0; color: var(--ink-2, inherit); }
.hint + .hint { border-top: 1px solid var(--line); }
.hint .grow { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.hico { flex: none; opacity: .7; }
.hint .link { flex: none; font-size: 12.5px; }
</style>
