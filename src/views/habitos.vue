<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { habitStats, overallConsistency, streakMessage } from '../engine/game'
import { dayKey, WEEKDAYS } from '../engine/time'
import { Icon, Pet, Ring, Chip } from '../components/ui'
import { habitIcon } from '../components/iconFor'
import TaskRow from '../components/TaskRow.vue'
const habitTasks = (h) => state.tasks.filter((t) => t.habitId === h.id && t.status !== 'cancelada')

const when = ref('todos')
const k = dayKey()
const c = computed(() => overallConsistency())
const doneToday = computed(() => state.habits.filter((h) => state.habitLogs[h.id]?.[k]?.done).length)
const list = computed(() => state.habits.filter((h) => when.value === 'todos' || h.when === when.value).map((h) => ({ h, s: habitStats(h) })))
const noteFor = ref(null)
const noteText = ref('')
function saveNote(h) { const l = state.habitLogs[h.id][k]; if (l) l.note = noteText.value; noteFor.value = null; noteText.value = '' }
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <Ring :value="c.weekPct" :size="78" :width="8" label="Consistencia semanal" />
      <div class="grow">
        <div class="tiny muted b">RESUMEN SEMANAL</div>
        <div class="b">{{ c.weekPct >= 70 ? '¡Vas muy bien!' : c.weekPct >= 40 ? 'Poquito a poquito' : 'Cada día es un nuevo intento' }}</div>
        <div class="small">{{ doneToday }} de {{ state.habits.length }} hábitos hoy</div>
        <div class="tiny muted">{{ streakMessage() }}</div>
      </div>
      <Pet :pose="c.weekPct >= 70 ? 'celebrate' : 'happy'" :size="80" />
    </div>
    <div class="row"><div class="chips grow"><Chip v-for="w in ['todos', 'mañana', 'tarde', 'noche']" :key="w" :active="when === w" @click="when = w">{{ w }}</Chip></div>
      <button class="iconbtn add" aria-label="Nuevo hábito" @click="ui.modal = { type: 'habit' }"><Icon name="plus" /></button></div>
    <p v-if="state.habits.length > 7" class="notice"><Icon name="bulb" :size="14" class="inl" /> Tienes {{ state.habits.length }} hábitos. Empezar con 5–6 suele funcionar mejor.</p>

    <div v-for="{ h, s } in list" :key="h.id" class="card">
      <div class="row">
        <button class="check" :class="{ on: state.habitLogs[h.id]?.[k]?.done }" :aria-label="`Marcar ${h.name} hoy`" @click="A.toggleHabit(h.id)" style="width:34px;height:34px"><Icon v-if="state.habitLogs[h.id]?.[k]?.done" name="check" :size="18" :stroke="3" /></button>
        <span class="gico" :style="{ background: `color-mix(in srgb, ${h.color || '#B9DCCB'} 40%, var(--surface))`, color: 'var(--ink)' }"><Icon :name="habitIcon(h)" :size="15" /></span>
        <div class="grow">
          <div class="b small">{{ h.name }}</div>
          <div class="tiny muted">Lo cumpliste {{ s.weekDone }} de los últimos 7 días · {{ s.done }} de {{ s.days }} días
            <span v-if="s.trend > 0" style="color:var(--ok)">↑ mejor que la semana pasada</span>
            <span v-else-if="s.paused" style="color:var(--pink-700)">· racha pausada, retomamos hoy</span>
            <span v-else-if="s.current > 1">· {{ s.current }} días seguidos</span>
          </div>
        </div>
        <button class="iconbtn" aria-label="Editar hábito" @click="ui.modal = { type: 'habit', id: h.id }"><Icon name="edit" :size="16" /></button>
      </div>
      <div class="week" style="margin-top:10px">
        <span v-for="d in s.week" :key="d.k" :class="{ on: d.done, today: d.k === k }" :title="d.k" :style="d.done ? { background: h.color } : {}">{{ WEEKDAYS[d.wd][0] }}</span>
        <span class="grow"></span>
        <button v-if="state.habitLogs[h.id]?.[k]?.done" class="link tiny" @click="noteFor = h.id; noteText = state.habitLogs[h.id][k].note || ''">+ nota / contexto</button>
      </div>
      <div v-if="noteFor === h.id" class="row" style="margin-top:8px"><input class="input" v-model="noteText" placeholder="¿Cómo fue? ¿Qué ayudó?" /><button class="btn sm lav" @click="saveNote(h)">OK</button></div>
      <p v-if="state.habitLogs[h.id]?.[k]?.note && noteFor !== h.id" class="tiny muted" style="margin-top:6px"><Icon name="note" :size="12" class="inl" /> {{ state.habitLogs[h.id][k].note }}</p>
      <div v-if="habitTasks(h).length" class="list" style="margin-top:8px;border-top:1px solid var(--line);padding-top:4px"><div class="tiny muted" style="margin:4px 0">Para arrancar</div><TaskRow v-for="t in habitTasks(h)" :key="t.id" :task="t" /></div>
    </div>
  </div>
</template>
