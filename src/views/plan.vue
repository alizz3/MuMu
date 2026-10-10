<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { Icon } from '../components/ui'
import Seg from '../components/Seg.vue'
import GroupCard from '../components/GroupCard.vue'
import { uniPlan, uniTimes, BAG, computePlan, connectPhone } from '../services/device'
import { dayKey, addDays, parseDay, hm, toHM, fmt12, longDate, relDay } from '../engine/time'
import { toast } from '../engine/game'

const p = uniPlan()
// Próximo día de U (hoy si aún no ha terminado)
const nextU = computed(() => {
  void ui.now
  for (let i = 0; i < 21; i++) {
    const k = dayKey(addDays(new Date(), i)), u = uniTimes(k)
    if (u && (i > 0 || u.home > ui.now.getHours() * 60 + ui.now.getMinutes())) return { k, ...u }
  }
  return null
})
const eve = computed(() => nextU.value && dayKey(addDays(parseDay(nextU.value.k), -1)))
const leaveFor = computed({
  get: () => (nextU.value && (p.overrides[nextU.value.k]?.leave || p.leave)) || p.leave,
  set: (v) => { if (nextU.value) p.overrides[nextU.value.k] = { leave: v } },
})
const custom = computed(() => nextU.value && p.overrides[nextU.value.k])
const steps = computed(() => {
  const u = nextU.value; if (!u) return []
  const out = [
    { at: u.bed, t: 'Acuéstate', s: `la noche antes, para dormir ${p.sleepH} h`, icon: 'moon', eve: true },
    { at: u.wake, t: 'Levántate', s: 'alarma con tu canción · sin negociar', icon: 'alarm' },
    { at: u.leave, t: 'Sal de la casa', s: `${p.getReady} min para alistarte`, icon: 'door' },
  ]
  u.cls.forEach((c, i) => {
    out.push({ at: hm(c.start), end: hm(c.end), t: c.title, s: c.location || '', icon: 'cap' })
    const n = u.cls[i + 1]; if (n && hm(n.start) - hm(c.end) >= 45) out.push({ at: hm(c.end), end: hm(n.start), t: 'Almuerzo', s: 'come algo y toma agua', icon: 'coffee' })
  })
  out.push({ at: u.home, t: 'Llegas a la casa', s: `~${p.commute} min de trayecto`, icon: 'home' })
  return out
})

// Maleta de la noche anterior
const bag = computed(() => { const k = nextU.value?.k; if (!k) return {}; if (!p.bag[k]) p.bag[k] = {}; return p.bag[k] })
const bagDone = computed(() => BAG.filter(([id]) => bag.value[id]).length)
function toggleBag(id) { bag.value[id] = !bag.value[id]; if (bagDone.value === BAG.length) toast('¡Maleta lista! Mañana sales tranquila.') }

const INT = [['suave', 'Suave', 'leaf'], ['normal', 'Normal', 'bell'], ['intensa', 'Intensa', 'bolt']]
const preview = computed(() => { void state.tasks; void p; return computePlan().plan.slice(0, 12) })
const fmtAt = (t) => { const d = new Date(t); return `${relDay(dayKey(d))} · ${fmt12(d.getHours() * 60 + d.getMinutes())}` }
if (!state.settings.planOpen) state.settings.planOpen = { ajustes: false, celular: true, prox: false }
const open = computed(() => state.settings.planOpen)

// Casa (para el aviso al llegar)
const home = computed(() => state.settings.home)
const locating = ref(false)
function setHome() {
  if (!navigator.geolocation) return toast('Este navegador no da la ubicación')
  locating.value = true
  navigator.geolocation.getCurrentPosition((pos) => {
    state.settings.home = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5), r: 150 }
    locating.value = false; toast('Listo: esta es tu casa')
  }, () => { locating.value = false; toast('No pude leer la ubicación. Revisa el permiso.') }, { enableHighAccuracy: true, timeout: 15000 })
}
const linked = computed(() => state.settings.phoneLinkedAt)
const isAndroid = /android/i.test(navigator.userAgent)
</script>

<template>
  <div class="stack">
    <!-- Próximo día de U -->
    <section v-if="nextU" class="card stack" style="gap:10px">
      <div class="row" style="gap:10px">
        <span class="gico" style="background:color-mix(in srgb,#C3B3D4 40%,var(--surface))"><Icon name="cap" :size="18" /></span>
        <div class="grow"><div class="tiny muted">Próximo día de universidad</div><h3 style="margin:0">{{ relDay(nextU.k)[0].toUpperCase() + relDay(nextU.k).slice(1) }} · {{ longDate(parseDay(nextU.k)) }}</h3></div>
      </div>
      <label class="row small leave">
        <Icon name="door" :size="16" /><span class="grow">Ese día sales a las</span>
        <input type="time" class="input" v-model="leaveFor" aria-label="Hora de salida ese día" />
      </label>
      <button v-if="custom" class="link tiny" style="align-self:flex-start" @click="delete p.overrides[nextU.k]">Volver a la hora normal ({{ fmt12(hm(p.leave)) }})</button>
      <ol class="tline">
        <li v-for="(s, i) in steps" :key="i" :class="{ eve: s.eve }">
          <span class="tl-dot"><Icon :name="s.icon" :size="14" /></span>
          <span class="tl-h">{{ fmt12(s.at) }}</span>
          <div class="grow"><div class="small b">{{ s.t }}</div><div v-if="s.s || s.end" class="tiny muted">{{ s.end ? `hasta ${fmt12(s.end)}` : '' }}{{ s.end && s.s ? ' · ' : '' }}{{ s.s }}</div></div>
        </li>
      </ol>
    </section>
    <section v-else class="card small muted">No encontré clases en las próximas 3 semanas. Cuando sincronices el calendario de la U aparecen aquí solas.</section>

    <!-- Maleta -->
    <GroupCard v-if="nextU" title="Alista tu maleta" :sub="`La noche antes (${relDay(eve)}) · ${bagDone}/${BAG.length}`" icon="bag" color="#F7B6C2" :count="null" :open="state.settings.bagOpen !== false" @toggle="state.settings.bagOpen = state.settings.bagOpen === false">
      <div class="bar" style="margin:8px 0"><i :style="{ width: (bagDone / BAG.length) * 100 + '%' }"></i></div>
      <button v-for="[id, txt, ic] in BAG" :key="id" class="bag-it" :class="{ on: bag[id] }" @click="toggleBag(id)">
        <span class="check" :class="{ on: bag[id] }"><Icon v-if="bag[id]" name="check" :size="14" :stroke="3" /></span>
        <Icon :name="ic" :size="16" class="muted" /><span class="grow small">{{ txt }}</span>
      </button>
      <p class="tiny muted" style="margin:8px 0 0">Tip de Brian Tracy: lo que preparas la noche anterior es tiempo que le ganas a la mañana. Te aviso a las {{ fmt12(hm(p.bagAt)) }}.</p>
    </GroupCard>

    <!-- Celular -->
    <GroupCard title="Alarmas y avisos en el celular" :sub="linked ? 'App enlazada' : 'Falta enlazar la app'" icon="alarm" color="#FFE29A" :open="open.celular" @toggle="open.celular = !open.celular">
      <div class="stack" style="gap:8px;margin-top:8px">
        <p class="tiny muted" style="margin:0">La app de MuMu suena con tu canción, te avisa cuándo salir, la maleta, las tareas que vencen y te muestra el widget, aunque no la abras.</p>
        <div class="row wrap" style="gap:6px">
          <button class="btn sm primary" @click="connectPhone"><Icon name="phone" :size="15" />{{ linked ? 'Volver a enlazar' : 'Enlazar este celular' }}</button>
          <a class="btn sm lav" href="mumu://permisos"><Icon name="bell" :size="15" />Permitir notificaciones y alarmas</a>
        </div>
        <p v-if="!isAndroid" class="tiny muted" style="margin:0">Hazlo desde la app de MuMu en tu celular.</p>
        <div class="row wrap" style="gap:6px;align-items:center">
          <button class="btn sm ghost" :disabled="locating" @click="setHome"><Icon name="home" :size="15" />{{ home ? 'Actualizar mi casa' : 'Estoy en mi casa: guardar ubicación' }}</button>
          <a v-if="home" class="btn sm ghost" href="mumu://ubicacion"><Icon name="pin" :size="15" />Avisarme al llegar</a>
        </div>
        <p v-if="home" class="tiny muted" style="margin:0">Cuando llegues a la casa te pregunto qué hacemos por tu vida. Necesita la ubicación "Permitir todo el tiempo".</p>
      </div>
    </GroupCard>

    <!-- Ajustes -->
    <GroupCard title="Tus horarios" sub="Salida, sueño, alarma diaria e intensidad" icon="settings" color="#C3B3D4" :open="open.ajustes" @toggle="open.ajustes = !open.ajustes">
      <div class="stack" style="gap:10px;margin-top:8px">
        <label class="row small"><span class="grow">Hora normal de salida (días de U)</span><input type="time" class="input w" v-model="p.leave" /></label>
        <label class="row small"><span class="grow">Minutos para alistarte</span><input type="number" min="15" max="180" step="5" class="input w" v-model.number="p.getReady" /></label>
        <label class="row small"><span class="grow">Trayecto U → casa (min)</span><input type="number" min="5" max="180" step="5" class="input w" v-model.number="p.commute" /></label>
        <label class="row small"><span class="grow">Horas de sueño</span><input type="number" min="5" max="10" step="0.5" class="input w" v-model.number="p.sleepH" /></label>
        <label class="row small"><span class="grow">Recordarme la maleta a las</span><input type="time" class="input w" v-model="p.bagAt" /></label>
        <label class="row small"><input type="checkbox" v-model="p.wakeOn" /><span class="grow">Alarma todos los días a las</span><input type="time" class="input w" v-model="p.wake" :disabled="!p.wakeOn" /></label>
        <div class="tiny muted">¿Qué tan intensa quieres que sea?</div>
        <Seg v-model="p.intensidad" :options="INT" label="Intensidad de los recordatorios" />
        <p class="tiny muted" style="margin:0">{{ { suave: 'Solo alarmas, salir y lo que vence hoy.', normal: 'También lo que vence mañana, hábitos que faltan y hora de dormir.', intensa: 'Todo lo anterior y un "¿cómo vas?" al mediodía.' }[p.intensidad] }}</p>
      </div>
    </GroupCard>

    <!-- Próximos avisos -->
    <GroupCard title="Lo que va a sonar" :sub="`${preview.length} próximos avisos`" icon="bell" color="#B9DCCB" :open="open.prox" @toggle="open.prox = !open.prox">
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
.leave { gap: 8px; align-items: center; background: var(--surface-3); border-radius: 12px; padding: 6px 6px 6px 12px; }
.leave .input, .w { width: auto; max-width: 130px; padding: 6px 8px; }
.tline { list-style: none; margin: 0; padding: 0; position: relative; }
.tline::before { content: ''; position: absolute; left: 14px; top: 10px; bottom: 10px; width: 2px; background: var(--line); }
.tline li { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; position: relative; }
.tline li.eve { opacity: .8; }
.tl-dot { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--surface-3); color: var(--pink-700); position: relative; z-index: 1; }
.tl-h { width: 66px; flex: none; font-variant-numeric: tabular-nums; font-size: 12.5px; font-weight: 600; padding-top: 6px; }
.tline .grow { padding-top: 4px; min-width: 0; overflow-wrap: anywhere; }
.bag-it { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; padding: 8px 0; cursor: pointer; border-top: 1px solid var(--line); }
.bag-it.on .small { text-decoration: line-through; opacity: .6; }
.bar { height: 6px; border-radius: 6px; background: var(--surface-3); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--pink-300); transition: width .3s; }
</style>
