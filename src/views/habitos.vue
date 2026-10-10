<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { habitStats, overallConsistency, streakMessage } from '../engine/game'
import { dayKey, keyPlus, WEEKDAYS } from '../engine/time'
import { Icon, Pet, Ring } from '../components/ui'
import { habitIcon, GOAL_ICON } from '../components/iconFor'
import TaskRow from '../components/TaskRow.vue'
const habitTasks = (h) => state.tasks.filter((t) => t.habitId === h.id && t.status !== 'cancelada')

const k = dayKey()
const c = computed(() => overallConsistency())
const isDone = (h) => !!state.habitLogs[h.id]?.[k]?.done
const doneToday = computed(() => state.habits.filter(isDone).length)
// Mismo % que la página de cada hábito: días cumplidos / días esperados en las últimas 2 semanas
const pct14 = (h) => { const exp = Math.max(1, Math.min(7, Number(h.target) || 7) * 2); let d = 0; for (let i = 0; i < 14; i++) if (state.habitLogs[h.id]?.[keyPlus(-i)]?.done) d++; return Math.min(100, Math.round((d / exp) * 100)) }

// Áreas (salen del objetivo de cada hábito) y momentos del día
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const AREA_COLOR = { universidad: '#C3B3D4', 'inglés': '#BFD7F0', carrera: '#B9DCCB', trabajo: '#B9DCCB', dinero: '#FFE29A', familia: '#F7B6C2', espiritualidad: '#E8DDF5', bienestar: '#FAD6A5', aprendizaje: '#BFD7F0', proyectos: '#B9DCCB', 'vida personal': '#FAD6A5' }
function areaOf(h) {
  const g = h.goalId && state.goals.find((x) => x.id === h.goalId)
  if (!g?.category) return { key: 'a-otros', order: 9, label: 'Personal', icon: 'leaf', color: '#E7E1EE' }
  return { key: 'a-' + g.category, order: 1, label: cap(g.category), icon: GOAL_ICON[g.category] || 'target', color: g.color || AREA_COLOR[g.category] || '#C3B3D4' }
}
const MOMENT = { 'mañana': { order: 0, label: 'Mañana', icon: 'sun', color: '#FFE29A' }, tarde: { order: 1, label: 'Tarde', icon: 'clock', color: '#C3B3D4' }, noche: { order: 2, label: 'Noche', icon: 'moon', color: '#BFD7F0' } }
const momentOf = (h) => { const m = MOMENT[h.when]; return m ? { key: 'm-' + h.when, ...m } : { key: 'm-any', order: 3, label: 'Cuando puedas', icon: 'sparkles', color: '#E7E1EE' } }

// Pestañas por área (se recuerda) y agrupación por momento o por área
const pref = (key, d) => computed({ get: () => state.settings[key] || d, set: (v) => (state.settings[key] = v) })
const tab = pref('habitTab', 'todos')
const group = pref('habitGroup', 'momento')
const VIEWS = [['momento', 'Momento', 'clock'], ['area', 'Área', 'target']]
const tabs = computed(() => {
  const m = {}
  state.habits.forEach((h) => { const a = areaOf(h); (m[a.key] ||= { ...a, n: 0 }).n++ })
  return [{ key: 'todos', label: 'Todos', n: state.habits.length }, ...Object.values(m).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))]
})
const activeTab = computed(() => (tabs.value.some((t) => t.key === tab.value) ? tab.value : 'todos'))
const list = computed(() => state.habits.filter((h) => activeTab.value === 'todos' || areaOf(h).key === activeTab.value).map((h) => ({ h, s: habitStats(h), p: pct14(h) })))
const groups = computed(() => {
  const g = {}
  const by = group.value === 'area' && activeTab.value === 'todos' ? areaOf : momentOf
  list.value.forEach((x) => { const m = by(x.h); (g[m.key] ||= { ...m, v: [] }).v.push(x) })
  return Object.values(g).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
})
const folded = computed(() => (state.settings.habitFolded ||= {}))
const toggle = (key) => { folded.value[key] = !folded.value[key] }
const allFolded = computed(() => groups.value.length > 0 && groups.value.every((g) => folded.value[g.key]))
const foldAll = () => { const v = !allFolded.value; groups.value.forEach((g) => (folded.value[g.key] = v)) }
const tint = (col, n = 40) => ({ background: `color-mix(in srgb, ${col} ${n}%, var(--surface))`, color: 'var(--ink)' })

const open = (h) => A.go('habito', { id: h.id })
const noteFor = ref(null)
const noteText = ref('')
function saveNote(h) { const l = state.habitLogs[h.id][k]; if (l) l.note = noteText.value; noteFor.value = null; noteText.value = '' }
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <Ring :value="c.weekPct" :size="78" :width="8" label="Consistencia semanal" />
      <div class="grow" style="min-width:0">
        <div class="tiny muted b">RESUMEN SEMANAL</div>
        <div class="b">{{ c.weekPct >= 70 ? '¡Vas muy bien!' : c.weekPct >= 40 ? 'Poquito a poquito' : 'Cada día es un nuevo intento' }}</div>
        <div class="small">{{ doneToday }} de {{ state.habits.length }} hábitos hoy</div>
        <div class="tiny muted">{{ streakMessage() }}</div>
      </div>
      <Pet :pose="c.weekPct >= 70 ? 'celebrate' : 'happy'" :size="80" />
    </div>

    <div class="row" style="gap:8px">
      <div class="seg tabs grow" role="tablist" aria-label="Qué hábitos ver">
        <button v-for="t in tabs" :key="t.key" role="tab" :aria-selected="activeTab === t.key" :class="{ on: activeTab === t.key }" @click="tab = t.key">{{ t.label }}</button>
      </div>
      <button class="iconbtn add" aria-label="Nuevo hábito" @click="ui.modal = { type: 'habit' }"><Icon name="plus" /></button>
    </div>

    <div class="row between">
      <span class="small muted">{{ list.length }} {{ list.length === 1 ? 'hábito' : 'hábitos' }} · {{ list.filter((x) => isDone(x.h)).length }} hoy</span>
      <div class="row" style="gap:6px">
        <button v-if="groups.length > 1" class="fold" :aria-label="allFolded ? 'Expandir todo' : 'Contraer todo'" :title="allFolded ? 'Expandir todo' : 'Contraer todo'" @click="foldAll"><Icon :name="allFolded ? 'expand' : 'collapse'" :size="16" /></button>
        <div v-if="activeTab === 'todos'" class="views" role="radiogroup" aria-label="Agrupar">
          <button v-for="v in VIEWS" :key="v[0]" role="radio" :aria-checked="group === v[0]" :class="{ on: group === v[0] }" :title="`Agrupar por ${v[1].toLowerCase()}`" @click="group = v[0]"><Icon :name="v[2]" :size="14" /><span>{{ v[1] }}</span></button>
        </div>
      </div>
    </div>
    <p v-if="state.habits.length > 7" class="notice"><Icon name="bulb" :size="14" class="inl" /> Tienes {{ state.habits.length }} hábitos. Empezar con 5–6 suele funcionar mejor.</p>

    <section v-for="g in groups" :key="g.key" class="card grp">
      <button class="grp-head" :aria-expanded="!folded[g.key]" @click="toggle(g.key)">
        <span class="gico" :style="tint(g.color, 38)"><Icon :name="g.icon" :size="16" /></span>
        <h3 class="grow">{{ g.label }}</h3>
        <span class="badge num" :title="`${g.v.filter((x) => isDone(x.h)).length} de ${g.v.length} hoy`">{{ g.v.filter((x) => isDone(x.h)).length }}/{{ g.v.length }}</span>
        <Icon name="chev" :size="16" class="muted" :style="{ transform: folded[g.key] ? 'none' : 'rotate(90deg)', transition: 'transform .2s' }" />
      </button>
      <div v-if="!folded[g.key]" class="hlist">
        <div v-for="{ h, s, p } in g.v" :key="h.id" class="hrow" role="link" tabindex="0" :aria-label="`Ver ${h.name}`" @click="open(h)" @keydown.enter.self="open(h)">
          <div class="row" style="gap:10px">
            <button class="check" :class="{ on: isDone(h) }" :aria-label="`Marcar ${h.name} hoy`" @click.stop="A.toggleHabit(h.id)" style="width:34px;height:34px"><Icon v-if="isDone(h)" name="check" :size="18" :stroke="3" /></button>
            <span class="gico sm" :style="tint(h.color || '#B9DCCB')"><Icon :name="habitIcon(h)" :size="15" /></span>
            <div class="grow" style="min-width:0">
              <div class="b small hn">{{ h.name }}</div>
              <div class="tiny muted">{{ s.weekDone }} de 7 esta semana
                <span v-if="s.trend > 0" style="color:var(--ok)">· mejor que la pasada</span>
                <span v-else-if="s.paused" style="color:var(--pink-700)">· racha pausada, retomamos hoy</span>
                <span v-else-if="s.current > 1">· {{ s.current }} días seguidos</span>
              </div>
            </div>
            <button class="iconbtn sm" aria-label="Editar hábito" @click.stop="ui.modal = { type: 'habit', id: h.id }"><Icon name="edit" :size="15" /></button>
          </div>
          <div class="week" style="margin-top:8px;padding-left:44px;align-items:center">
            <span v-for="d in s.week" :key="d.k" :class="{ on: d.done, today: d.k === k }" :title="d.k" :style="d.done ? { background: h.color } : {}">{{ WEEKDAYS[d.wd][0] }}</span>
            <span class="grow" style="background:none;width:auto"></span>
            <button v-if="isDone(h)" class="link tiny" @click.stop="noteFor = h.id; noteText = state.habitLogs[h.id][k].note || ''">+ nota</button>
            <span class="pct num" title="Cumplimiento de las últimas 2 semanas">{{ p }}%</span>
          </div>
          <div v-if="noteFor === h.id" class="row" style="margin-top:8px;padding-left:44px" @click.stop><input class="input" v-model="noteText" placeholder="¿Cómo fue? ¿Qué ayudó?" @keydown.enter="saveNote(h)" /><button class="btn sm lav" @click="saveNote(h)">OK</button></div>
          <p v-if="state.habitLogs[h.id]?.[k]?.note && noteFor !== h.id" class="tiny muted" style="margin-top:6px;padding-left:44px"><Icon name="note" :size="12" class="inl" /> {{ state.habitLogs[h.id][k].note }}</p>
          <div v-if="habitTasks(h).length" class="list tasks" @click.stop><div class="tiny muted" style="margin:4px 0">Para arrancar</div><TaskRow v-for="t in habitTasks(h)" :key="t.id" :task="t" /></div>
        </div>
      </div>
    </section>
    <div v-if="!state.habits.length" class="card stack" style="align-items:center;text-align:center">
      <Pet pose="happy" :size="90" />
      <p class="small">Todavía no tienes hábitos. Empieza con uno chiquito.</p>
      <button class="btn primary sm" @click="ui.modal = { type: 'habit' }">Crear hábito</button>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; overflow-x: auto; scrollbar-width: none; min-width: 0; }
.tabs::-webkit-scrollbar { display: none; }
.tabs button { flex: 1 0 auto; white-space: nowrap; padding: 7px 12px; }
.views { display: inline-flex; background: var(--surface-3); border-radius: 12px; padding: 3px; gap: 2px; }
.views button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--ink-2); font: inherit; font-size: 12.5px; padding: 6px 10px; border-radius: 9px; cursor: pointer; }
.views button.on { background: var(--surface); color: var(--pink-700); font-weight: 600; box-shadow: var(--shadow); }
.fold { width: 32px; height: 32px; border-radius: 10px; border: 0; background: var(--surface-3); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; }
.fold:hover { color: var(--pink-700); }
.grp { padding-top: 12px; padding-bottom: 12px; }
.grp-head { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
.grp-head h3 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; }
.gico.sm { width: 28px; height: 28px; border-radius: 9px; }
.hlist { margin-top: 8px; }
.hrow { padding: 10px 0; border-top: 1px solid var(--line); cursor: pointer; border-radius: 4px; }
.hrow:focus-visible { outline: 2px solid var(--pink-300); outline-offset: 2px; }
.hrow:hover .b { color: var(--pink-700); }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.num { font-variant-numeric: tabular-nums; }
.hn { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.week .pct { width: auto; height: auto; background: none; font-size: 12.5px; font-weight: 700; color: var(--ink-2); flex: none; padding-left: 4px; }
.iconbtn.sm { width: 32px; height: 32px; flex: none; }
.tasks { margin-top: 8px; margin-left: 44px; border-top: 1px dashed var(--line); padding-top: 4px; cursor: default; }
@media (max-width: 380px) { .views button span { display: none; } }
</style>
