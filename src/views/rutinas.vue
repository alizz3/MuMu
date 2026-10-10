<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { daily, award, awardOnce, markRewarded } from '../engine/game'
import { rankedTasks } from '../engine/planner'
import { dayKey, keyPlus, hm, toHM, fmt12, fmtDur } from '../engine/time'
import { Icon, Pet } from '../components/ui'
import { routineIcon } from '../components/iconFor'
import GroupCard from '../components/GroupCard.vue'
import ListBar from '../components/ListBar.vue'
import { UNI_STEPS, nextUniDay, sleepCycles, uniPlan } from '../services/device'
import { relDay, longDate, parseDay } from '../engine/time'

const k = dayKey()
// Rutina de Universidad: la noche anterior + el día de U, con horas calculadas solas
state.routines.forEach((r) => { if (r.uni && !r.steps?.length) r.steps = JSON.parse(JSON.stringify(UNI_STEPS)) })
const uni = computed(() => nextUniDay(ui.now))
const uniR = computed(() => state.routines.find((r) => r.uni))
// ¿Toca ya? La noche antes (desde las 4 p.m.) o el mismo día
const uniNow = computed(() => uni.value && (uni.value.i === 0 || (uni.value.i === 1 && ui.now.getHours() >= 16)))
const open = ref(uniNow.value && uniR.value ? uniR.value.id : ui.now.getHours() >= 18 ? 'ro2' : 'ro1')
// Los pasos de la U se guardan en el día de la U (así lo de la noche anterior sigue marcado al otro día)
const logKey = (r) => (r.uni && uni.value ? uni.value.k : k)
const logsOf = (r) => { const d = logKey(r); if (!state.routineLogs[d]) state.routineLogs[d] = {}; return state.routineLogs[d] }
const logs = computed(() => Object.fromEntries(state.routines.map((r) => [r.id, state.routineLogs[logKey(r)]?.[r.id] || []])))
const isDone = (r, i) => (logs.value[r.id] || []).includes(i)
function toggle(r, i) {
  const L = logsOf(r), d = logKey(r)
  const arr = (L[r.id] = L[r.id] || [])
  const j = arr.indexOf(i)
  if (j >= 0) { if (arr.length === r.steps.length) markRewarded(`rutina:${r.id}:${d}`); arr.splice(j, 1) } else arr.push(i)
  if (arr.length === r.steps.length) awardOnce(`rutina:${r.id}:${d}`, 8, 12, `Rutina ${r.name} completa`)
}
const autoAt = (s) => { const u = uni.value; if (!u || !s.auto) return null; return u[s.auto] }
const p = uniPlan()
const leaveFor = computed({ get: () => (uni.value && p.overrides[uni.value.k]?.leave) || p.leave, set: (v) => { if (uni.value) p.overrides[uni.value.k] = { leave: v } } })
const cuando = (kk) => { const r = relDay(kk); return ['hoy', 'mañana'].includes(r) ? r : longDate(parseDay(kk)) }
const showHoras = ref(false)
// Si mañana (o hoy) hay U, la rutina de Universidad va primero
const ordered = computed(() => uniNow.value ? [...state.routines].sort((a, b) => (b.uni ? 1 : 0) - (a.uni ? 1 : 0)) : state.routines)
// Ciclos de sueño desde la hora actual hasta la alarma de mañana
const wakeTomorrow = computed(() => (uni.value && uni.value.i === 1 ? uni.value.wake : hm(state.profile.wake)))
const cyc = computed(() => sleepCycles(wakeTomorrow.value, ui.now))
const RCOL = ['#FFE29A', '#C3B3D4', '#B9DCCB', '#BFD7F0', '#F7B6C2']
const rcolor = (r, i) => r.color || RCOL[i % RCOL.length]
const sub = (r) => r.uni ? (uni.value ? (uniNow.value ? (uni.value.i === 0 ? 'Hoy tienes U · sigue tu rutina' : 'Mañana tienes U · ve haciendo tu rutina') : `Próxima U: ${cuando(uni.value.k)}`) : 'Noche anterior y día de U') : `${fmtDur(r.steps.reduce((a, s) => a + (s.min || 0), 0))}${(logs.value[r.id] || []).length === r.steps.length && r.steps.length ? ' · completa hoy' : ''}`
const newStep = ref('')
function addStep(r) { if (newStep.value.trim()) { r.steps.push({ t: newStep.value.trim(), min: 10 }); newStep.value = '' } }

// Aprende horarios reales a partir de lo que registras (no impone las 5 a.m.)
const realWake = computed(() => {
  const w = state.sleep.slice(0, 14).map((s) => hm(s.wake)).filter((x) => x > 240 && x < 720)
  if (w.length < 4) return null
  const avg = Math.round(w.reduce((a, b) => a + b, 0) / w.length / 5) * 5
  return avg
})
const realBed = computed(() => {
  const b = state.sleep.slice(0, 14).map((s) => { let m = hm(s.bed); if (m < 360) m += 1440; return m })
  if (b.length < 4) return null
  return Math.round(b.reduce((a, x) => a + x, 0) / b.length / 5) * 5
})
const suggestedWake = computed(() => (realWake.value ? Math.max(realWake.value - 15, hm(state.profile.wake) - 30) : null))
const tomorrow = computed(() => daily(keyPlus(1)))
const tomorrowTask = computed(() => state.tasks.find((t) => t.id === tomorrow.value.priority))
</script>

<template>
  <div class="stack">
    <div class="card soft row">
      <Pet pose="coffee" :size="80" />
      <div class="grow small">
        <div class="b">Rutinas flexibles</div>
        <p v-if="realWake">En las últimas 2 semanas te despertaste en promedio a las <b>{{ fmt12(realWake) }}</b><span v-if="realBed"> y te dormiste hacia las <b>{{ fmt12(realBed % 1440) }}</b></span>.
          <span v-if="suggestedWake && Math.abs(suggestedWake - hm(state.profile.wake)) > 10"> Un horario realista sería despertar a las <b>{{ fmt12(suggestedWake) }}</b>.</span></p>
        <p v-else class="muted">Registra tu sueño unos días y te sugeriré horarios realistas, sin imponerte madrugar.</p>
        <button v-if="suggestedWake && Math.abs(suggestedWake - hm(state.profile.wake)) > 10" class="btn sm lav" style="margin-top:6px" @click="state.profile.wake = toHM(suggestedWake)">Usar {{ fmt12(suggestedWake) }}</button>
      </div>
    </div>
    <div class="grid2">
      <label class="field"><span>Despertar ideal</span><input class="input" type="time" v-model="state.profile.wake" /></label>
      <label class="field"><span>Dormir ideal</span><input class="input" type="time" v-model="state.profile.sleep" /></label>
    </div>

    <ListBar :count="state.routines.length" one="rutina" />
    <GroupCard v-for="(r, ri) in ordered" :key="r.id" :title="r.name" :sub="sub(r)" :icon="routineIcon(r)" :color="rcolor(r, ri)" :count="`${(logs[r.id] || []).length}/${r.steps.length}`" :open="open === r.id" @toggle="open = open === r.id ? null : r.id">
      <div>
        <template v-if="r.uni">
          <div v-if="uni" class="tiny muted" style="margin:4px 0 2px">Próxima U: <b>{{ cuando(uni.k) }}</b> · primera clase {{ fmt12(uni.first) }}</div>
          <div v-else class="tiny muted" style="margin:4px 0 2px">No veo clases en las próximas 3 semanas en tu calendario de la U.</div>
          <template v-for="sec in [['antes', 'La noche anterior', 'moon'], ['dia', 'El día de U', 'cap']]" :key="sec[0]">
            <div class="tiny muted b dt-h"><Icon :name="sec[2]" :size="12" />{{ sec[1] }}</div>
            <template v-for="(s, i) in r.steps" :key="i">
              <div v-if="(s.sec || 'dia') === sec[0]" class="item">
                <button class="check" :class="{ on: isDone(r, i) }" :aria-label="`Paso ${s.t}`" @click="toggle(r, i)"><Icon v-if="isDone(r, i)" name="check" :size="14" :stroke="3" /></button>
                <div class="grow small" :class="{ 'done-txt': isDone(r, i) }">{{ s.t }}</div>
                <span class="tiny muted">{{ autoAt(s) != null ? fmt12(autoAt(s)) : s.at ? fmt12(hm(s.at)) : s.min ? s.min + ' min' : '' }}</span>
                <button class="iconbtn" style="width:28px;height:28px" aria-label="Quitar paso" @click="r.steps.splice(i, 1)"><Icon name="x" :size="14" /></button>
              </div>
              <div v-if="s.auto === 'leave' && uni && sec[0] === 'dia'" class="clases">
                <div v-for="c in uni.cls" :key="c.id" class="tiny muted row" style="gap:6px"><Icon name="cap" :size="12" />{{ fmt12(hm(c.start)) }} – {{ fmt12(hm(c.end)) }} · {{ c.title }}</div>
              </div>
            </template>
            <div v-if="sec[0] === 'antes' && uni && uni.i === 1" class="ciclos">
              <div class="small b wi"><Icon name="moon" :size="14" />Son las {{ fmt12(cyc.now) }}</div>
              <p v-if="cyc.opts.length" class="tiny" style="margin:4px 0 0">Para levantarte a las <b>{{ fmt12(cyc.wake) }}</b> completando ciclos de sueño, acuéstate a las
                <template v-for="(o, j) in cyc.opts" :key="o.n"><b>{{ fmt12(o.at) }}</b> ({{ o.h }} h){{ j < cyc.opts.length - 2 ? ', ' : j === cyc.opts.length - 2 ? ' o ' : '.' }}</template></p>
              <p v-else class="tiny" style="margin:4px 0 0">Acuéstate ya: hasta las {{ fmt12(cyc.wake) }} alcanzas {{ cyc.cycles }} {{ cyc.cycles === 1 ? 'ciclo' : 'ciclos' }} ({{ fmtDur(Math.max(0, cyc.left)) }}).</p>
            </div>
          </template>
          <div class="row wrap" style="gap:6px;margin-top:10px;align-items:center">
            <label v-if="uni" class="row small leave"><span>Ese día sales a las</span><input type="time" class="input" v-model="leaveFor" aria-label="Hora de salida" /></label>
            <button class="link tiny" @click="showHoras = !showHoras">{{ showHoras ? 'Listo' : 'Ajustar horas' }}</button>
          </div>
          <div v-if="showHoras" class="stack" style="gap:8px;margin-top:8px">
            <label class="row small"><span class="grow">Hora normal de salida</span><input type="time" class="input w" v-model="p.leave" /></label>
            <label class="row small"><span class="grow">Minutos para alistarte</span><input type="number" min="15" max="180" step="5" class="input w" v-model.number="p.getReady" /></label>
            <label class="row small"><span class="grow">Trayecto U → casa (min)</span><input type="number" min="5" max="180" step="5" class="input w" v-model.number="p.commute" /></label>
            <label class="row small"><span class="grow">Horas de sueño</span><input type="number" min="5" max="10" step="0.5" class="input w" v-model.number="p.sleepH" /></label>
            <label class="row small"><span class="grow">Recordarme la rutina a las</span><input type="time" class="input w" v-model="p.bagAt" /></label>
          </div>
        </template>
        <template v-else>
        <div v-for="(s, i) in r.steps" :key="i" class="item">
          <button class="check" :class="{ on: isDone(r, i) }" :aria-label="`Paso ${s.t}`" @click="toggle(r, i)"><Icon v-if="isDone(r, i)" name="check" :size="14" :stroke="3" /></button>
          <div class="grow small" :class="{ 'done-txt': isDone(r, i) }">{{ s.t }}</div>
          <span class="tiny muted">{{ s.at ? fmt12(hm(s.at)) : s.min ? s.min + ' min' : '' }}</span>
          <button class="iconbtn" style="width:28px;height:28px" aria-label="Quitar paso" @click="r.steps.splice(i, 1)"><Icon name="x" :size="14" /></button>
        </div>
        <div v-if="r.id === 'ro2'" class="ciclos">
          <div class="small b wi"><Icon name="moon" :size="14" />Son las {{ fmt12(cyc.now) }}</div>
          <p v-if="cyc.opts.length" class="tiny" style="margin:4px 0 0">Para levantarte a las <b>{{ fmt12(cyc.wake) }}</b> completando ciclos de sueño, acuéstate a las
            <template v-for="(o, j) in cyc.opts" :key="o.n"><b>{{ fmt12(o.at) }}</b> ({{ o.h }} h){{ j < cyc.opts.length - 2 ? ', ' : j === cyc.opts.length - 2 ? ' o ' : '.' }}</template></p>
          <p v-else class="tiny" style="margin:4px 0 0">Acuéstate ya: hasta las {{ fmt12(cyc.wake) }} alcanzas {{ cyc.cycles }} {{ cyc.cycles === 1 ? 'ciclo' : 'ciclos' }} ({{ fmtDur(Math.max(0, cyc.left)) }}).</p>
        </div>
        </template>
        <div class="row" style="margin-top:8px"><input class="input" v-model="newStep" placeholder="Agregar paso…" @keyup.enter="addStep(r)" /><button class="btn sm lav" @click="addStep(r)">+</button></div>
        <div v-if="r.id === 'ro2'" class="card tight soft" style="margin-top:12px">
          <div class="small b wi"><Icon name="moon" :size="15" />Dejar mañana preparado</div>
          <p class="tiny muted">Brian Tracy sugiere planear la noche anterior. ¿Cuál será tu prioridad de mañana?</p>
          <p v-if="tomorrowTask" class="small wi" style="margin-top:6px"><Icon name="star" :size="14" />{{ tomorrowTask.title }}</p>
          <div class="stack" style="gap:4px;margin-top:6px">
            <button v-for="x in rankedTasks().slice(0, 4)" :key="x.t.id" class="chip" :class="{ on: tomorrow.priority === x.t.id }" style="text-align:left" @click="tomorrow.priority = x.t.id">{{ x.t.title }}</button>
          </div>
        </div>
      </div>
    </GroupCard>
  </div>
</template>

<style scoped>
.ciclos { margin: 10px 0 2px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--lav-300) 22%, var(--surface)); }
.clases { padding: 2px 0 6px 38px; display: grid; gap: 3px; }
.leave { gap: 8px; align-items: center; background: var(--surface-3); border-radius: 12px; padding: 4px 4px 4px 12px; }
.leave .input, .w { width: auto; max-width: 130px; padding: 6px 8px; }
</style>
