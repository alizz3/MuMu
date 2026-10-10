<script setup>
import { computed, ref, watch } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { habitStats } from '../engine/game'
import { dayKey, keyPlus, parseDay, WEEKDAYS, WEEKDAYS_LONG, MONTHS } from '../engine/time'
import { Icon, Ring } from '../components/ui'
import { habitIcon } from '../components/iconFor'
import TaskRow from '../components/TaskRow.vue'

// Sin id (por ejemplo al recargar /habito a secas) se vuelve a la lista de hábitos
if (!ui.params.id) { ui.route = 'habitos'; ui.params = {}; A.setUrl(false) }

const h = computed(() => state.habits.find((x) => x.id === ui.params.id))
// Si borras el hábito desde el editor, se vuelve atrás solo
watch(h, (v, old) => { if (!v && old) A.back() })

const k = dayKey()
const log = computed(() => (h.value && state.habitLogs[h.value.id]) || {})
const isDone = (key) => !!log.value[key]?.done
const s = computed(() => (h.value ? habitStats(h.value) : null))
const target = computed(() => Math.min(7, Number(h.value?.target) || 7))
// El mismo % que se ve en Hábitos: días cumplidos / días esperados en las últimas 2 semanas
const two = computed(() => {
  let d = 0
  for (let i = 0; i < 14; i++) if (isDone(keyPlus(-i))) d++
  const exp = Math.max(1, target.value * 2)
  return { done: d, exp, pct: Math.min(100, Math.round((d / exp) * 100)) }
})
const WHEN = { 'mañana': 'en la mañana', tarde: 'en la tarde', noche: 'en la noche' }
const freq = computed(() => {
  if (!h.value) return ''
  const t = target.value
  return [t >= 7 ? 'Todos los días' : `${t} ${t === 1 ? 'día' : 'días'} por semana`, WHEN[h.value.when]].filter(Boolean).join(' ')
})
const goal = computed(() => h.value?.goalId && state.goals.find((g) => g.id === h.value.goalId))

// Rachas: la actual (hoy todavía cuenta) y la mejor de todo tu historial
const streaks = computed(() => {
  let cur = 0
  for (let i = 0; i < 3660; i++) { const ok = isDone(keyPlus(-i)); if (i === 0 && !ok) continue; if (!ok) break; cur++ }
  const keys = Object.keys(log.value).filter((x) => log.value[x]?.done).sort()
  let best = 0, run = 0, prev = null
  keys.forEach((x) => { run = prev && Math.round((parseDay(x) - parseDay(prev)) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x })
  return { cur, best: Math.max(best, cur), total: keys.length }
})

// Calendario de las últimas 10 semanas (filas de lunes a domingo, columnas por semana)
const WEEKS = 10
const ROWS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const grid = computed(() => {
  const today = parseDay(k)
  const mondayOffset = (today.getDay() + 6) % 7 // días desde el lunes de esta semana
  const start = -mondayOffset - (WEEKS - 1) * 7
  return Array.from({ length: WEEKS }, (_, w) => {
    const days = Array.from({ length: 7 }, (_, d) => { const off = start + w * 7 + d; const key = keyPlus(off); return { key, off, future: off > 0, done: isDone(key), today: off === 0 } })
    const first = parseDay(days[0].key)
    const prevFirst = w > 0 ? parseDay(keyPlus(start + (w - 1) * 7)) : null
    return { days, month: !prevFirst || prevFirst.getMonth() !== first.getMonth() ? MONTHS[first.getMonth()].slice(0, 3) : '' }
  })
})
const cellLabel = (c) => { const d = parseDay(c.key); return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}: ${c.done ? 'hecho' : 'sin marcar'}` }
const tap = (c) => { if (!c.future && h.value) A.toggleHabit(h.value.id, c.key) }

// Historial: lo marcado, del más nuevo al más viejo
const showAll = ref(false)
const entries = computed(() => Object.entries(log.value).filter(([, l]) => l?.done).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, l]) => ({ key, ...l })))
const shown = computed(() => (showAll.value ? entries.value : entries.value.slice(0, 12)))
const dateText = (key) => { if (key === k) return 'Hoy'; if (key === keyPlus(-1)) return 'Ayer'; const d = parseDay(key); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}` }
const extras = (l) => Object.entries(l).filter(([x, v]) => !['done', 'note', 'at', 'key'].includes(x) && v !== '' && v != null && typeof v !== 'object').map(([x, v]) => `${x === 'value' ? 'Valor' : x}: ${v}`)

const tasks = computed(() => (h.value ? state.tasks.filter((t) => t.habitId === h.value.id && t.status !== 'cancelada') : []))
const tint = (col, n = 40) => ({ background: `color-mix(in srgb, ${col} ${n}%, var(--surface))`, color: 'var(--ink)' })
const edit = () => { ui.modal = { type: 'habit', id: h.value.id } }
</script>

<template>
  <div v-if="h" class="stack">
    <!-- Encabezado -->
    <div class="card hero">
      <div class="row" style="gap:12px;align-items:flex-start">
        <span class="gico big" :style="tint(h.color || '#B9DCCB', 45)"><Icon :name="habitIcon(h)" :size="22" /></span>
        <div class="grow" style="min-width:0">
          <h2 class="hname">{{ h.name }}</h2>
          <div class="small muted">{{ freq }}</div>
          <div v-if="goal" class="tiny muted row" style="gap:5px;margin-top:2px"><Icon name="target" :size="12" /><span class="ell">{{ goal.name }}</span></div>
        </div>
        <button class="iconbtn" aria-label="Editar hábito" @click="edit"><Icon name="edit" :size="17" /></button>
      </div>
      <div class="row" style="gap:14px;margin-top:14px">
        <Ring :value="two.pct" :size="70" :width="7" label="Cumplimiento de las últimas 2 semanas" />
        <div class="grow" style="min-width:0">
          <div class="b">{{ two.pct >= 80 ? 'Súper constante' : two.pct >= 50 ? 'Vas bien, sigue así' : two.pct > 0 ? 'Poquito a poquito' : 'Hoy puede ser el día uno' }}</div>
          <div class="small"><b class="num">{{ two.pct }}%</b> = {{ two.done }} de {{ two.exp }} días esperados en las últimas 2 semanas</div>
        </div>
      </div>
      <button class="btn block" :class="isDone(k) ? 'ghost' : 'primary'" style="margin-top:14px" @click="A.toggleHabit(h.id)">
        <Icon :name="isDone(k) ? 'check' : 'plus'" :size="16" />{{ isDone(k) ? 'Hecho hoy · toca para desmarcar' : 'Marcar hoy' }}
      </button>
    </div>

    <!-- Rachas -->
    <div class="tiles">
      <div class="card tight tile"><span class="gico" :style="tint('#F7B6C2')"><Icon name="flame" :size="16" /></span><div><b class="num">{{ streaks.cur }}</b><div class="tiny muted">racha actual</div></div></div>
      <div class="card tight tile"><span class="gico" :style="tint('#FFE29A')"><Icon name="trophy" :size="16" /></span><div><b class="num">{{ streaks.best }}</b><div class="tiny muted">mejor racha</div></div></div>
      <div class="card tight tile"><span class="gico" :style="tint('#C3B3D4')"><Icon name="check" :size="16" /></span><div><b class="num">{{ streaks.total }}</b><div class="tiny muted">días en total</div></div></div>
    </div>
    <p v-if="s?.paused" class="tiny muted" style="margin-top:-4px">Tu racha está en pausa, no perdida. Hoy la retomamos.</p>

    <!-- Calendario -->
    <div class="card">
      <div class="row between" style="gap:8px"><h3 style="white-space:nowrap">Últimas {{ WEEKS }} semanas</h3><span class="tiny muted" style="white-space:nowrap">toca para marcar</span></div>
      <div class="heat" role="grid" aria-label="Calendario del hábito">
        <div class="hcol labels" aria-hidden="true"><span class="mlab"></span><span v-for="(r, i) in ROWS" :key="i" class="rlab">{{ i % 2 === 0 ? r : '' }}</span></div>
        <div v-for="(w, wi) in grid" :key="wi" class="hcol" role="row">
          <span class="mlab" aria-hidden="true">{{ w.month }}</span>
          <button v-for="c in w.days" :key="c.key" role="gridcell" class="cell" :class="{ on: c.done, today: c.today, future: c.future }" :disabled="c.future" :aria-label="cellLabel(c)" :aria-pressed="c.done" :title="cellLabel(c)" :style="c.done ? { background: h.color || 'var(--pink-500)' } : {}" @click="tap(c)"></button>
        </div>
      </div>
      <div class="row tiny muted" style="gap:12px;margin-top:10px"><span class="row" style="gap:5px"><i class="sw"></i>sin marcar</span><span class="row" style="gap:5px"><i class="sw" :style="{ background: h.color || 'var(--pink-500)' }"></i>hecho</span><span class="row" style="gap:5px"><i class="sw ring"></i>hoy</span></div>
    </div>

    <!-- Tareas para arrancar -->
    <div v-if="tasks.length" class="card">
      <h3>Tareas de este hábito</h3>
      <div class="list" style="margin-top:6px"><TaskRow v-for="t in tasks" :key="t.id" :task="t" /></div>
    </div>

    <!-- Historial -->
    <div class="card">
      <div class="row between"><h3>Lo que has hecho</h3><span class="badge">{{ entries.length }}</span></div>
      <p v-if="!entries.length" class="tiny muted" style="margin-top:6px">Todavía no hay días marcados. El primero siempre es el más bonito.</p>
      <div class="hist">
        <div v-for="e in shown" :key="e.key" class="hitem">
          <span class="hdot" :style="{ background: h.color || 'var(--pink-500)' }"></span>
          <div class="grow" style="min-width:0">
            <div class="small"><b>{{ dateText(e.key) }}</b><span v-if="e.at" class="tiny muted num"> · {{ e.at }}</span></div>
            <div v-if="e.note" class="tiny" style="margin-top:2px"><Icon name="note" :size="12" class="inl" /> {{ e.note }}</div>
            <div v-for="x in extras(e)" :key="x" class="tiny muted">{{ x }}</div>
          </div>
        </div>
      </div>
      <button v-if="entries.length > 12" class="link small" style="margin-top:6px" @click="showAll = !showAll">{{ showAll ? 'Ver menos' : `Ver los ${entries.length}` }}</button>
    </div>

    <div class="row" style="gap:8px">
      <button class="btn lav grow" @click="edit"><Icon name="edit" :size="15" />Editar</button>
      <button class="btn ghost grow" @click="A.go('habitos')"><Icon name="heart" :size="15" />Ver todos</button>
    </div>
  </div>
  <div v-else class="card stack" style="align-items:center;text-align:center;margin-top:20px">
    <p class="small">No encontré ese hábito. Puede que lo hayas borrado.</p>
    <button class="btn primary sm" @click="A.go('habitos')">Ver mis hábitos</button>
  </div>
</template>

<style scoped>
.gico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; }
.gico.big { width: 46px; height: 46px; border-radius: 14px; }
.hname { font-size: 19px; line-height: 1.2; overflow-wrap: anywhere; }
.ell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.num { font-variant-numeric: tabular-nums; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tile { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.tile b { font-size: 20px; line-height: 1; }
.tile .tiny { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px; }
.tile > div { min-width: 0; max-width: 100%; }
.heat { display: grid; grid-template-columns: 14px repeat(10, minmax(0, 1fr)); gap: 4px; margin-top: 12px; max-width: 380px; }
.hcol { display: grid; grid-template-rows: 14px repeat(7, auto); gap: 4px; min-width: 0; }
.mlab { font-size: 10px; color: var(--muted); white-space: nowrap; line-height: 14px; overflow: visible; }
.rlab { font-size: 10px; color: var(--muted); display: grid; place-items: center; aspect-ratio: 1; }
.cell { aspect-ratio: 1; width: 100%; max-width: 30px; border: 0; padding: 0; border-radius: 6px; background: var(--track); cursor: pointer; transition: transform .12s; }
.cell:hover:not(:disabled) { transform: scale(1.12); }
.cell.today { box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--pink-500); }
.cell.future { background: transparent; border: 1px dashed var(--line); cursor: default; }
.sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; background: var(--track); }
.sw.ring { background: transparent; box-shadow: inset 0 0 0 1.5px var(--pink-500); }
.hist { margin-top: 6px; }
.hitem { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--line); }
.hitem:last-child { border-bottom: 0; }
.hdot { width: 9px; height: 9px; border-radius: 50%; flex: none; margin-top: 6px; }
</style>
