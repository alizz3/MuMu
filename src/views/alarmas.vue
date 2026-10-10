<script setup>
import { computed, ref } from 'vue'
import { state } from '../store'
import { Icon } from '../components/ui'
import Seg from '../components/Seg.vue'
import GroupCard from '../components/GroupCard.vue'
import { alarms, uniPlan, computePlan, connectPhone } from '../services/device'
import { dayKey, hm, fmt12, relDay } from '../engine/time'
import { toast } from '../engine/game'

const list = computed(() => alarms())
const p = uniPlan()
const DIAS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']]
const diasTxt = (d) => d.length === 7 ? 'Todos los días' : d.length === 0 ? 'Una sola vez no: elige días' : [1, 2, 3, 4, 5].every((x) => d.includes(x)) && d.length === 5 ? 'Lunes a viernes' : DIAS.filter(([n]) => d.includes(n)).map(([, l]) => l).join(' ')
const editing = ref(null)
function add() {
  const a = { id: 'a' + Date.now().toString(36), at: '07:00', days: [1, 2, 3, 4, 5], on: true, label: 'Alarma', wake: false }
  list.value.push(a); editing.value = a.id
}
function toggleDay(a, n) { const i = a.days.indexOf(n); if (i >= 0) a.days.splice(i, 1); else a.days.push(n) }
function remove(a) { const i = list.value.indexOf(a); if (i >= 0) list.value.splice(i, 1) }

const INT = [['suave', 'Suave', 'leaf'], ['normal', 'Normal', 'bell'], ['intensa', 'Intensa', 'bolt']]
if (!state.settings.alarmOpen) state.settings.alarmOpen = { cel: true, rec: false, prox: false }
const open = computed(() => state.settings.alarmOpen)
const preview = computed(() => { void state.tasks; void p; void list.value; return computePlan().plan.slice(0, 12) })
const fmtAt = (t) => { const d = new Date(t); return `${relDay(dayKey(d))} · ${fmt12(d.getHours() * 60 + d.getMinutes())}` }
const linked = computed(() => state.settings.phoneLinkedAt)

const locating = ref(false)
function setHome() {
  if (!navigator.geolocation) return toast('Este navegador no da la ubicación')
  locating.value = true
  navigator.geolocation.getCurrentPosition((pos) => {
    state.settings.home = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5), r: 150 }
    locating.value = false; toast('Listo: esta es tu casa')
  }, () => { locating.value = false; toast('No pude leer la ubicación. Revisa el permiso.') }, { enableHighAccuracy: true, timeout: 15000 })
}
</script>

<template>
  <div class="stack">
    <!-- Alarmas -->
    <div class="row between"><span class="small muted">{{ list.length }} {{ list.length === 1 ? 'alarma' : 'alarmas' }}</span>
      <button class="iconbtn add" aria-label="Nueva alarma" @click="add"><Icon name="plus" /></button></div>
    <div v-for="a in list" :key="a.id" class="card al" :class="{ off: !a.on }">
      <div class="row" style="gap:10px">
        <button class="grow al-main" @click="editing = editing === a.id ? null : a.id">
          <div class="al-h">{{ fmt12(hm(a.at)) }}</div>
          <div class="tiny muted">{{ a.label || 'Alarma' }} · {{ diasTxt(a.days) }}</div>
        </button>
        <label class="sw" :aria-label="a.on ? 'Apagar alarma' : 'Prender alarma'"><input type="checkbox" v-model="a.on" /><i></i></label>
      </div>
      <div v-if="editing === a.id" class="stack" style="gap:8px;margin-top:10px">
        <div class="row" style="gap:8px"><input type="time" class="input" v-model="a.at" aria-label="Hora" style="max-width:140px" /><input class="input grow" v-model="a.label" placeholder="Nombre" aria-label="Nombre de la alarma" /></div>
        <div class="dias"><button v-for="[n, l] in DIAS" :key="n" class="dia" :class="{ on: a.days.includes(n) }" :aria-pressed="a.days.includes(n)" @click="toggleDay(a, n)">{{ l }}</button></div>
        <label class="row small" style="gap:8px"><input type="checkbox" v-model="a.wake" />Es para despertar (frase para levantarte; en días de U la reemplaza la alarma de la U)</label>
        <div class="row between"><button class="btn sm ghost" @click="remove(a)"><Icon name="trash" :size="14" />Eliminar</button><button class="btn sm lav" @click="editing = null">Listo</button></div>
      </div>
    </div>

    <!-- Días de U -->
    <div class="card stack" style="gap:8px">
      <div class="small b wi"><Icon name="cap" :size="15" />Días de universidad</div>
      <label class="row small" style="gap:8px"><input type="checkbox" :checked="p.uniWakeOn !== false" @change="p.uniWakeOn = $event.target.checked" /><span class="grow">Despertarme según la hora de salida ({{ p.getReady }} min antes)</span></label>
      <label class="row small" style="gap:8px"><input type="checkbox" :checked="p.leaveOn !== false" @change="p.leaveOn = $event.target.checked" /><span class="grow">Alarma de "¡Hora de salir!" ({{ fmt12(hm(p.leave)) }})</span></label>
      <p class="tiny muted" style="margin:0">La hora de salida y la rutina de la noche anterior están en Rutinas → Universidad.</p>
    </div>

    <!-- Recordatorios -->
    <GroupCard title="Recordatorios" :sub="{ suave: 'Suave', normal: 'Normal', intensa: 'Intensa' }[p.intensidad]" icon="bell" color="#B9DCCB" :open="open.rec" @toggle="open.rec = !open.rec">
      <div class="stack" style="gap:8px;margin-top:8px">
        <Seg v-model="p.intensidad" :options="INT" label="Intensidad de los recordatorios" />
        <p class="tiny muted" style="margin:0">{{ { suave: 'Solo alarmas, hora de salir y lo que vence hoy.', normal: 'También lo que vence mañana, hábitos que faltan y hora de dormir.', intensa: 'Todo lo anterior y un "¿cómo vas?" al mediodía.' }[p.intensidad] }}</p>
      </div>
    </GroupCard>

    <!-- Celular -->
    <GroupCard title="En tu celular" :sub="linked ? 'App enlazada' : 'Falta enlazar la app'" icon="phone" color="#FFE29A" :open="open.cel" @toggle="open.cel = !open.cel">
      <div class="stack" style="gap:8px;margin-top:8px">
        <p class="tiny muted" style="margin:0">Para que suenen con tu canción y lleguen los avisos aunque MuMu esté cerrada. Hazlo desde la app de MuMu en tu celular.</p>
        <div class="row wrap" style="gap:6px">
          <button class="btn sm primary" @click="connectPhone"><Icon name="phone" :size="15" />{{ linked ? 'Volver a enlazar' : 'Enlazar este celular' }}</button>
          <a class="btn sm lav" href="mumu://permisos"><Icon name="bell" :size="15" />Permitir notificaciones y alarmas</a>
        </div>
        <div class="small b wi" style="margin-top:6px"><Icon name="home" :size="15" />Aviso al llegar a casa</div>
        <div class="row wrap" style="gap:6px">
          <button class="btn sm ghost" :disabled="locating" @click="setHome">{{ state.settings.home ? 'Actualizar ubicación de mi casa' : 'Estoy en mi casa: guardar ubicación' }}</button>
          <a v-if="state.settings.home" class="btn sm ghost" href="mumu://ubicacion">Activar aviso</a>
        </div>
      </div>
    </GroupCard>

    <!-- Próximos -->
    <GroupCard title="Lo que va a sonar" :sub="`${preview.length} próximos`" icon="clock" color="#C3B3D4" :open="open.prox" @toggle="open.prox = !open.prox">
      <div class="list" style="margin-top:6px">
        <div v-for="x in preview" :key="x.id" class="row small" style="gap:10px;padding:6px 0">
          <Icon :name="x.kind === 'alarm' ? 'alarm' : 'bell'" :size="16" :class="x.kind === 'alarm' ? '' : 'muted'" />
          <div class="grow"><div class="b">{{ x.title }}</div><div class="tiny muted">{{ fmtAt(x.at) }}</div></div>
        </div>
        <p v-if="!preview.length" class="tiny muted">Nada programado todavía.</p>
      </div>
    </GroupCard>
  </div>
</template>

<style scoped>
.al { padding: 14px 16px; }
.al.off .al-h, .al.off .tiny { opacity: .5; }
.al-main { border: 0; background: transparent; color: inherit; font: inherit; text-align: left; padding: 0; cursor: pointer; min-width: 0; }
.al-h { font-size: 34px; font-weight: 600; line-height: 1.1; font-variant-numeric: tabular-nums; }
.sw { position: relative; width: 48px; height: 28px; flex: none; cursor: pointer; }
.sw input { position: absolute; opacity: 0; inset: 0; }
.sw i { position: absolute; inset: 0; border-radius: 20px; background: var(--surface-3); transition: background .2s; }
.sw i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s; }
.sw input:checked + i { background: var(--pink-300); }
.sw input:checked + i::after { transform: translateX(20px); }
.sw input:focus-visible + i { outline: 2px solid var(--pink-700); outline-offset: 2px; }
.dias { display: flex; gap: 6px; flex-wrap: wrap; }
.dia { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: transparent; color: var(--ink-2); font: inherit; font-weight: 600; cursor: pointer; }
.dia.on { background: var(--pink-300); border-color: var(--pink-300); color: #fff; }
</style>
