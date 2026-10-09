<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { habitStats } from '../engine/game'
import { relDay, shortDate } from '../engine/time'
import { Icon, Ring, Chip } from '../components/ui'
import { goalIcon, habitIcon } from '../components/iconFor'
import TaskRow from '../components/TaskRow.vue'

const open = ref(null)
const cat = ref('todas')
const cats = computed(() => ['todas', ...new Set(state.goals.map((g) => g.category))])
const goals = computed(() => state.goals.filter((g) => cat.value === 'todas' || g.category === cat.value).map((g) => ({
  ...g, p: A.goalProgress(g),
  projects: state.projects.filter((p) => p.goalId === g.id),
  tasks: state.tasks.filter((t) => t.goalId === g.id && t.status !== 'completada' && t.status !== 'cancelada'),
  habits: state.habits.filter((h) => h.goalId === g.id),
  courses: state.courses.filter((c) => c.goalId === g.id),
})))
</script>

<template>
  <div class="stack">
    <div class="row"><div class="chips grow"><Chip v-for="c in cats" :key="c" :active="cat === c" @click="cat = c">{{ c }}</Chip></div>
      <button class="iconbtn add" aria-label="Nuevo objetivo" @click="ui.modal = { type: 'goal' }"><Icon name="plus" /></button></div>
    <div v-for="g in goals" :key="g.id" class="card">
      <button class="row" style="all:unset;display:flex;gap:12px;align-items:center;width:100%;cursor:pointer" @click="open = open === g.id ? null : g.id" :aria-expanded="open === g.id">
        <Ring :value="g.p" :size="56" :label="g.name" />
        <div class="grow"><div class="b wi"><Icon :name="goalIcon(g)" :size="16" />{{ g.name }}</div><div class="tiny muted">{{ g.category }}{{ g.due ? ' · meta ' + shortDate(g.due) : '' }} · {{ g.projects.length }} proyectos · {{ g.tasks.length }} tareas · {{ g.habits.length }} hábitos</div></div>
        <Icon :name="open === g.id ? 'back' : 'chev'" :size="18" style="transform:rotate(-90deg)" />
      </button>
      <div v-if="open === g.id" class="stack" style="margin-top:12px;gap:10px">
        <p v-if="g.description" class="small muted">{{ g.description }}</p>
        <div v-if="g.projects.length"><div class="tiny b muted">PROYECTOS</div>
          <button v-for="p in g.projects" :key="p.id" class="row small" style="all:unset;display:flex;gap:8px;padding:6px 0;cursor:pointer" @click="A.go('proyectos', { id: p.id })"><Icon name="folder" :size="14" />{{ p.name }} <span class="badge">{{ A.projectProgress(p) }}%</span></button>
        </div>
        <div v-if="g.habits.length"><div class="tiny b muted">HÁBITOS</div>
          <div v-for="h in g.habits" :key="h.id" class="small" style="padding:4px 0"><Icon :name="habitIcon(h)" :size="14" class="inl" /> {{ h.name }} · {{ habitStats(h).weekDone }}/7 esta semana</div>
        </div>
        <div v-if="g.courses.length"><div class="tiny b muted">APRENDIZAJE</div>
          <div v-for="c in g.courses" :key="c.id" class="small" style="padding:4px 0"><Icon name="book" :size="14" class="inl" /> {{ c.title }} · {{ c.progress }}%</div>
        </div>
        <div v-if="g.tasks.length"><div class="tiny b muted">PRÓXIMAS ACCIONES</div><div class="list"><TaskRow v-for="t in g.tasks.slice(0, 5)" :key="t.id" :task="t" compact /></div></div>
        <div class="row" style="gap:6px">
          <button class="btn sm lav" @click="ui.modal = { type: 'task', prefill: { goalId: g.id } }">+ Acción pequeña</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'project', prefill: { goalId: g.id, status: 'idea' } }">+ Proyecto</button>
          <button class="btn sm ghost" @click="ui.modal = { type: 'goal', id: g.id }"><Icon name="edit" :size="14" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
