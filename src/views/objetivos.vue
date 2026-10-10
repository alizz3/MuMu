<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { habitStats } from '../engine/game'
import { relDay, shortDate } from '../engine/time'
import { Icon, Ring } from '../components/ui'
import { habitIcon } from '../components/iconFor'
import TaskRow from '../components/TaskRow.vue'
import Seg from '../components/Seg.vue'
import ListBar from '../components/ListBar.vue'
import GroupCard from '../components/GroupCard.vue'

// Abiertos/cerrados y la categoría se recuerdan, como en Tareas (empiezan cerrados)
const opened = computed(() => (state.settings.goalOpen ||= {}))
const cat = computed({ get: () => state.settings.goalCat || 'todas', set: (v) => (state.settings.goalCat = v) })
const CAT_ICON = { universidad: 'cap', carrera: 'briefcase', dinero: 'wallet', salud: 'heart', aprendizaje: 'book', personal: 'sparkles', bienestar: 'leaf', familia: 'users', trabajo: 'briefcase', fe: 'dove', 'inglés': 'globe', ingles: 'globe' }
const cap = (c) => c[0].toUpperCase() + c.slice(1)
const cats = computed(() => [['todas', 'Todos', null, state.goals.length], ...[...new Set(state.goals.map((g) => g.category).filter(Boolean))].map((c) => [c, cap(c), CAT_ICON[c] || null, state.goals.filter((g) => g.category === c).length])])
if (cat.value !== 'todas' && !state.goals.some((g) => g.category === cat.value)) cat.value = 'todas'
const goals = computed(() => state.goals.filter((g) => cat.value === 'todas' || g.category === cat.value).map((g) => ({
  ...g, p: A.goalProgress(g),
  projects: state.projects.filter((p) => p.goalId === g.id),
  tasks: state.tasks.filter((t) => t.goalId === g.id && t.status !== 'completada' && t.status !== 'cancelada'),
  habits: state.habits.filter((h) => h.goalId === g.id),
  courses: state.courses.filter((c) => c.goalId === g.id),
})))
const allFolded = computed(() => goals.value.length > 0 && goals.value.every((g) => !opened.value[g.id]))
const foldAll = () => { const v = allFolded.value; goals.value.forEach((g) => (opened.value[g.id] = v)) }
const meta = (g) => [g.category, g.due ? 'meta ' + shortDate(g.due) : '', `${g.projects.length} proyectos · ${g.tasks.length} tareas · ${g.habits.length} hábitos`].filter(Boolean).join(' · ')
</script>

<template>
  <div class="stack">
    <div class="row" style="gap:8px">
      <Seg v-model="cat" :options="cats" label="Categoría" class="grow" style="min-width:0" />
      <button class="iconbtn add" aria-label="Nuevo objetivo" @click="ui.modal = { type: 'goal' }"><Icon name="plus" /></button>
    </div>
    <ListBar :count="goals.length" one="objetivo" :foldable="goals.length > 1" :all-folded="allFolded" @fold="foldAll" />
    <GroupCard v-for="g in goals" :key="g.id" :title="g.name" :sub="meta(g)" wrap :open="!!opened[g.id]" @toggle="opened[g.id] = !opened[g.id]">
      <template #lead><Ring :value="g.p" :size="48" :label="g.name" /></template>
      <template #badge><span></span></template>
      <div class="stack" style="margin-top:4px;gap:10px">
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
    </GroupCard>
    <p v-if="!goals.length" class="small muted" style="text-align:center">Aún no hay objetivos aquí.</p>
  </div>
</template>
