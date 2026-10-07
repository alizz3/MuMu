<script setup>
import { computed } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { award } from '../engine/game'
import { dayKey, shortDate } from '../engine/time'
import { Icon, Pet, Ring, Bar } from '../components/ui'

const courses = computed(() => state.courses)
const totalH = computed(() => courses.value.reduce((a, c) => a + (c.hours || 0), 0))
const goal = (c) => state.goals.find((g) => g.id === c.goalId)
const proj = (c) => state.projects.find((p) => p.id === c.projectId)
function session(c) {
  c.sessions = [...(c.sessions || []), dayKey()]
  c.hours = Math.round(((c.hours || 0) + 0.5) * 10) / 10
  award(4, 8, `Sesión de ${c.title}`)
}
function startCourse(c) { const t = A.addTask({ title: `Estudiar: ${c.title}`, category: 'aprendizaje', source: 'aprendizaje', estimate: 30, goalId: c.goalId, projectId: c.projectId }); A.startFocus({ taskId: t.id, minutes: 25 }); A.go('enfoque') }
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <Pet pose="laptop" :size="86" />
      <div class="grow"><h2 style="font-size:17px">Aprendizaje con propósito</h2><p class="small">Nada de coleccionar certificados: cada curso se conecta con un objetivo, un proyecto y una práctica real.</p>
        <div class="tiny muted" style="margin-top:4px">{{ courses.filter((c) => c.status === 'completado').length }} completados · {{ totalH }} h registradas</div></div>
    </div>
    <div class="row between"><h2 style="font-size:16px">Mis cursos</h2><button class="iconbtn add" aria-label="Nuevo curso" @click="ui.modal = { type: 'course', prefill: { platform: 'Platzi', status: 'en curso', progress: 0, hours: 0 } }"><Icon name="plus" /></button></div>
    <div v-for="c in courses" :key="c.id" class="card">
      <div class="row"><Ring :value="c.progress" :size="52" color="var(--lav-500)" :label="c.title" />
        <div class="grow"><div class="b small">{{ c.title }}</div><div class="tiny muted">{{ c.platform }} · {{ c.skill }} · {{ c.hours }} h · {{ (c.sessions || []).length }} sesiones</div></div>
        <button class="iconbtn" aria-label="Editar curso" @click="ui.modal = { type: 'course', id: c.id }"><Icon name="edit" :size="16" /></button></div>
      <div class="stack" style="gap:4px;margin-top:10px">
        <div class="small" v-if="goal(c)">🎯 <b>Objetivo:</b> {{ goal(c).name }}</div>
        <div class="small" v-if="proj(c)">📁 <b>Proyecto:</b> {{ proj(c).name }}</div>
        <div class="small" v-if="c.practice">🛠️ <b>Práctica real:</b> {{ c.practice }}</div>
      </div>
      <div class="row" style="gap:6px;margin-top:10px" v-if="c.status !== 'completado'">
        <button class="btn sm primary" @click="startCourse(c)"><Icon name="play" :size="14" />Estudiar 25 min</button>
        <button class="btn sm ghost" @click="session(c)">+ Registrar sesión</button>
        <button class="btn sm ghost" @click="c.progress = Math.min(100, c.progress + 10)">+10%</button>
      </div>
      <span v-else class="badge green" style="margin-top:8px">Completado ✨</span>
    </div>
    <p class="notice"><Icon name="link" :size="18" />Platzi no ofrece una API pública para leer tu progreso, así que aquí se registra a mano (o lo actualizas cuando terminas una clase). Nada se inventa.</p>
  </div>
</template>
