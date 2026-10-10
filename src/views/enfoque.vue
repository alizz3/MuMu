<script setup>
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { rankedTasks, isOpen } from '../engine/planner'
import { dayKey, fmtDur } from '../engine/time'
import { Icon, Pet, Ring, Chip } from '../components/ui'
import { FACES, FEELINGS } from '../components/iconFor'
import { openFloat, canFloat, closeFloat, isFloating } from '../services/focusFloat'
import { askBrowserPermission } from '../engine/notify'
import { toast } from '../engine/game'
const floating = ref(false)
async function floatOrNotify() {
  if (canFloat()) {
    if (isFloating()) { closeFloat(); floating.value = false; return }
    try { floating.value = await openFloat(); if (floating.value) toast('Listo: el reloj queda flotando aunque cambies de app') } catch { toast('No se pudo abrir la ventanita. Revisa que el navegador permita "Pantalla en pantalla" para MuMu.') }
    return
  }
  const r = await askBrowserPermission()
  toast(r === 'granted' ? 'Listo: si cambias de pestaña te mando mensajitos suaves' : 'Tu navegador no permite ventanita flotante; deja esta pestaña abierta y verás el tiempo en su título')
}

// Pantalla completa: reloj gigante, sin distracciones
const full = ref(false)
const fullEl = ref(null)
async function openFull() {
  full.value = true
  await nextTick()
  const el = fullEl.value || document.documentElement
  try { if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen() } catch { /* se queda como capa encima */ }
}
function closeFull() {
  full.value = false
  const fe = document.fullscreenElement || document.webkitFullscreenElement
  if (fe) (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch?.(() => {})
}
const onFsChange = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement)) full.value = false }
const onKey = (ev) => { if (ev.key === 'Escape' && full.value) closeFull() }
document.addEventListener('fullscreenchange', onFsChange)
document.addEventListener('webkitfullscreenchange', onFsChange)
document.addEventListener('keydown', onKey)
onUnmounted(() => { document.removeEventListener('fullscreenchange', onFsChange); document.removeEventListener('webkitfullscreenchange', onFsChange); document.removeEventListener('keydown', onKey); if (full.value) closeFull() })

const f = computed(() => ui.focus)
const elapsed = computed(() => (f.value ? f.value.elapsed + (f.value.paused ? 0 : ui.now - f.value.startedAt) : 0))
const tickNow = ref(Date.now())
const timer = setInterval(() => { tickNow.value = Date.now(); floating.value = isFloating(); if (f.value && !f.value.paused) ui.now = new Date() }, 1000)
onUnmounted(() => clearInterval(timer))
const left = computed(() => { tickNow.value; return f.value ? Math.max(0, f.value.minutes * 60000 - (f.value.elapsed + (f.value.paused ? 0 : Date.now() - f.value.startedAt))) : 0 })
const pct = computed(() => (f.value ? 100 - (left.value / (f.value.minutes * 60000)) * 100 : 0))
const mmss = computed(() => { const s = Math.ceil(left.value / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` })
const finished = computed(() => f.value && left.value === 0)
const ending = ref(false)
const feeling = ref(3)
const note = ref('')
watch(finished, (v) => { if (v) ending.value = true })
watch(f, (v) => { if (!v && full.value) closeFull() })

function pause() { const x = ui.focus; if (!x) return; if (x.paused) { x.startedAt = Date.now(); x.paused = false } else { x.elapsed += Date.now() - x.startedAt; x.paused = true } }
function more(min) { ui.focus.minutes += min; ending.value = false; toast(`+${min} min`) }
function restart() { Object.assign(ui.focus, { startedAt: Date.now(), elapsed: 0, paused: false }); ending.value = false; toast('Reiniciado, desde cero') }
function finish(outcome) { A.endFocus(outcome, feeling.value, note.value); ending.value = false; note.value = ''; feeling.value = 3 }

// sesión normal
const taskId = ref(rankedTasks()[0]?.t.id || '')
const minutes = ref(25)
const openTasks = computed(() => state.tasks.filter(isOpen))

// modo "NO QUIERO HACER ESTO 😭"
const avoid = ref(ui.params.avoid ? 1 : 0)
const avoidTask = ref(openTasks.value.find((t) => (t.postponed || 0) >= 1)?.id || openTasks.value[0]?.id)
const custom = ref('')
const step = ref('')
const why = ref('')
const friction = ref({ phone: false, water: false, open: false, music: false })
const at = computed(() => state.tasks.find((t) => t.id === avoidTask.value))
const smallSteps = computed(() => {
  const t = at.value
  const firstSub = t?.subtasks?.find((s) => !s.done)?.title
  return [firstSub && `Solo: ${firstSub}`, 'Abrir el archivo / el enunciado', 'Escribir 3 ideas sueltas', 'Leer la primera página', 'Hacer el título y la estructura'].filter(Boolean)
})
const principle = computed(() => state.principles.find((p) => p.tags.includes('empezar')))
function startAvoid() {
  if (why.value) at.value && (at.value.notes = `${at.value.notes || ''}\n[${dayKey()}] Lo evitaba porque: ${why.value}`.trim())
  A.startFocus({ taskId: avoidTask.value === '_custom' ? null : avoidTask.value, minutes: 5, mode: 'empezar', step: step.value || smallSteps.value[0] })
  if (avoidTask.value === '_custom') ui.focus.title = custom.value || 'Lo que estoy evitando'
  avoid.value = 0
}
const recent = computed(() => [...state.focus].reverse().slice(0, 6))
const today = computed(() => state.focus.filter((x) => x.date === dayKey()).reduce((a, x) => a + x.minutes, 0))
</script>

<template>
  <div class="stack">
    <!-- Sesión activa -->
    <template v-if="f">
      <div class="card pink" style="text-align:center">
        <div class="tiny b muted">{{ f.mode === 'empezar' ? 'LA META ES EMPEZAR' : 'SESIÓN DE ENFOQUE' }}</div>
        <h2 style="margin:6px 0">{{ f.title }}</h2>
        <p v-if="f.step" class="small muted">Pasito: {{ f.step }}</p>
        <div class="focus-ring" style="margin-top:12px">
          <Ring :value="pct" :size="260" :width="12" color="var(--pink-500)" label="Tiempo transcurrido"><span></span></Ring>
          <div style="position:absolute;text-align:center">
            <Pet :pose="f.category === 'trabajo' ? 'laptop' : 'study'" :size="110" />
            <div class="focus-time" aria-live="off">{{ mmss }}</div>
          </div>
        </div>
        <div class="row" style="justify-content:center;gap:8px;margin-top:14px">
          <button class="btn lav" @click="pause"><Icon :name="f.paused ? 'play' : 'pause'" :size="16" />{{ f.paused ? 'Seguir' : 'Pausa' }}</button>
          <button class="btn primary" @click="ending = true"><Icon name="check" :size="16" />Terminar</button>
        </div>
        <div class="row" style="justify-content:center;gap:8px;margin-top:8px">
          <button class="btn sm ghost" @click="more(1)">+1 min</button>
          <button class="btn sm ghost" @click="more(5)">+5 min</button>
          <button class="btn sm ghost" @click="restart"><Icon name="refresh" :size="14" />Reiniciar</button>
        </div>
        <p v-if="ui.focusMsg" class="small" style="margin-top:10px">{{ ui.focusMsg }}</p>
        <div class="row" style="justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn sm lav" :aria-pressed="floating" @click="floatOrNotify"><Icon :name="canFloat() ? 'pip' : 'bell'" :size="15" />{{ canFloat() ? (floating ? 'Quitar flotante' : 'Flotante') : 'Avisarme si cambio de pestaña' }}</button>
          <button class="btn sm lav" @click="openFull"><Icon name="fullscreen" :size="15" />Pantalla completa</button>
        </div>
        <p class="tiny muted" style="margin-top:8px">¿Necesitas Classroom o Tu Aula? Toca <b>Flotante</b> y ábrelos: el relojito queda encima de todo, también en el celular.</p>
      </div>
      <div ref="fullEl" class="focus-full" :class="{ on: full }" role="dialog" aria-modal="true" aria-label="Enfoque en pantalla completa" v-show="full">
        <button class="btn sm ghost focus-full-x" @click="closeFull"><Icon name="minimize" :size="15" />Salir</button>
        <div class="tiny b muted">{{ f.paused ? 'EN PAUSA' : f.mode === 'empezar' ? 'LA META ES EMPEZAR' : 'SESIÓN DE ENFOQUE' }}</div>
        <h2 class="focus-full-title">{{ f.title }}</h2>
        <p v-if="f.step" class="small muted">Pasito: {{ f.step }}</p>
        <div class="focus-full-ring">
          <Ring :value="pct" :size="340" :width="14" color="var(--pink-500)" label="Tiempo transcurrido"><span></span></Ring>
          <div class="focus-full-in">
            <Pet :pose="f.paused ? 'sleep' : f.category === 'trabajo' ? 'laptop' : 'study'" :size="120" />
            <div class="focus-full-time">{{ mmss }}</div>
          </div>
        </div>
        <p v-if="ui.focusMsg" class="small" style="text-align:center;max-width:420px">{{ ui.focusMsg }}</p>
        <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">
          <button class="btn lav" @click="pause"><Icon :name="f.paused ? 'play' : 'pause'" :size="16" />{{ f.paused ? 'Seguir' : 'Pausa' }}</button>
          <button class="btn ghost" @click="more(1)">+1 min</button>
          <button class="btn ghost" @click="more(5)">+5 min</button>
          <button class="btn ghost" @click="restart"><Icon name="refresh" :size="15" />Reiniciar</button>
          <button class="btn primary" @click="closeFull(); ending = true"><Icon name="check" :size="16" />{{ finished ? '¡Tiempo! Terminar' : 'Terminar' }}</button>
        </div>
        <p class="tiny muted">Esc o “Salir” para volver</p>
      </div>
      <div v-if="ending" class="card">
        <h3>{{ finished ? (f.mode === 'empezar' ? '¡Empezaste! Eso era lo difícil' : '¡Tiempo!') : '¿Cómo te fue?' }}</h3>
        <div v-if="finished" class="row wrap" style="gap:6px;margin:10px 0">
          <button class="btn sm lav" @click="more(5)">+5 min</button><button class="btn sm lav" @click="more(20)">Sigo 20 min más</button>
        </div>
        <div class="small row" style="margin:8px 0 4px;gap:6px">¿Cómo te sentiste? <span class="wi"><Icon :name="FACES[feeling - 1]" :size="18" />{{ FEELINGS[feeling - 1] }}</span></div>
        <input type="range" min="1" max="5" v-model.number="feeling" style="width:100%" aria-label="Cómo te sentiste" />
        <input class="input" v-model="note" placeholder="Nota opcional (¿qué funcionó?)" style="margin-top:8px" />
        <div class="grid3" style="margin-top:10px">
          <button class="btn primary sm" @click="finish('logrado')">Lo logré</button>
          <button class="btn lav sm" @click="finish('parcial')">Avancé algo</button>
          <button class="btn ghost sm" @click="finish('no')">No pude hoy</button>
        </div>
      </div>
    </template>

    <!-- Modo No quiero hacer esto -->
    <template v-else-if="avoid">
      <div class="card pink row"><Pet pose="motivate" :size="96" /><div class="grow"><h2>No quiero hacer esto</h2><p class="small">Tranqui. No vamos a terminarlo. Solo vamos a <b>empezar</b>.</p></div></div>
      <div class="card stack">
        <label class="field"><span>1 · ¿Qué tarea estás evitando?</span>
          <select class="input" v-model="avoidTask"><option v-for="t in openTasks" :key="t.id" :value="t.id">{{ t.title }}{{ t.postponed ? ` (pospuesta ${t.postponed}×)` : '' }}</option><option value="_custom">Otra cosa…</option></select>
        </label>
        <input v-if="avoidTask === '_custom'" class="input" v-model="custom" placeholder="¿Qué es?" />
        <label class="field"><span>¿Por qué crees que la evitas? (opcional, sin juzgarte)</span>
          <div class="chips"><Chip v-for="r in ['Es muy grande', 'No sé por dónde empezar', 'Me aburre', 'Me da miedo hacerlo mal', 'Estoy cansada']" :key="r" :active="why === r" @click="why = r">{{ r }}</Chip></div>
        </label>
        <label class="field"><span>2 · Tu acción de 5 minutos</span>
          <div class="stack" style="gap:6px"><Chip v-for="s in smallSteps" :key="s" :active="step === s" style="text-align:left;white-space:normal" @click="step = s">{{ s }}</Chip></div>
        </label>
        <div class="field"><span>3 · Quitar fricción</span>
          <label class="row small"><input type="checkbox" v-model="friction.phone" /><Icon name="phoneoff" :size="15" />Celular lejos</label>
          <label class="row small"><input type="checkbox" v-model="friction.water" /><Icon name="drop" :size="15" />Agua a la mano</label>
          <label class="row small"><input type="checkbox" v-model="friction.open" /><Icon name="folder" :size="15" />Abrí lo que necesito</label>
          <label class="row small"><input type="checkbox" v-model="friction.music" /><Icon name="headphones" :size="15" />Música tranquila</label>
        </div>
        <p v-if="principle" class="quote small"><Icon name="bulb" :size="14" class="inl" /> {{ principle.author }}: “{{ principle.text }}” — {{ principle.action }}</p>
        <button class="btn primary big block" @click="startAvoid"><Icon name="play" :size="18" />Empezar 5 minuticos</button>
        <button class="btn ghost sm" @click="avoid = 0">Volver</button>
      </div>
    </template>

    <!-- Inicio del modo enfoque -->
    <template v-else>
      <button class="card pink row" style="text-align:left;border:0" @click="avoid = 1">
        <Pet pose="hug" :size="90" /><div class="grow"><h2 style="font-size:18px">NO QUIERO HACER ESTO</h2><p class="small muted">Te ayudo a empezar con solo 5 minutos.</p></div><Icon name="chev" />
      </button>
      <div class="card stack">
        <h3>Sesión de enfoque</h3>
        <label class="field"><span>¿En qué vas a trabajar?</span>
          <select class="input" v-model="taskId"><option value="">Algo libre</option><option v-for="t in openTasks" :key="t.id" :value="t.id">{{ t.title }}</option></select>
        </label>
        <div class="chips"><Chip v-for="m in [5, 15, 25, 45, 60]" :key="m" :active="minutes === m" @click="minutes = m">{{ m }} min</Chip></div>
        <button class="btn primary block" @click="A.startFocus({ taskId, minutes })"><Icon name="play" :size="16" />Empezar</button>
      </div>
      <div class="card">
        <div class="row between"><h3>Sesiones recientes</h3><span class="small muted">Hoy: {{ fmtDur(today) }}</span></div>
        <div class="list">
          <div v-for="s in recent" :key="s.id" class="item small">
            <span class="ico" :class="{ lav: s.mode === 'empezar' }"><Icon :name="s.mode === 'empezar' ? 'sprout' : 'timer'" :size="18" /></span>
            <div class="grow">{{ state.tasks.find((t) => t.id === s.taskId)?.title || 'Sesión' }}<div class="tiny muted">{{ s.date }} · {{ s.minutes }} min · {{ s.outcome }}</div></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
