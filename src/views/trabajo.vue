<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { isOpen } from '../engine/planner'
import { uid, dayKey, shortDate } from '../engine/time'
import { Icon, Pet, Ring, Chip } from '../components/ui'
import TaskRow from '../components/TaskRow.vue'

if (!state.opportunities) state.opportunities = []
const work = computed(() => state.projects.filter((p) => ['carrera', 'freelance', 'trabajo'].includes(p.area)))
const tasks = computed(() => state.tasks.filter((t) => isOpen(t) && t.category === 'trabajo').slice(0, 6))
const skills = computed(() => {
  const m = {}
  state.projects.forEach((p) => (p.skills || []).forEach((s) => ((m[s] = m[s] || { s, projects: 0, courses: 0 }).projects++)))
  state.courses.forEach((c) => c.skill && ((m[c.skill] = m[c.skill] || { s: c.skill, projects: 0, courses: 0 }).courses++))
  return Object.values(m).sort((a, b) => b.projects + b.courses - a.projects - a.courses)
})
const opp = ref({ title: '', kind: 'freelance', status: 'idea', link: '' })
function addOpp() { if (!opp.value.title) return; state.opportunities.unshift({ id: uid('o'), date: dayKey(), ...opp.value }); opp.value = { title: '', kind: 'freelance', status: 'idea', link: '' } }
const STAGES = ['idea', 'contactado', 'propuesta', 'en curso', 'cerrado']
</script>

<template>
  <div class="stack">
    <div class="card pink row"><Pet pose="laptop" :size="84" /><div class="grow"><h2 style="font-size:17px">Trabajo y carrera</h2><p class="small">Freelance, portafolio, oportunidades y las habilidades que vas construyendo.</p></div></div>

    <div class="sec-title"><h2>Proyectos profesionales</h2><button class="link" @click="ui.modal = { type: 'project', prefill: { area: 'freelance', status: 'idea' } }">+ Proyecto</button></div>
    <div class="grid2">
      <button v-for="p in work" :key="p.id" class="card tight" style="text-align:left" @click="A.go('proyectos', { id: p.id })">
        <div class="row"><Ring :value="A.projectProgress(p)" :size="40" :color="p.color" /><div class="grow small b" style="line-height:1.2">{{ p.name }}</div></div>
        <div class="tiny muted" style="margin-top:6px">{{ p.area }} · {{ p.status }}</div>
      </button>
    </div>

    <div class="card"><h3>Siguientes acciones</h3><div class="list"><TaskRow v-for="t in tasks" :key="t.id" :task="t" /></div></div>

    <div class="card">
      <h3>Habilidades que estás construyendo</h3>
      <div class="row wrap" style="gap:6px;margin-top:10px"><span v-for="s in skills" :key="s.s" class="badge pink">{{ s.s }} · {{ s.projects }}📁 {{ s.courses }}📘</span></div>
    </div>

    <div class="card">
      <h3>Oportunidades</h3>
      <div class="row" style="margin-top:8px"><input class="input" v-model="opp.title" placeholder="Cliente, vacante o idea…" /><select class="input" style="width:auto" v-model="opp.kind"><option>freelance</option><option>empleo</option><option>práctica</option><option>colaboración</option></select><button class="btn sm lav" @click="addOpp">+</button></div>
      <div v-for="o in state.opportunities" :key="o.id" class="item small">
        <span class="grow">{{ o.title }} <span class="badge">{{ o.kind }}</span></span>
        <select class="input" style="width:auto;padding:4px 8px;font-size:12px" v-model="o.status" aria-label="Etapa"><option v-for="s in STAGES" :key="s">{{ s }}</option></select>
        <button class="iconbtn" style="width:28px;height:28px" aria-label="Crear tarea" @click="ui.modal = { type: 'task', prefill: { title: `Seguimiento: ${o.title}`, category: 'trabajo' } }"><Icon name="plus" :size="14" /></button>
      </div>
      <p v-if="!state.opportunities.length" class="tiny muted" style="margin-top:8px">Anota aquí clientes potenciales y vacantes para no perderlas.</p>
    </div>
  </div>
</template>
