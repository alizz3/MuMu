<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { recommend, itemsOn, isOpen, dayLoad, rankedTasks } from '../engine/planner'
import { petState, missions, claimMission, daily, streakMessage, habitStats } from '../engine/game'
import { greeting, longDate, dayKey, fmt12, fmt12s, hm, fmtDur, nowMin, relDay, daysUntil } from '../engine/time'
import { Icon, Pet, Ring } from '../components/ui'
import TaskRow from '../components/TaskRow.vue'
import { inScope } from '../engine/modoU'

const k = computed(() => dayKey(ui.now))
const pet = computed(() => petState())
const rec = computed(() => recommend())
const items = computed(() => itemsOn(k.value))
const upcoming = computed(() => items.value.filter((i) => hm(i.end) > nowMin(ui.now) && inScope('event', i)).slice(0, 4))
const open = computed(() => state.tasks.filter((t) => isOpen(t) && inScope('task', t)))
const dueSoon = computed(() => open.value.filter((t) => t.due && daysUntil(t.due) <= 3).sort((a, b) => (a.due > b.due ? 1 : -1)).slice(0, 4))
const todayCount = computed(() => open.value.filter((t) => t.due && daysUntil(t.due) <= 0).length)
const classes = computed(() => items.value.filter((i) => i.type === 'clase'))
const habitsLeft = computed(() => state.habits.filter((h) => inScope('habit', h) && !state.habitLogs[h.id]?.[k.value]?.done))
const load = computed(() => dayLoad(k.value))
const sleepToday = computed(() => state.sleep.find((s) => s.date === k.value))
const mis = computed(() => missions())
const d = computed(() => daily(k.value))
const aulaNew = computed(() => state.aula.filter((a) => a.firstSeen >= dayKey(new Date(Date.now() - 3 * 864e5)) || a.changed).slice(0, 3))
const mailImportant = computed(() => state.emails.filter((e) => e.category === 'importante' && e.status === 'nuevo' && inScope('email', e)).slice(0, 3))
const goals = computed(() => state.goals.filter((g) => inScope('goal', g)).slice(0, 4).map((g) => ({ ...g, p: A.goalProgress(g) })))
const principle = computed(() => rec.value.principle || state.principles.find((p) => p.status === 'probando') || state.principles[0])
const activeExp = computed(() => state.experiments.find((x) => x.status === 'activo'))
const priorityTask = computed(() => state.tasks.find((t) => t.id === d.value.priority))
const pickPriority = ref(false)

function startNow() {
  const r = rec.value
  if (r.kind === 'rest') return A.go('rutinas')
  if (r.kind === 'life') return A.go('vida')
  A.startFocus({ taskId: r.task?.id, minutes: r.minutes || 25, mode: r.kind === 'micro' ? 'empezar' : 'pomodoro' })
  A.go('enfoque')
}
function setPriority(t) { d.value.priority = t.id; A.intendTask(t.id); pickPriority.value = false }
const welcome = () => { d.value.welcomed = true }
</script>

<template>
  <div class="stack">
    <!-- Saludo + vaquita -->
    <section class="cols">
      <div class="stack">
        <div>
          <div class="hero-greet">{{ greeting(ui.now) }}, {{ state.settings.ownerName }}! <span aria-hidden="true">{{ ui.now.getHours() < 18 ? '☀️' : '🌙' }}</span></div>
          <div class="muted">{{ longDate(ui.now) }} · {{ fmt12(nowMin(ui.now)) }}</div>
        </div>
        <div class="row" style="align-items:center">
          <div class="speech grow" @click="welcome">{{ pet.msg }}</div>
          <Pet :pose="pet.pose" :size="130" />
        </div>
      </div>

      <!-- ¿Qué hago ahora? -->
      <div class="card pink now-card" style="min-height:190px">
        <div class="tiny b" style="color:var(--pink-700);letter-spacing:.06em">¿QUÉ DEBERÍA HACER AHORA?</div>
        <h2 style="margin:6px 0 6px;font-size:18px;max-width:80%">{{ rec.title }}</h2>
        <p class="small" style="max-width:74%">{{ rec.reason }}</p>
        <p v-if="rec.principle" class="tiny muted" style="margin-top:6px;max-width:74%">💡 {{ rec.principle.author }} · “{{ rec.principle.text }}”</p>
        <div class="row" style="margin-top:14px;gap:8px">
          <button class="btn primary big" @click="startNow"><Icon name="play" :size="18" />EMPEZAR</button>
          <button class="btn ghost sm" @click="ui.assistantOpen = true">Otras opciones</button>
        </div>
        <Pet :pose="rec.pose" :size="110" :bob="false" />
      </div>
    </section>

    <!-- Resumen del día -->
    <section class="card">
      <div class="row between"><h3>Tu resumen del día</h3><button class="link" @click="A.go('agenda')">Ver agenda</button></div>
      <div class="grid4" style="margin-top:10px">
        <div class="kpi"><b>{{ todayCount }}</b><span>pendientes hoy</span></div>
        <div class="kpi"><b>{{ classes.length }}</b><span>{{ classes.length === 1 ? 'clase hoy' : 'clases hoy' }}</span></div>
        <div class="kpi"><b>{{ habitsLeft.length }}</b><span>hábitos por hacer</span></div>
        <div class="kpi"><b>{{ fmtDur(rec.ctx.freeToday) }}</b><span>tiempo libre</span></div>
      </div>
      <div class="row wrap small muted" style="margin-top:12px;gap:14px">
        <span v-if="sleepToday">😴 Dormiste {{ fmtDur(sleepToday.minutes) }} · despertaste {{ fmt12s(sleepToday.wake) }}</span>
        <button v-else class="link" style="padding:0" @click="A.go('sueno')">😴 ¿Cómo dormiste? Regístralo</button>
        <span>📚 Estudio {{ fmtDur(load.study) }}</span><span>💻 Trabajo {{ fmtDur(load.work) }}</span>
      </div>
      <p class="tiny muted" style="margin-top:8px">{{ streakMessage() }}</p>
    </section>

    <div class="cols">
      <div class="stack">
        <!-- Prioridad del día -->
        <section class="card soft">
          <div class="row between"><h3>⭐ Mi prioridad de hoy</h3><button class="link" @click="pickPriority = !pickPriority">{{ priorityTask ? 'Cambiar' : 'Elegir' }}</button></div>
          <p v-if="priorityTask && !pickPriority" class="small" style="margin-top:6px"><b>{{ priorityTask.title }}</b> <span class="muted">· {{ priorityTask.due ? relDay(priorityTask.due) : 'sin fecha' }}</span></p>
          <p v-else-if="!pickPriority" class="small muted" style="margin-top:6px">Elige UNA cosa que haría que hoy valga la pena.</p>
          <div v-if="pickPriority" class="stack" style="gap:6px;margin-top:8px">
            <button v-for="r in rankedTasks().slice(0, 5)" :key="r.t.id" class="btn ghost sm" style="justify-content:flex-start" @click="setPriority(r.t)">{{ r.t.title }}</button>
          </div>
        </section>

        <!-- Lo próximo -->
        <section class="card">
          <div class="row between"><h3>Lo próximo</h3><button class="link" @click="ui.modal = { type: 'event' }">+ Evento</button></div>
          <div class="list" style="margin-top:4px">
            <div v-for="i in upcoming" :key="i.id" class="item">
              <span class="ico" :class="{ lav: i.type === 'clase', mint: i.type === 'familia' || i.type === 'vida', cream: i.type === 'bloque' }"><Icon :name="i.type === 'clase' ? 'cap' : i.type === 'bloque' ? 'timer' : i.type === 'familia' || i.type === 'vida' ? 'heart' : 'calendar'" :size="18" /></span>
              <div class="grow"><div class="title-line">{{ i.title }}</div><div class="tiny muted">{{ fmt12s(i.start) }} – {{ fmt12s(i.end) }}</div></div>
            </div>
            <p v-if="!upcoming.length" class="small muted" style="padding:8px 0">No tienes más eventos hoy. Tiempo para ti 🤍</p>
          </div>
        </section>

        <!-- Vencimientos -->
        <section class="card">
          <div class="row between"><h3>Próximos vencimientos</h3><button class="link" @click="A.go('tareas')">Todas</button></div>
          <div class="list"><TaskRow v-for="t in dueSoon" :key="t.id" :task="t" compact /></div>
          <p v-if="!dueSoon.length" class="small muted" style="padding:8px 0">Nada vence en 3 días ✨</p>
        </section>

        <!-- Universidad + correo -->
        <section class="card">
          <div class="row between"><h3>🎓 Universidad y correo</h3><button class="link" @click="A.go('universidad')">Abrir</button></div>
          <div class="list">
            <div v-for="a in aulaNew" :key="a.id" class="item">
              <span class="ico lav"><Icon name="cap" :size="18" /></span>
              <div class="grow"><div class="title-line">{{ a.title }}</div><div class="tiny muted">{{ a.changed ? a.changeNote : 'Nueva en ' + (a.source === 'classroom' ? 'Classroom' : 'Tu Aula') }} <span v-if="a.demo" class="badge demo">ejemplo</span></div></div>
            </div>
            <button v-for="e in mailImportant" :key="e.id" class="item" style="all:unset;display:flex;gap:12px;align-items:center;padding:11px 2px;cursor:pointer" @click="A.go('correo')">
              <span class="ico"><Icon name="mail" :size="18" /></span>
              <div class="grow"><div class="title-line">{{ e.subject }}</div><div class="tiny muted">{{ e.from }} <span v-if="e.demo" class="badge demo">ejemplo</span></div></div>
            </button>
          </div>
        </section>
      </div>

      <div class="stack">
        <!-- Hábitos hoy -->
        <section class="card">
          <div class="row between"><h3>Hábitos de hoy</h3><button class="link" @click="A.go('habitos')">Ver semana</button></div>
          <div class="list">
            <div v-for="h in state.habits.filter((x) => inScope('habit', x))" :key="h.id" class="item">
              <button class="check" :class="{ on: state.habitLogs[h.id]?.[k]?.done }" :aria-label="`Marcar ${h.name}`" @click="A.toggleHabit(h.id)"><Icon v-if="state.habitLogs[h.id]?.[k]?.done" name="check" :size="15" :stroke="3" /></button>
              <div class="grow"><div class="title-line">{{ h.emoji }} {{ h.name }}</div><div class="tiny muted">{{ habitStats(h).weekDone }} de los últimos 7 días</div></div>
            </div>
          </div>
        </section>

        <!-- Objetivos -->
        <section class="card">
          <div class="row between"><h3>Progreso de objetivos</h3><button class="link" @click="A.go('objetivos')">Ver</button></div>
          <div class="grid2" style="margin-top:10px">
            <button v-for="g in goals" :key="g.id" class="row card tight" style="text-align:left;box-shadow:none" @click="A.go('objetivos')">
              <Ring :value="g.p" :size="46" :label="g.name" />
              <span class="small" style="line-height:1.25">{{ g.emoji }} {{ g.name }}</span>
            </button>
          </div>
        </section>

        <!-- Misiones -->
        <section class="card">
          <h3>Misiones de hoy</h3>
          <div v-for="mi in mis" :key="mi.id" style="margin-top:10px">
            <div class="row between small"><span class="b">{{ mi.emoji }} {{ mi.title }}</span><span class="muted">{{ mi.progress }}/{{ mi.steps.length }} · 🪙{{ mi.reward }}</span></div>
            <div class="bar" style="margin:6px 0"><i :style="{ width: (mi.progress / mi.steps.length * 100) + '%', background: 'var(--lav-500)' }"></i></div>
            <div class="row wrap" style="gap:4px">
              <button v-for="s in mi.steps" :key="s.t" class="chip" :class="{ on: s.done }" @click="A.go(s.go)">{{ s.done ? '✓ ' : '' }}{{ s.t }}</button>
            </div>
            <button v-if="mi.complete && !mi.claimed" class="btn sm primary" style="margin-top:8px" @click="claimMission(mi)">🎁 Reclamar recompensa</button>
          </div>
        </section>

        <!-- Recomendación de lo que aprendo -->
        <section v-if="principle" class="card soft now-card" style="min-height:150px">
          <div class="tiny b muted">RECOMENDACIÓN PARA TI 💡</div>
          <h3 style="margin:4px 0;max-width:70%">{{ principle.text }}</h3>
          <p class="small muted" style="max-width:68%">{{ principle.author }} · {{ principle.action }}</p>
          <div class="row" style="margin-top:10px;gap:6px">
            <button v-if="activeExp && activeExp.principleId === principle.id" class="btn sm lav" @click="A.go('experimentos')">🧪 Registrar experimento</button>
            <button v-else class="btn sm lav" @click="A.startExperiment(principle.id); A.go('experimentos')">Probarlo 7 días</button>
          </div>
          <Pet pose="read" :size="96" :bob="false" />
        </section>

        <!-- Intención con el celular -->
        <section class="card row">
          <span class="ico cream" style="font-size:20px">📱</span>
          <div class="grow"><div class="small b">Hey {{ state.settings.ownerName }} 💗 ¿Qué venías a hacer?</div><div class="tiny muted">Registra tu intención antes de abrir otra app</div></div>
          <button class="btn sm lav" @click="A.go('celular')">Registrar</button>
        </section>

        <!-- Energía de la vaquita -->
        <section class="card row" style="cursor:pointer" @click="A.go('casa')">
          <div class="grow">
            <h3>Energía de la vaquita</h3>
            <div style="font-size:22px;margin:6px 0;letter-spacing:2px" :aria-label="`${pet.hearts} de 5 corazones`">{{ '💗'.repeat(pet.hearts) }}{{ '🤍'.repeat(5 - pet.hearts) }}</div>
            <div class="tiny muted">🪙 {{ state.game.coins }} monedas · toca para ir a la casita</div>
          </div>
          <Pet kind="negra" :pose="pet.negra" :size="64" :bob="false" /><Pet kind="leo" :pose="pet.leo" :size="64" :bob="false" />
        </section>
      </div>
    </div>
  </div>
</template>
