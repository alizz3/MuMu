<script setup>
import { computed, ref } from 'vue'
import { state } from '../store'
import * as A from '../store/actions'
import { insights, series } from '../engine/insights'
import { habitStats, overallConsistency } from '../engine/game'
import { fmtDur, WEEKDAYS } from '../engine/time'
import { Pet, Ring, Bar, Chip } from '../components/ui'

const range = ref(14)
const s = computed(() => series(range.value))
const ins = computed(() => insights())
const max = (k) => Math.max(1, ...s.value.map((x) => x[k] || 0))
const sum = (k) => s.value.reduce((a, x) => a + (x[k] || 0), 0)
const cons = computed(() => overallConsistency())
const learnH = computed(() => state.courses.reduce((a, c) => a + (c.hours || 0), 0))
const CHARTS = [
  { k: 'focus', t: 'Minutos de enfoque', c: 'var(--pink-300)', f: (v) => fmtDur(v) },
  { k: 'tasks', t: 'Tareas completadas', c: 'var(--lav-300)', f: (v) => v },
  { k: 'sleep', t: 'Horas de sueño', c: '#BFD7F0', f: (v) => (v ? v.toFixed(1) + 'h' : '—') },
  { k: 'social', t: 'Minutos en redes', c: 'var(--peach)', f: (v) => (v == null ? '—' : fmtDur(v)) },
  { k: 'habits', t: 'Hábitos cumplidos', c: 'var(--mint)', f: (v) => v },
]
</script>

<template>
  <div class="stack">
    <div class="card pink row"><Pet pose="calc" :size="86" /><div class="grow"><h2 style="font-size:17px">Detecté algo 👀</h2><p class="tiny muted">Observaciones sobre tus datos, nunca diagnósticos.</p></div></div>
    <div v-for="i in ins" :key="i.id" class="card tight row" style="align-items:flex-start">
      <span class="ico" style="font-size:18px">{{ i.emoji }}</span><div class="grow small">{{ i.text }}<div class="tiny muted">Basado en {{ i.basis }}</div></div>
    </div>
    <p v-if="!ins.length" class="small muted">Aún no hay suficientes datos. Con unos días de registros aparecerán patrones.</p>

    <div class="chips"><Chip v-for="r in [7, 14, 28]" :key="r" :active="range === r" @click="range = r">Últimos {{ r }} días</Chip></div>
    <div class="grid2">
      <div class="kpi"><b>{{ fmtDur(sum('focus')) }}</b><span>de enfoque</span></div>
      <div class="kpi"><b>{{ sum('tasks') }}</b><span>tareas completadas</span></div>
      <div class="kpi"><b>{{ cons.active }}/{{ cons.days }}</b><span>días constantes</span></div>
      <div class="kpi"><b>{{ learnH }} h</b><span>de cursos</span></div>
    </div>

    <div v-for="ch in CHARTS" :key="ch.k" class="card">
      <div class="row between"><h3>{{ ch.t }}</h3><span class="tiny muted">máx {{ ch.f(max(ch.k)) }}</span></div>
      <div class="spark" style="height:80px;margin-top:10px" role="img" :aria-label="ch.t">
        <i v-for="x in s" :key="x.k" :style="{ height: ((x[ch.k] || 0) / max(ch.k) * 100) + '%', background: ch.c }" :title="`${x.k}: ${ch.f(x[ch.k])}`"></i>
      </div>
      <div class="row between tiny muted" style="margin-top:4px"><span>{{ WEEKDAYS[s[0].d.getDay()] }} {{ s[0].d.getDate() }}</span><span>hoy</span></div>
    </div>

    <div class="card">
      <h3>Cumplimiento de hábitos (24 días)</h3>
      <div v-for="h in state.habits" :key="h.id" style="margin-top:10px">
        <div class="row between small"><span>{{ h.emoji }} {{ h.name }}</span><span class="muted">{{ habitStats(h).done }}/24</span></div>
        <Bar :value="habitStats(h).done / 24 * 100" :color="h.color" style="margin-top:4px" />
      </div>
    </div>

    <div class="card">
      <h3>Objetivos y proyectos</h3>
      <div class="grid2" style="margin-top:10px">
        <div v-for="g in state.goals" :key="g.id" class="row"><Ring :value="A.goalProgress(g)" :size="42" /><span class="small">{{ g.name }}</span></div>
      </div>
      <div v-for="p in state.projects" :key="p.id" style="margin-top:10px"><div class="row between small"><span>📁 {{ p.name }}</span><span class="muted">{{ A.projectProgress(p) }}%</span></div><Bar :value="A.projectProgress(p)" :color="p.color" style="margin-top:4px" /></div>
    </div>
  </div>
</template>
