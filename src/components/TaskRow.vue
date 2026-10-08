<script setup>
import { computed } from 'vue'
import { state, ui } from '../store'
import { completeTask, reopenTask } from '../store/actions'
import { effectivePriority } from '../engine/planner'
import { relDay, daysUntil, fmtDur, fmt12s } from '../engine/time'
import { Icon } from './ui'

const props = defineProps({ task: Object, compact: Boolean })
const t = computed(() => props.task)
const done = computed(() => t.value.status === 'completada')
const subj = computed(() => state.subjects.find((s) => s.id === t.value.subjectId))
const proj = computed(() => state.projects.find((p) => p.id === t.value.projectId))
const prio = computed(() => effectivePriority(t.value))
const d = computed(() => daysUntil(t.value.due))
const SRC = { aula: '🎓 Aula', gmail: '📧 Gmail', classroom: '🏫 Classroom', calendar: '🗓️', manual: '' }
const toggle = () => (done.value ? reopenTask(t.value.id) : completeTask(t.value.id))
const subs = computed(() => t.value.subtasks?.length ? `${t.value.subtasks.filter((s) => s.done).length}/${t.value.subtasks.length}` : '')
</script>

<template>
  <div class="item">
    <button class="check" :class="{ on: done }" :aria-label="done ? 'Marcar como pendiente' : 'Completar tarea'" @click="toggle"><Icon v-if="done" name="check" :size="15" :stroke="3" /></button>
    <button class="grow" style="all:unset;cursor:pointer;min-width:0;flex:1" @click="ui.modal = { type: 'task', id: t.id }">
      <div class="title-line" :class="{ 'done-txt': done }">{{ t.title }}</div>
      <div class="row wrap tiny muted" style="gap:6px;margin-top:3px">
        <span v-if="t.due && !done" :style="{ color: d < 0 ? 'var(--danger)' : d <= 1 ? 'var(--pink-700)' : '' }">{{ d < 0 ? 'Atrasada · ' : '' }}{{ relDay(t.due) }}{{ /^\d{2}:\d{2}$/.test(t.dueTime || '') ? ' ' + fmt12s(t.dueTime) : '' }}</span>
        <span v-if="!compact">· {{ fmtDur(t.estimate) }}</span>
        <span v-if="subj">· {{ subj.short }}</span>
        <span v-else-if="proj">· {{ proj.name }}</span>
        <span v-if="subs">· ☑ {{ subs }}</span>
        <span v-if="SRC[t.source] && !compact">· {{ SRC[t.source] }}</span>
        <span v-if="t.demo" class="badge demo">ejemplo</span>
      </div>
    </button>
    <span v-if="t.grade != null" class="badge" :class="t.grade >= 4 ? 'green' : t.grade >= 3 ? '' : 'pink'">🎯 {{ (+t.grade).toFixed(1) }}</span>
    <span v-if="!done && prio === 'alta'" class="badge red">alta</span>
    <span v-if="t.status === 'en progreso'" class="badge">en curso</span>
  </div>
</template>
