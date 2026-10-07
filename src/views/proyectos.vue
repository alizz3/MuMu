<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { shortDate } from '../engine/time'
import { Icon, Ring, Chip, Bar } from '../components/ui'
import TaskRow from '../components/TaskRow.vue'

const FLOW = [['idea', 'Idea 💭'], ['plan', 'Plan 📝'], ['progreso', 'En progreso 🚀'], ['pausado', 'Pausado ⏸️'], ['completado', 'Completado ✨']]
const view = ref('tablero')
const area = ref('todas')
const sel = computed(() => state.projects.find((p) => p.id === ui.params.id))
const projects = computed(() => state.projects.filter((p) => area.value === 'todas' || p.area === area.value))
const tasksOf = (p) => state.tasks.filter((t) => t.projectId === p.id)
const goalOf = (p) => state.goals.find((g) => g.id === p.goalId)
const coursesOf = (p) => state.courses.filter((c) => c.projectId === p.id)
const move = (p, dir) => { const i = FLOW.findIndex((f) => f[0] === p.status); p.status = FLOW[Math.max(0, Math.min(FLOW.length - 1, i + dir))][0] }
</script>

<template>
  <div class="stack">
    <!-- Detalle -->
    <template v-if="sel">
      <div class="card" :style="{ borderTop: `5px solid ${sel.color || 'var(--lav-300)'}` }">
        <div class="row"><Ring :value="A.projectProgress(sel)" :size="60" :label="sel.name" /><div class="grow"><h2>{{ sel.name }}</h2><div class="small muted">{{ sel.description }}</div></div>
          <button class="iconbtn" aria-label="Editar proyecto" @click="ui.modal = { type: 'project', id: sel.id }"><Icon name="edit" :size="18" /></button></div>
        <div class="row wrap" style="gap:6px;margin-top:10px">
          <span class="badge pink">{{ FLOW.find((f) => f[0] === sel.status)?.[1] }}</span>
          <span v-if="goalOf(sel)" class="badge">🎯 {{ goalOf(sel).name }}</span>
          <span v-if="sel.due" class="badge">📅 {{ shortDate(sel.due) }}</span>
          <span v-for="s in sel.skills || []" :key="s" class="badge green">{{ s }}</span>
        </div>
        <div class="row" style="gap:6px;margin-top:10px"><button class="btn sm ghost" @click="move(sel, -1)">← Etapa</button><button class="btn sm lav" @click="move(sel, 1)">Siguiente etapa →</button></div>
      </div>
      <div class="card">
        <div class="row between"><h3>Tareas</h3><button class="link" @click="ui.modal = { type: 'task', prefill: { projectId: sel.id, goalId: sel.goalId, category: 'trabajo' } }">+ Tarea</button></div>
        <div class="list"><TaskRow v-for="t in tasksOf(sel)" :key="t.id" :task="t" /></div>
      </div>
      <div class="card" v-if="(sel.resources || []).length || coursesOf(sel).length">
        <h3>Recursos y aprendizaje</h3>
        <div v-for="r in sel.resources" :key="r" class="small" style="padding:4px 0">🔗 {{ r }}</div>
        <div v-for="c in coursesOf(sel)" :key="c.id" class="small" style="padding:4px 0">📘 {{ c.title }} — práctica: {{ c.practice }}</div>
      </div>
    </template>

    <!-- Lista / tablero -->
    <template v-else>
      <div class="row">
        <div class="seg grow"><button :class="{ on: view === 'tablero' }" @click="view = 'tablero'">Tablero</button><button :class="{ on: view === 'lista' }" @click="view = 'lista'">Lista</button></div>
        <button class="iconbtn add" aria-label="Nuevo proyecto" @click="ui.modal = { type: 'project', prefill: { status: 'idea' } }"><Icon name="plus" /></button>
      </div>
      <div class="chips"><Chip v-for="a in ['todas', 'carrera', 'freelance', 'personal', 'aprendizaje', 'universidad']" :key="a" :active="area === a" @click="area = a">{{ a }}</Chip></div>
      <template v-if="view === 'tablero'">
        <div v-for="f in FLOW" :key="f[0]">
          <div class="sec-title"><h2>{{ f[1] }}</h2><span class="badge">{{ projects.filter((p) => p.status === f[0]).length }}</span></div>
          <div class="stack" style="gap:8px;margin-top:10px">
            <button v-for="p in projects.filter((x) => x.status === f[0])" :key="p.id" class="card tight" style="text-align:left;border-left:5px solid;cursor:pointer" :style="{ borderLeftColor: p.color }" @click="A.go('proyectos', { id: p.id })">
              <div class="row between"><b class="small">{{ p.name }}</b><span class="tiny muted">{{ tasksOf(p).filter((t) => t.status === 'completada').length }}/{{ tasksOf(p).length }}</span></div>
              <Bar :value="A.projectProgress(p)" style="margin-top:8px" :color="p.color" />
              <div class="tiny muted" style="margin-top:6px">{{ goalOf(p) ? '🎯 ' + goalOf(p).name : 'Sin objetivo' }}</div>
            </button>
          </div>
        </div>
      </template>
      <div v-else class="card"><div class="list">
        <button v-for="p in projects" :key="p.id" class="item" style="all:unset;display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer" @click="A.go('proyectos', { id: p.id })">
          <Ring :value="A.projectProgress(p)" :size="40" /><div class="grow"><div class="b small">{{ p.name }}</div><div class="tiny muted">{{ p.area }} · {{ p.status }}</div></div><Icon name="chev" :size="16" />
        </button>
      </div></div>
    </template>
  </div>
</template>
