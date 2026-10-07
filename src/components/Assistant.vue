<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { recommend, freeBlocks, rankedTasks, isOpen, currentContext } from '../engine/planner'
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
  if (ctx.freeNow) out.push({ text: `${state.settings.ownerName}, tienes ${fmtDur(ctx.freeNow.minutes)} libres.`, icon: 'clock' })
  const aulaPending = state.tasks.find((t) => t.source === 'aula' && t.status === 'pendiente' && !(t.spent > 0))
  if (aulaPending) out.push({ text: `Hay una tarea de Aula que todavía no empezaste: "${aulaPending.title}".`, icon: 'cap', task: aulaPending })
  const stuck = state.tasks.find((t) => isOpen(t) && (t.postponed || 0) >= 2)
  if (stuck) {
    const p = state.principles.find((x) => x.tags.includes('empezar'))
    const src = state.resources.find((r) => r.id === p?.sourceId)
    if (p) out.push({ text: `Esto se parece a algo que aprendiste de ${src?.title || p.author}: "${p.text}". ¿5 minutos con "${stuck.title}"?`, icon: 'brain', task: stuck, five: true })
  }
  const b = freeBlocks(dayKey(), ctx.m).find((x) => x.minutes >= 45)
  if (b) out.push({ text: `Tu calendario está libre entre ${b.label.replace(' – ', ' y ')} ¿Quieres que usemos ese bloque?`, icon: 'calendar', block: b })
  const ins = insights()[0]
  if (ins) out.push({ text: `Detecté algo 👀 ${ins.text}`, icon: 'sparkles' })
  return out.slice(0, 4)
})

function useBlock(b) {
  const t = rankedTasks()[0]?.t
  if (!t) return
  const len = Math.min(50, b.minutes)
  t.blocks = [...(t.blocks || []), { date: dayKey(), start: toHM(b.start), end: toHM(b.start + len), minutes: len, done: false }]
  say(`Listo 💗 Reservé ${len} min de ${b.label.split(' – ')[0]} para "${t.title}".`)
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

function summary() {
  const k = dayKey()
  const open = state.tasks.filter(isOpen)
  return {
    hoy: k, hora: toHM(new Date().getHours() * 60 + new Date().getMinutes()),
    tareas: open.slice(0, 15).map((t) => ({ titulo: t.title, vence: t.due, prioridad: t.priority, min: t.estimate, pospuesta: t.postponed })),
    libres: freeBlocks(k).map((b) => b.label),
    habitosPendientes: state.habits.filter((h) => !state.habitLogs[h.id]?.[k]?.done).map((h) => h.name),
    objetivos: state.goals.map((g) => g.name),
    principios: state.principles.filter((p) => p.status !== 'descartado').map((p) => `${p.text} (${p.author})`),
    aprendizajes: state.experiments.filter((x) => x.status === 'terminado').map((x) => x.conclusion),
    sueñoAnoche: state.sleep.find((s) => s.date === k)?.minutes,
  }
}

async function send() {
  const text = input.value.trim(); if (!text) return
  input.value = ''
  say(text, 'me')
  const s = text.toLowerCase()
  const mm = s.match(/(\d+)\s*(min|minutos|h|hora)/)
  if (/no quiero|procrastin|me da pereza|no puedo empezar/.test(s)) { say('Te entiendo 😭💗 Vamos al modo "No quiero hacer esto": solo 5 minuticos.'); setTimeout(() => { ui.assistantOpen = false; A.go('enfoque', { avoid: 1 }) }, 900); return }
  if (mm) {
    const mins = Number(mm[1]) * (mm[2].startsWith('h') ? 60 : 1)
    const t = rankedTasks().map((r) => r.t).find((x) => (x.estimate - (x.spent || 0)) <= mins + 10) || rankedTasks()[0]?.t
    say(t ? `Con ${fmtDur(mins)} te recomiendo "${t.title}"${t.due ? ` (vence ${relDay(t.due)})` : ''}. ¿Empezamos?` : 'Con ese tiempo puedes descansar o leer algo de Mi cerebro 💗'); return
  }
  if (/qu[eé] hago|ahora|recomi/.test(s)) { say(shown.value.reason); return }
  if (/libre|disponible|hueco/.test(s)) { const b = freeBlocks(dayKey(), currentContext().m); say(b.length ? `Tienes libre: ${b.map((x) => x.label).join(', ')}.` : 'Hoy ya no te quedan bloques libres. Descansar también cuenta 🌙'); return }
  if (/h[aá]bito/.test(s)) { const p = state.habits.filter((h) => !state.habitLogs[h.id]?.[dayKey()]?.done); say(p.length ? `Te faltan: ${p.map((h) => h.emoji + ' ' + h.name).join(', ')}. Con uno chiquito ya cuenta.` : '¡Todos tus hábitos de hoy están listos! 🥹✨'); return }
  if (/vence|entrega|pendiente/.test(s)) { const d = state.tasks.filter((t) => isOpen(t) && daysUntil(t.due) <= 3).sort((a, b) => (a.due > b.due ? 1 : -1)); say(d.length ? d.map((t) => `• ${t.title} — ${relDay(t.due)}`).join('\n') : 'Nada vence en los próximos 3 días ✨'); return }
  if (canUseBackend()) {
    busy.value = true
    try { const r = await askAssistant(text, summary()); say(r.reply) } catch (e) { say(`No pude pensar con la IA ahora (${e.message}). Igual aquí estoy 💗`) } finally { busy.value = false }
  } else say('Puedo ayudarte con: "¿qué hago ahora?", "tengo 30 min", "no quiero hacer esto", "qué vence", "hábitos" o "tiempo libre". Para conversar libremente, conecta el asistente con IA en Configuración 💗')
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
        <p v-if="shown.principle" class="tiny muted" style="margin-top:6px">💡 {{ shown.principle.author }}: “{{ shown.principle.text }}”</p>
        <div class="row wrap" style="margin-top:12px;gap:6px">
          <button class="btn sm primary" @click="startRec"><Icon name="play" :size="14" />Empezar</button>
          <button v-if="shown.task" class="btn sm ghost" @click="postpone">Posponer</button>
          <button v-if="rec.alternatives?.length" class="btn sm ghost" @click="altIdx++">Cambiar</button>
          <button class="btn sm ghost" @click="ui.assistantOpen = false">Ignorar</button>
          <button v-if="shown.task" class="btn sm ghost" @click="details">Ver detalles</button>
        </div>
      </div>

      <div class="stack" style="gap:8px;margin-top:12px">
        <div v-for="(c, i) in contextual" :key="i" class="row card tight" style="align-items:flex-start">
          <span class="ico lav" style="width:32px;height:32px"><Icon :name="c.icon" :size="16" /></span>
          <div class="grow small">{{ c.text }}
            <div class="row" style="margin-top:6px;gap:6px">
              <button v-if="c.block" class="btn sm lav" @click="useBlock(c.block)">Usar bloque</button>
              <button v-if="c.five" class="btn sm lav" @click="A.startFocus({ taskId: c.task.id, minutes: 5, mode: 'empezar' }); ui.assistantOpen = false; A.go('enfoque')">5 min</button>
              <button v-else-if="c.task" class="btn sm ghost" @click="ui.modal = { type: 'task', id: c.task.id }">Ver</button>
            </div>
          </div>
        </div>
      </div>

      <div ref="box" class="stack" style="gap:8px;margin-top:14px;max-height:30dvh;overflow-y:auto">
        <div v-for="(mm, i) in msgs" :key="i" :style="{ alignSelf: mm.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '85%', whiteSpace: 'pre-line' }" class="small card tight" :class="{ pink: mm.from === 'me' }">{{ mm.text }}</div>
        <div v-if="busy" class="small muted">La vaquita está pensando… 🐮💭</div>
      </div>
      <form class="row" style="margin-top:10px" @submit.prevent="send">
        <input class="input" v-model="input" placeholder="Pregúntame: ¿qué hago ahora? / tengo 30 min…" aria-label="Mensaje al asistente" />
        <button class="btn primary" type="submit" aria-label="Enviar"><Icon name="rocket" :size="16" /></button>
      </form>
    </div>
  </div>
</template>
