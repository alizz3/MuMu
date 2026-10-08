<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { daily } from '../engine/game'
import { isOpen } from '../engine/planner'
import { relDay, WEEKDAYS, fmt12s, dayKey } from '../engine/time'
import { syncAula, syncClassroom, canUseBackend } from '../services/api'
import { toast } from '../engine/game'
import { Icon, Pet, Ring, Chip } from '../components/ui'
import TaskRow from '../components/TaskRow.vue'
import AulaStatus from '../components/AulaStatus.vue'
import { importProfes } from '../engine/contactos'

const tab = ref('cursos')
const sel = ref(null)
const inst = ref('todas')
const subjects = computed(() => state.subjects.filter((s) => inst.value === 'todas' || s.institution === inst.value).map((s) => {
  const ts = state.tasks.filter((t) => t.subjectId === s.id && t.status !== 'cancelada')
  return { ...s, ts, open: ts.filter(isOpen), p: ts.length ? Math.round(ts.filter((t) => t.status === 'completada').length / ts.length * 100) : 0 }
}))
const uniTasks = computed(() => state.tasks.filter((t) => isOpen(t) && (t.category === 'universidad' || t.subjectId)).sort((a, b) => ((a.due || 'z') > (b.due || 'z') ? 1 : -1)))
const aula = computed(() => [...state.aula].sort((a, b) => (a.firstSeen < b.firstSeen ? 1 : -1)))
const subjOf = (id) => state.subjects.find((s) => s.id === id)
const sync = ref(false)
const aulaInt = computed(() => state.integrations.aula)
async function doSync() {
  sync.value = true
  try { await syncAula(); if (classroomOn.value) await syncClassroom() } catch (e) { toast(e.message) } finally { sync.value = false }
}
const reviewed = computed(() => daily().reviewed)
async function onCSV(ev) {
  const f = ev.target.files?.[0]; if (!f) return
  try { const r = importProfes(await f.text()); toast(`Profes listos: ${r.updated} materias actualizadas, ${r.created} nuevas 👩‍🏫`) } catch (e) { toast('No pude leer ese archivo. Expórtalo desde Google Contacts como “Google CSV”.') }
  ev.target.value = ''
}
const classroomOn = computed(() => state.integrations.google.some((a) => a.services.includes('classroom')))
const syncCr = ref(false)
async function doClassroom() { syncCr.value = true; try { await syncClassroom(); state.aula = state.aula.filter((a) => !a.demo); daily().reviewed = true } catch (e) { toast(e.message) } finally { syncCr.value = false } }
const autos = computed(() => A.autoSubjects())
const reales = computed(() => state.subjects.filter((s) => !autos.value.includes(s)))
const hint = (id) => state.aula.filter((a) => a.courseId === id).slice(0, 2).map((a) => a.title).join(' · ')
const into = ref({})
function merge(s) { const t = into.value[s.id]; if (!t) return; const name = subjOf(t)?.name; A.mergeSubject(s.id, t); toast(`Unida con ${name} ✨ Lo que llegue de ese curso irá allí`) }
const tidied = A.tidySubjects(); if (tidied) toast(`Uní ${tidied} materia${tidied === 1 ? '' : 's'} repetida${tidied === 1 ? '' : 's'} 🧩`)
const selS = computed(() => subjects.value.find((s) => s.id === sel.value))
</script>

<template>
  <div class="stack">
    <AulaStatus />
    <div class="seg"><button v-for="t in [['cursos', 'Materias'], ['tareas', 'Tareas'], ['aula', 'Tu Aula · Classroom']]" :key="t[0]" :class="{ on: tab === t[0] }" @click="tab = t[0]; sel = null">{{ t[1] }}</button></div>

    <!-- Materia seleccionada -->
    <template v-if="selS">
      <div class="card" :style="{ borderTop: `5px solid ${selS.color}` }">
        <div class="row"><Ring :value="selS.p" :size="56" :color="selS.color" /><div class="grow"><h2>{{ selS.name }}</h2><div class="small muted">{{ selS.institution }}{{ selS.teacher ? ' · ' + selS.teacher : '' }}</div></div>
          <button class="iconbtn" aria-label="Editar materia" @click="ui.modal = { type: 'subject', id: selS.id }"><Icon name="edit" :size="18" /></button></div>
        <div v-if="selS.teacherEmail || selS.teacherPhone" class="small" style="margin-top:8px"><span class="sel">✉️ {{ selS.teacherEmail }}</span><span v-if="selS.teacherPhone"> · 📱 {{ selS.teacherPhone }}</span></div>
        <div class="row wrap" style="gap:6px;margin-top:8px"><span v-for="(h, i) in selS.schedule" :key="i" class="badge">{{ WEEKDAYS[h.weekday] }} {{ fmt12s(h.start) }}–{{ fmt12s(h.end) }}</span></div>
        <p v-if="selS.notes" class="small" style="margin-top:8px;white-space:pre-line">{{ selS.notes }}</p>
      </div>
      <div class="card"><div class="row between"><h3>Tareas</h3><button class="link" @click="ui.modal = { type: 'task', prefill: { subjectId: selS.id, category: 'universidad', goalId: 'g1' } }">+ Tarea</button></div>
        <div class="list"><TaskRow v-for="t in selS.ts" :key="t.id" :task="t" /></div></div>
      <div class="card"><h3>Actividades detectadas</h3>
        <div v-for="a in state.aula.filter((x) => x.courseId === selS.id)" :key="a.id" class="small" style="padding:6px 0">• {{ a.title }} <span class="muted">{{ a.due ? '· ' + relDay(a.due) : '' }}</span></div></div>
      <button class="btn ghost" @click="sel = null">← Todas las materias</button>
    </template>

    <template v-else-if="tab === 'cursos'">
      <div class="row"><div class="chips grow"><Chip v-for="i in ['todas', 'UT', 'SENA', 'Classroom']" :key="i" :active="inst === i" @click="inst = i">{{ i === 'UT' ? 'U. del Tolima' : i }}</Chip></div>
        <button class="iconbtn add" aria-label="Nueva materia" @click="ui.modal = { type: 'subject', prefill: { institution: 'UT', color: '#E8DDF5', schedule: [] } }"><Icon name="plus" /></button></div>
      <div v-if="autos.length && reales.length" class="card soft stack" style="gap:10px">
        <div><b class="small">🧩 ¿Cuál materia es cada una?</b><p class="tiny muted">Tu Aula y Classroom nombran los cursos con códigos. Dime a cuál de tus materias corresponde y MuMu lo recordará para siempre.</p></div>
        <div v-for="s in autos" :key="s.id" class="stack" style="gap:4px">
          <div class="small b" style="word-break:break-all">{{ s.name }}</div>
          <div v-if="hint(s.id)" class="tiny muted">Ej.: {{ hint(s.id) }}</div>
          <div class="row"><select class="input" v-model="into[s.id]" :aria-label="`Materia real de ${s.name}`"><option :value="undefined" disabled>Es…</option><option v-for="r in reales" :key="r.id" :value="r.id">{{ r.name }}</option></select><button class="btn sm primary" :disabled="!into[s.id]" @click="merge(s)">Unir</button></div>
        </div>
      </div>
      <button v-for="s in subjects" :key="s.id" class="card row" style="text-align:left;cursor:pointer" @click="sel = s.id">
        <span style="width:6px;align-self:stretch;border-radius:4px" :style="{ background: s.color }"></span>
        <div class="grow"><div class="b small">{{ s.name }}</div><div v-if="s.teacher" class="tiny muted">👩‍🏫 {{ s.teacher }}{{ s.teacherEmail ? ' · ✉️' : '' }}</div><div class="tiny muted">{{ s.open.length }} {{ s.open.length === 1 ? 'tarea pendiente' : 'tareas pendientes' }} · {{ s.schedule.map((h) => WEEKDAYS[h.weekday]).join(', ') || 'sin horario' }}</div></div>
        <Ring :value="s.p" :size="46" :color="s.color" />
      </button>
      <label class="card row" style="cursor:pointer">
        <span class="ico lav">👩‍🏫</span>
        <div class="grow"><div class="b small">Importar mis profes</div><div class="tiny muted">Sube el CSV de Google Contacts y cada profe queda en su materia: sus correos salen como importantes.</div></div>
        <span class="btn sm lav">Elegir archivo</span>
        <input type="file" accept=".csv,text/csv" class="sr" @change="onCSV" />
      </label>
      <div class="card pink now-card" style="min-height:130px">
        <h3>Recordatorio 🎓</h3>
        <p class="small" style="max-width:62%;margin-top:4px">Revisa tu Aula antes de tu próxima clase.</p>
        <div class="row" style="margin-top:10px;gap:6px">
          <button class="btn sm primary" @click="tab = 'aula'">Ir a Aula</button>
          <button class="btn sm ghost" :disabled="reviewed" @click="daily().reviewed = true">{{ reviewed ? 'Revisado ✓' : 'Ya revisé' }}</button>
        </div>
        <Pet pose="grad" :size="100" :bob="false" />
      </div>
    </template>

    <template v-else-if="tab === 'tareas'">
      <div class="card"><div class="list"><TaskRow v-for="t in uniTasks" :key="t.id" :task="t" /></div>
        <p v-if="!uniTasks.length" class="small muted">Sin tareas universitarias pendientes 🎉</p></div>
    </template>

    <template v-else>
      <div class="card">
        <div class="row"><span class="ico lav"><Icon name="cap" /></span>
          <div class="grow"><div class="b small">Tu Aula (Moodle)</div>
            <div class="tiny muted">{{ aulaInt.status === 'conectado' ? `Conectada vía ${aulaInt.method === 'webservice' ? 'servicio web' : 'calendario iCal'} · última revisión ${aulaInt.lastSync ? new Date(aulaInt.lastSync).toLocaleString('es-CO') : 'nunca'}` : 'No conectada todavía' }}</div></div>
          <button v-if="aulaInt.status === 'conectado' && canUseBackend()" class="btn sm primary" :disabled="sync" @click="doSync"><Icon name="refresh" :size="14" />{{ sync ? 'Revisando…' : 'Revisar ahora' }}</button>
          <button v-else class="btn sm lav" @click="A.go('ajustes')">Conectar</button>
        </div>
        <p class="tiny muted" style="margin-top:8px">Cuando está conectada, el servidor revisa cada pocas horas: lo nuevo se vuelve tarea, si cambia una fecha se actualiza y si se acerca la entrega sube la prioridad.</p>
      </div>
      <div class="card row">
        <span class="ico"><Icon name="cap" /></span>
        <div class="grow"><div class="b small">Google Classroom</div>
          <div class="tiny muted">{{ classroomOn ? `Conectado · última revisión ${state.integrations.classroom?.lastSync ? new Date(state.integrations.classroom.lastSync).toLocaleString('es-CO') : 'nunca'}` : 'Conéctalo dándole el permiso de Classroom a tu cuenta de la U' }}</div></div>
        <button v-if="classroomOn && canUseBackend()" class="btn sm primary" :disabled="syncCr" @click="doClassroom"><Icon name="refresh" :size="14" />{{ syncCr ? 'Revisando…' : 'Revisar ahora' }}</button>
        <button v-else class="btn sm lav" @click="A.go('ajustes')">Conectar</button>
      </div>
      <p v-if="aula.some((a) => a.demo)" class="notice">🧪 Estas actividades son de ejemplo para que veas cómo funciona. Desaparecen al conectar Tu Aula o en Configuración → “Empezar en limpio”.</p>
      <div class="card"><div class="list">
        <div v-for="a in aula" :key="a.id" class="item">
          <span class="ico" :class="a.type === 'forum' ? 'cream' : a.type === 'material' ? 'mint' : 'lav'"><Icon :name="a.type === 'forum' ? 'bell' : a.type === 'material' ? 'book' : 'list'" :size="17" /></span>
          <div class="grow"><div class="title-line">{{ a.title }}</div>
            <div class="tiny muted">{{ subjOf(a.courseId)?.short || '' }} · {{ a.source === 'classroom' ? 'Classroom' : 'Tu Aula' }}{{ a.due ? ' · vence ' + relDay(a.due) : '' }}
              <span v-if="a.changed" class="badge yellow">{{ a.changeNote }}</span><span v-if="a.firstSeen === dayKey()" class="badge pink">nueva</span><span v-if="a.demo" class="badge demo">ejemplo</span></div></div>
          <a v-if="a.url" class="btn sm ghost" :href="a.url" target="_blank" rel="noopener">Abrir</a>
          <button v-if="!a.taskId && a.type !== 'forum'" class="btn sm lav" @click="A.aulaToTask(a.id)">→ Tarea</button>
          <button v-else-if="a.taskId" class="btn sm ghost" @click="ui.modal = { type: 'task', id: a.taskId }">Ver</button>
        </div>
      </div></div>
    </template>
  </div>
</template>
