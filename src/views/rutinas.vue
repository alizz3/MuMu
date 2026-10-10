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
import DiaUCard from '../components/DiaUCard.vue'

const k = dayKey()
const open = ref(ui.now.getHours() >= 18 ? 'ro2' : 'ro1')
const logs = computed(() => (state.routineLogs[k] = state.routineLogs[k] || {}))
const isDone = (r, i) => (logs.value[r.id] || []).includes(i)
function toggle(r, i) {
  const arr = (logs.value[r.id] = logs.value[r.id] || [])
  const j = arr.indexOf(i)
  if (j >= 0) { if (arr.length === r.steps.length) markRewarded(`rutina:${r.id}:${k}`); arr.splice(j, 1) } else arr.push(i)
  if (arr.length === r.steps.length) awardOnce(`rutina:${r.id}:${k}`, 8, 12, `Rutina ${r.name} completa`)
}
const RCOL = ['#FFE29A', '#C3B3D4', '#B9DCCB', '#BFD7F0', '#F7B6C2']
const rcolor = (r, i) => r.color || RCOL[i % RCOL.length]
const sub = (r) => `${fmtDur(r.steps.reduce((a, s) => a + (s.min || 0), 0))}${(logs.value[r.id] || []).length === r.steps.length && r.steps.length ? ' · completa hoy' : ''}`
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
    <DiaUCard />
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
    <GroupCard v-for="(r, ri) in state.routines" :key="r.id" :title="r.name" :sub="sub(r)" :icon="routineIcon(r)" :color="rcolor(r, ri)" :count="`${(logs[r.id] || []).length}/${r.steps.length}`" :open="open === r.id" @toggle="open = open === r.id ? null : r.id">
      <div>
        <div v-for="(s, i) in r.steps" :key="i" class="item">
          <button class="check" :class="{ on: isDone(r, i) }" :aria-label="`Paso ${s.t}`" @click="toggle(r, i)"><Icon v-if="isDone(r, i)" name="check" :size="14" :stroke="3" /></button>
          <div class="grow small" :class="{ 'done-txt': isDone(r, i) }">{{ s.t }}</div>
          <span class="tiny muted">{{ s.at ? fmt12(hm(s.at)) : s.min ? s.min + ' min' : '' }}</span>
          <button class="iconbtn" style="width:28px;height:28px" aria-label="Quitar paso" @click="r.steps.splice(i, 1)"><Icon name="x" :size="14" /></button>
        </div>
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
