<script setup>
import { computed, ref, watch } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { daily } from '../engine/game'
import { isOpen } from '../engine/planner'
import { relDay, WEEKDAYS, fmt12s, dayKey } from '../engine/time'
import { syncAula, syncClassroom, canUseBackend } from '../services/api'
import { toast, ask } from '../engine/game'
import { Icon, Pet, Ring } from '../components/ui'
import Seg from '../components/Seg.vue'
import ListBar from '../components/ListBar.vue'
import GroupCard from '../components/GroupCard.vue'
import TaskRow from '../components/TaskRow.vue'
import AulaStatus from '../components/AulaStatus.vue'
import Profes from '../components/Profes.vue'
import Contact from '../components/Contact.vue'
import Links from '../components/Links.vue'
import DriveBrowser from '../components/DriveBrowser.vue'
import { semesterFolder, subjectFolder, driveAccount, linkSubjectFolders } from '../services/api'
import { resumen, f1, tono, PASA } from '../engine/notas'

const tab = ref('cursos')
const sel = ref(ui.openSubject || null)
ui.openSubject = null
const inst = ref('todas')
const subjects = computed(() => state.subjects.filter((s) => inst.value === 'todas' || s.institution === inst.value).map((s) => {
  const ts = state.tasks.filter((t) => t.subjectId === s.id && t.status !== 'cancelada')
  return { ...s, ts, nota: resumen(ts), open: ts.filter(isOpen), p: ts.length ? Math.round(ts.filter((t) => t.status === 'completada').length / ts.length * 100) : 0 }
}))
const uniTasks = computed(() => state.tasks.filter((t) => isOpen(t) && (t.category === 'universidad' || t.subjectId)).sort((a, b) => ((a.due || 'z') > (b.due || 'z') ? 1 : -1)))
const aula = computed(() => [...state.aula].sort((a, b) => (a.firstSeen < b.firstSeen ? 1 : -1)))
const subjOf = (id) => state.subjects.find((s) => s.id === id)
const TABS = [['cursos', 'Materias', 'cap'], ['tareas', 'Tareas', 'check'], ['profes', 'Profes', 'users'], ['aula', 'Tu Aula · Classroom', 'globe']]
const INSTS = [['todas', 'Todas'], ['UT', 'U. Tolima'], ['Classroom', 'Classroom']]
// Tareas de la U agrupadas por materia, plegables como en Tareas
const uFold = computed(() => (state.settings.uniFolded ||= {}))
const uniGroups = computed(() => {
  const g = {}
  uniTasks.value.forEach((t) => { const s = subjOf(t.subjectId); const k = s ? s.id : 'none'; (g[k] ||= { key: k, label: s ? s.name : 'Sin materia', color: s?.color || '#E7E1EE', icon: s ? 'cap' : 'list', v: [] }).v.push(t) })
  return Object.values(g).sort((a, b) => (a.key === 'none') - (b.key === 'none') || a.label.localeCompare(b.label))
})
const uAllFolded = computed(() => uniGroups.value.length > 0 && uniGroups.value.every((g) => uFold.value[g.key]))
const uFoldAll = () => { const v = !uAllFolded.value; uniGroups.value.forEach((g) => (uFold.value[g.key] = v)) }
const sync = ref(false)
const aulaInt = computed(() => state.integrations.aula)
async function doSync() {
  sync.value = true
  try { await syncAula(); if (classroomOn.value) await syncClassroom() } catch (e) { toast(e.message) } finally { sync.value = false }
}
const reviewed = computed(() => daily().reviewed)
const classroomOn = computed(() => state.integrations.google.some((a) => a.services.includes('classroom')))
const syncCr = ref(false)
async function doClassroom() { syncCr.value = true; try { await syncClassroom(); state.aula = state.aula.filter((a) => !a.demo); daily().reviewed = true } catch (e) { toast(e.message) } finally { syncCr.value = false } }
const autos = computed(() => A.autoSubjects())
const reales = computed(() => state.subjects.filter((s) => !autos.value.includes(s)))
const hint = (id) => state.aula.filter((a) => a.courseId === id).slice(0, 2).map((a) => a.title).join(' · ')
const into = ref({})
function merge(s) { const t = into.value[s.id]; if (!t) return; const name = subjOf(t)?.name; A.mergeSubject(s.id, t); toast(`Unida con ${name}. Lo que llegue de ese curso irá allí`) }
const ignoredNames = computed(() => [...new Set((state.integrations.ignoredCourses || []).map((c) => c.name))])
async function ignore(s) { if (await ask(`¿Ignorar "${s.name}"? Se borran sus tareas de MuMu y no vuelven a llegar. En Tu Aula sigue todo igual.`)) { A.ignoreCourse(s.id); toast('Listo, ese curso ya no te manda tareas') } }
const showSem = ref(false)
// Une sola cada materia con su carpeta dentro de la del semestre (una vez por visita)
let linkedOnce = false
watch(() => [semesterFolder(), driveAccount()?.id], async ([f, a]) => {
  if (!f || !a || linkedOnce) return
  linkedOnce = true
  try { const n = await linkSubjectFolders(); if (n) toast(`Encontré la carpeta de ${n} materia${n === 1 ? '' : 's'} en tu Drive`) } catch { /* sin permiso aún */ }
}, { immediate: true })
const tidied = A.tidySubjects(); if (tidied) toast(`Uní ${tidied} materia${tidied === 1 ? '' : 's'} repetida${tidied === 1 ? '' : 's'}`)
const selS = computed(() => subjects.value.find((s) => s.id === sel.value))
</script>

<template>
  <div class="stack">
    <AulaStatus />
    <div v-if="!selS" class="card stack" style="gap:10px">
      <Links :target="state.settings" field="semesterLinks" title="Mi semestre" icon="book" hint="Pega aquí la carpeta de Drive del semestre: MuMu encuentra sola la carpeta de cada materia." />
      <template v-if="semesterFolder()">
        <DriveBrowser :root="semesterFolder()" :height="380" title="Drive del semestre" icon="folder" />
      </template>
    </div>
    <Seg :model-value="tab" :options="TABS" label="Secciones de la universidad" @update:model-value="tab = $event; sel = null" />

    <!-- Materia seleccionada -->
    <template v-if="selS">
      <div class="card" :style="{ borderTop: `5px solid ${selS.color}` }">
        <div class="row"><Ring :value="selS.p" :size="56" :color="selS.color" /><div class="grow"><h2>{{ selS.name }}</h2><div class="small muted">{{ selS.institution }}{{ selS.teacher ? ' · ' + selS.teacher : '' }}</div></div>
          <button class="iconbtn" aria-label="Editar materia" @click="ui.modal = { type: 'subject', id: selS.id }"><Icon name="edit" :size="18" /></button></div>
        <a v-if="selS.url" class="btn sm lav" style="margin-top:8px" :href="selS.url" target="_blank" rel="noopener"><Icon name="link" :size="14" />Abrir el curso</a>
        <div v-if="selS.teacherEmail || selS.teacherPhone" class="small row wrap" style="margin-top:8px;gap:4px 14px"><Contact v-if="selS.teacherEmail" :value="selS.teacherEmail" kind="email" as="azmejiaf@ut.edu.co" /><Contact v-if="selS.teacherPhone" :value="selS.teacherPhone" kind="phone" /></div>
        <div class="row wrap" style="gap:6px;margin-top:8px"><span v-for="(h, i) in selS.schedule" :key="i" class="badge">{{ WEEKDAYS[h.weekday] }} {{ fmt12s(h.start) }}–{{ fmt12s(h.end) }}</span></div>
        <p v-if="selS.notes" class="small" style="margin-top:8px;white-space:pre-line">{{ selS.notes }}</p>
      </div>
      <div v-if="subjectFolder(subjOf(selS.id))" class="card"><DriveBrowser :root="subjectFolder(subjOf(selS.id))" :height="420" title="Drive de la materia" icon="folder" /></div>
      <div class="card"><Links :target="subjOf(selS.id)" title="Enlaces de la materia" icon="link" /></div>
      <div v-if="selS.nota" class="card soft stack" style="gap:4px">
        <div class="row between"><h3 class="wi"><Icon name="target" :size="17" />Notas</h3><span class="badge" :class="tono(selS.nota.promedio)" style="font-size:15px">{{ f1(selS.nota.promedio) }}</span></div>
        <p class="small muted" v-if="selS.nota.evaluado != null">Llevas {{ f1(selS.nota.acumulado) }} de 5.0 con el {{ Math.round(selS.nota.evaluado) }}% calificado.
          <template v-if="selS.nota.resto > 0"> <span v-if="selS.nota.necesita <= 0">¡Ya pasaste la materia!</span><span v-else-if="selS.nota.necesita <= 5">Para pasar con {{ PASA.toFixed(1) }} necesitas sacar en promedio <b>{{ f1(selS.nota.necesita) }}</b> en el {{ Math.round(selS.nota.resto) }}% que falta.</span><span v-else>Con lo que falta ya no alcanza el 3.0; habla con el profe.</span></template></p>
        <p class="small muted" v-else>Promedio de {{ selS.nota.n }} nota{{ selS.nota.n === 1 ? '' : 's' }}. Ponle el “vale %” a cada tarea para saber cuánto te falta.</p>
        <div v-for="t in selS.ts.filter((x) => x.grade != null)" :key="t.id" class="row small between" style="padding:2px 0"><span class="grow">{{ t.title }}</span><span class="muted">{{ t.weight ? t.weight + '%' : '' }}</span><b style="width:36px;text-align:right">{{ f1(t.grade) }}</b></div>
      </div>
      <div class="card"><div class="row between"><h3>Tareas</h3><button class="link" @click="ui.modal = { type: 'task', prefill: { subjectId: selS.id, category: 'universidad', goalId: 'g1' } }">+ Tarea</button></div>
        <div class="list"><TaskRow v-for="t in selS.ts" :key="t.id" :task="t" /></div></div>
      <div class="card"><h3>Actividades detectadas</h3>
        <div v-for="a in state.aula.filter((x) => x.courseId === selS.id)" :key="a.id" class="small" style="padding:6px 0">• {{ a.title }} <span class="muted">{{ a.due ? '· ' + relDay(a.due) : '' }}</span></div></div>
      <button class="btn ghost" @click="sel = null"><Icon name="back" :size="16" />Todas las materias</button>
    </template>

    <template v-else-if="tab === 'cursos'">
      <ListBar :count="subjects.length" one="materia" :views="INSTS" v-model:view="inst" views-label="Institución" verb="Ver">
        <template #end><button class="iconbtn add" aria-label="Nueva materia" @click="ui.modal = { type: 'subject', prefill: { institution: 'UT', color: '#E8DDF5', schedule: [] } }"><Icon name="plus" /></button></template>
      </ListBar>
      <div v-if="autos.length && reales.length" class="card soft stack" style="gap:10px">
        <div><b class="small wi"><Icon name="puzzle" :size="15" />¿Cuál materia es cada una?</b><p class="tiny muted">Tu Aula y Classroom nombran los cursos con códigos. Dime a cuál de tus materias corresponde y MuMu lo recordará para siempre.</p></div>
        <div v-for="s in autos" :key="s.id" class="stack" style="gap:4px">
          <div class="small b" style="word-break:break-all">{{ s.name }}</div>
          <div v-if="hint(s.id)" class="tiny muted">Ej.: {{ hint(s.id) }}</div>
          <div class="row"><select class="input" v-model="into[s.id]" :aria-label="`Materia real de ${s.name}`"><option :value="undefined" disabled>Es…</option><option v-for="r in reales" :key="r.id" :value="r.id">{{ r.name }}</option></select><button class="btn sm primary" :disabled="!into[s.id]" @click="merge(s)">Unir</button></div>
          <button class="link tiny" style="align-self:flex-start" @click="ignore(s)"><Icon name="eyeoff" :size="13" class="inl" /> No es una materia mía (ignorar sus tareas)</button>
        </div>
      </div>
      <button v-for="s in subjects" :key="s.id" class="card row" style="text-align:left;cursor:pointer" @click="sel = s.id">
        <span style="width:6px;align-self:stretch;border-radius:4px" :style="{ background: s.color }"></span>
        <div class="grow"><div class="b small">{{ s.name }}</div><div v-if="s.teacher" class="tiny muted wi" style="gap:4px"><Icon name="user" :size="12" />{{ s.teacher }}<template v-if="s.teacherEmail"> · <Icon name="mail" :size="12" /><span class="sr">con correo</span></template></div><div class="tiny muted">{{ s.open.length }} {{ s.open.length === 1 ? 'tarea pendiente' : 'tareas pendientes' }} · {{ s.schedule.map((h) => WEEKDAYS[h.weekday]).join(', ') || 'sin horario' }}</div></div>
        <span v-if="s.nota" class="badge" :class="tono(s.nota.promedio)" :title="`Nota: ${f1(s.nota.promedio)}`"><Icon name="target" :size="12" />{{ f1(s.nota.promedio) }}</span>
        <Ring :value="s.p" :size="46" :color="s.color" />
      </button>
      <p v-if="ignoredNames.length" class="tiny muted" style="text-align:center"><Icon name="eyeoff" :size="12" class="inl" /> Ignorando: <span v-for="n in ignoredNames" :key="n">{{ n }} <button class="link tiny" @click="A.unignoreCourse(n)">volver a traer</button> </span></p>
      <div class="card pink now-card" style="min-height:130px">
        <h3 class="wi"><Icon name="cap" :size="17" />Recordatorio</h3>
        <p class="small" style="max-width:62%;margin-top:4px">Revisa tu Aula antes de tu próxima clase.</p>
        <div class="row" style="margin-top:10px;gap:6px">
          <button class="btn sm primary" @click="tab = 'aula'">Ir a Aula</button>
          <button class="btn sm ghost" :disabled="reviewed" @click="daily().reviewed = true"><Icon v-if="reviewed" name="check" :size="14" />{{ reviewed ? 'Revisado' : 'Ya revisé' }}</button>
        </div>
        <Pet pose="grad" :size="100" :bob="false" />
      </div>
    </template>

    <Profes v-else-if="tab === 'profes'" />

    <template v-else-if="tab === 'tareas'">
      <ListBar :count="uniTasks.length" one="tarea pendiente" many="tareas pendientes" :foldable="uniGroups.length > 1" :all-folded="uAllFolded" @fold="uFoldAll" />
      <GroupCard v-for="g in uniGroups" :key="g.key" :title="g.label" :icon="g.icon" :color="g.color" :count="g.v.length" :open="!uFold[g.key]" @toggle="uFold[g.key] = !uFold[g.key]">
        <div class="list"><TaskRow v-for="t in g.v" :key="t.id" :task="t" /></div>
      </GroupCard>
      <p v-if="!uniTasks.length" class="small muted" style="text-align:center">Sin tareas universitarias pendientes.</p>
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
      <p v-if="aula.some((a) => a.demo)" class="notice"><Icon name="flask" :size="14" class="inl" /> Estas actividades son de ejemplo para que veas cómo funciona. Desaparecen al conectar Tu Aula o en Configuración → “Empezar en limpio”.</p>
      <div class="card"><div class="list">
        <div v-for="a in aula" :key="a.id" class="item">
          <span class="ico" :class="a.type === 'forum' ? 'cream' : a.type === 'material' ? 'mint' : 'lav'"><Icon :name="a.type === 'forum' ? 'bell' : a.type === 'material' ? 'book' : 'list'" :size="17" /></span>
          <div class="grow"><div class="title-line">{{ a.title }}</div>
            <div class="tiny muted">{{ subjOf(a.courseId)?.short || '' }} · {{ a.source === 'classroom' ? 'Classroom' : 'Tu Aula' }}{{ a.due ? ' · vence ' + relDay(a.due) : '' }}
              <span v-if="a.changed" class="badge yellow">{{ a.changeNote }}</span><span v-if="a.firstSeen === dayKey()" class="badge pink">nueva</span><span v-if="a.demo" class="badge demo">ejemplo</span></div></div>
          <a v-if="a.url" class="btn sm ghost" :href="a.url" target="_blank" rel="noopener">Abrir</a>
          <button v-if="!a.taskId && a.type !== 'forum'" class="btn sm lav" @click="A.aulaToTask(a.id)"><Icon name="plus" :size="14" />Tarea</button>
          <button v-else-if="a.taskId" class="btn sm ghost" @click="ui.modal = { type: 'task', id: a.taskId }">Ver</button>
        </div>
      </div></div>
    </template>
  </div>
</template>
