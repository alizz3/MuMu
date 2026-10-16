<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { projectProgress } from '../store/actions'
import { localAnswer, habitMarkIntent, shownTask } from '../engine/answers'
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
// Contexto compacto (cada palabra gasta del límite gratis de Groq): títulos cortos en texto plano,
// y el detalle (notas, subtareas, enlaces) solo de las tareas que se nombran en la conversación.
function summary(text) {
  const k = dayKey()
  const open = state.tasks.filter(isOpen)
  const recent = [text, ...msgs.value.slice(-5).map((m) => m.text)].join(' ').toLowerCase()
  const asksDone = /\b(hice|hech[ao]s?|termin|complet|logr|avanc)/.test(recent)
  const line = (t) => [t.title, t.due && `vence ${t.due}${t.dueTime ? ' ' + t.dueTime : ''}`, t.priority === 'alta' && 'alta'].filter(Boolean).join(' · ')
  const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d) }
  const named = state.tasks.filter((t) => String(t.title || '').length >= 4 && recent.includes(String(t.title).toLowerCase())).slice(0, 4)
  const projects = state.projects.filter((p) => p.status !== 'completado')
  const focus = projects.filter((p) => recent.includes(String(p.name).toLowerCase()))
  return {
    hoy: k, hora: toHM(new Date().getHours() * 60 + new Date().getMinutes()), enCasa: state.presence?.home,
    proyectos: projects.map((p) => {
      const big = focus.includes(p) || focus.length === 0 && projects.length <= 3
      const pend = open.filter((t) => t.projectId === p.id)
      const done = state.tasks.filter((t) => t.projectId === p.id && t.status === 'completada').sort(byDone)
      return { nombre: p.name, estado: p.status, avance: `${projectProgress(p)}%`, vence: p.due || undefined,
        descripcion: big ? (p.description || '').slice(0, 200) || undefined : undefined,
        pendientes: big ? pend.slice(0, 15).map(line) : `${pend.length} (${pend.slice(0, 3).map((t) => t.title).join(', ')}${pend.length > 3 ? '…' : ''})`,
        hechas: asksDone && big ? done.slice(0, 15).map((t) => t.title) : done.length }
    }),
    estudios: state.subjects.filter((s) => !s.archived).map((s) => {
      const big = recent.includes(String(s.name).toLowerCase()) || recent.includes(String(s.short || '~~').toLowerCase())
      const pend = open.filter((t) => t.subjectId === s.id)
      return `${s.name}: ${pend.length ? (big ? pend : pend.slice(0, 3)).map(line).join(' | ') : 'al día'}${asksDone && big ? ` · hechas: ${state.tasks.filter((t) => t.subjectId === s.id && t.status === 'completada').map((t) => t.title).join(', ')}` : ''}`
    }),
    otrasTareas: open.filter((t) => !t.projectId && !t.subjectId).slice(0, 10).map(line),
    detalle: named.length ? named.map((t) => ({ titulo: t.title, estado: t.status, hechaEl: t.completedAt || undefined, vence: t.due || undefined, notas: String(t.notes || '').slice(0, 600) || '(sin descripción)', subtareas: (t.subtasks || []).map((x) => `${x.done ? '[x]' : '[ ]'} ${x.title || x.text || x}`).slice(0, 12), enlaces: (t.links || []).map((l) => l.name || l.url).slice(0, 5) })) : undefined,
    agendaHoy: itemsOn(k).map((e) => `${e.start || ''} ${e.title}`),
    agendaManana: itemsOn(inDays(1)).map((e) => `${e.start || ''} ${e.title}`),
    libresHoy: freeBlocks(k, currentContext().m).map((b) => b.label),
    habitosPendientesHoy: state.habits.filter((h) => !state.habitLogs[h.id]?.[k]?.done).map((h) => h.name),
  }
}

// Formato de las respuestas: **negrita**, listas con - o •, sin dejar pasar HTML
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function md(text) {
  const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S.*?)\*(?=\s|$|[.,;:!?])/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/~~(.+?)~~/g, '<s>$1</s>').replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</a>`)
  let html = '', list = false
  for (const raw of String(text || '').split('\n')) {
    const l = raw.trim()
    const m = l.match(/^(?:[-•*]|\d+[.)])\s+(.*)/)
    if (m) { if (!list) { html += '<ul>'; list = true } html += `<li>${inline(m[1])}</li>`; continue }
    if (list) { html += '</ul>'; list = false }
    if (!l) continue
    const h = l.match(/^#{1,4}\s+(.*)/)
    html += h ? `<p><b>${inline(h[1])}</b></p>` : `<p>${inline(l)}</p>`
  }
  return html + (list ? '</ul>' : '')
}

// Primero sin IA (tus datos, al instante); la IA solo para lo abierto
function localReply(text) {
  const r = localAnswer(text)
  if (r) return r
  return /qu[eé] (hago|hacer)|ahora qu[eé]|recomi/i.test(text) ? `${shown.value.title ? `**${shown.value.title}**\n` : ''}${shown.value.reason}` : null
}

async function send() {
  const text = input.value.trim(); if (!text) return
  input.value = ''
  say(text, 'me')
  if (/no quiero|procrastin|me da pereza|no puedo empezar/i.test(text)) { say('Te entiendo. Vamos al modo "No quiero hacer esto": solo 5 minuticos.'); setTimeout(() => { ui.assistantOpen = false; A.go('enfoque', { avoid: 1 }) }, 900); return }
  const mark = habitMarkIntent(text)
  if (mark) {
    if (!mark.habit || !mark.days.length) { say(mark.text); return }
    msgs.value.push({ from: 'pet', text: mark.text, actions: [
      { label: 'Sí, marcar', primary: true, run: () => { mark.days.forEach((k) => { if (!state.habitLogs[mark.habit.id]?.[k]?.done) A.toggleHabit(mark.habit.id, k, 'Marcado desde la vaquita') }); say(`Listo, marqué ${mark.days.length} día${mark.days.length === 1 ? '' : 's'}.\n\n${localAnswer(`como me fue con ${mark.habit.name} esta semana`) || ''}`) } },
      { label: 'No', run: () => say('Ok, no cambié nada.') },
    ] })
    nextTick(() => box.value?.scrollTo?.({ top: 1e6, behavior: 'smooth' }))
    return
  }
  const quick = localReply(text)
  if (quick) {
    const t = shownTask()
    if (!t) { say(quick); return }
    const url = t.url || t.links?.[0]?.url
    const openTask = () => { ui.assistantOpen = false; ui.modal = { type: 'task', id: t.id } }
    const openLink = () => window.open(url, '_blank', 'noopener')
    if (/\b(abre|abrir|ábre|ábrela|ábrelo|abrela|abrelo)\b.*\b(enlace|link|classroom|aula|drive)\b/i.test(text) && url) { openLink(); say(`Abrí el enlace de **${t.title}**.`); return }
    msgs.value.push({ from: 'pet', text: quick, actions: [
      { label: 'Abrir tarea', primary: true, keep: true, run: openTask },
      ...(url ? [{ label: 'Abrir enlace', keep: true, run: openLink }] : []),
      ...(isOpen(t) ? [{ label: '5 min', keep: true, run: () => { A.startFocus({ taskId: t.id, minutes: 5, mode: 'empezar' }); ui.assistantOpen = false; A.go('enfoque') } }] : []),
    ] })
    nextTick(() => box.value?.scrollTo?.({ top: 1e6, behavior: 'smooth' }))
    if (/\b(abre|abrir|ábrela|ábrelo|abrela|abrelo)\b/i.test(text)) setTimeout(openTask, 500)
    return
  }
  if (!canUseBackend()) { say( 'Puedo ayudarte con: "¿qué hago ahora?", "tengo 30 min", "no quiero hacer esto", "qué vence", "hábitos", "tiempo libre" o el nombre de un proyecto.'); return }
  busy.value = true
  try { const r = await askAssistant(text, summary(text), msgs.value.slice(-5, -1).map((m) => ({ ...m, text: String(m.text).slice(0, 600) }))); say(r.reply || 'Mmm, no supe qué decir. ¿Me lo preguntas de otra forma?') }
  catch (e) { say(`No pude pensar con la IA ahora (${e.message}). Mientras, puedo responderte sin IA: tus tareas, lo que vence, tu agenda, un proyecto o materia, lo que ya hiciste o la descripción de una tarea.`) }
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
        <div v-for="(mm, i) in msgs" :key="i" :style="{ alignSelf: mm.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '85%', whiteSpace: 'pre-line' }" class="small card tight msg" :class="{ pink: mm.from === 'me' }"><template v-if="mm.from === 'me'">{{ mm.text }}</template><div v-else class="md" v-html="md(mm.text)"></div>
          <div v-if="mm.actions" class="row" style="gap:6px;margin-top:8px"><button v-for="a in mm.actions" :key="a.label" class="btn sm" :class="a.primary ? 'primary' : 'ghost'" @click="if (!a.keep) mm.actions = null; a.run()">{{ a.label }}</button></div></div>
        <div v-if="busy" class="small muted">La vaquita está pensando…</div>
      </div>
      <form class="row" style="margin-top:10px" @submit.prevent="send">
        <input class="input" v-model="input" placeholder="¿Qué tengo hoy? · proyecto MuMu · tengo 30 min…" aria-label="Mensaje al asistente" />
        <button class="btn primary" type="submit" aria-label="Enviar"><Icon name="rocket" :size="16" /></button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.md :deep(p) { margin: 0 0 6px; }
.md :deep(p:last-child), .md :deep(ul:last-child) { margin-bottom: 0; }
.md :deep(ul) { margin: 2px 0 6px; padding-left: 18px; }
.md :deep(li) { margin: 2px 0; }
.md :deep(li::marker) { color: var(--pink-700); }
.md :deep(a) { color: var(--pink-700); font-weight: 600; text-decoration: underline; }
.md :deep(code) { font-size: 12px; background: var(--line); padding: 0 4px; border-radius: 4px; }
.msg .md { white-space: normal; }
.hints { margin-top: 10px; padding: 6px 12px; display: flex; flex-direction: column; }
.hint { display: flex; align-items: center; gap: 8px; font-size: 12.5px; line-height: 1.3; padding: 6px 0; color: var(--ink-2, inherit); }
.hint + .hint { border-top: 1px solid var(--line); }
.hint .grow { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.hico { flex: none; opacity: .7; }
.hint .link { flex: none; font-size: 12.5px; }
</style>
