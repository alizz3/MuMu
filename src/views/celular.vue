<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { APPS, parseMin, showMin, socialMinutes } from '../engine/screen'
import { state } from '../store'
import * as A from '../store/actions'
import { insights } from '../engine/insights'
import { dayKey, fmtDur, keyPlus, WEEKDAYS, parseDay } from '../engine/time'
import { Pet, Chip, Icon } from '../components/ui'

const REASONS = [['estudiar', '📚 Estudiar'], ['trabajar', '💻 Trabajar'], ['buscar', '🔎 Buscar info'], ['hablar', '💬 Hablar con alguien'], ['aburrimiento', '🥱 Aburrimiento'], ['evitar', '🙈 Evitar una tarea'], ['ansiedad', '😟 Ansiedad'], ['automatico', '🤖 Automático']]
const want = ref(''), mins = ref(10), reason = ref('estudiar')
const pending = computed(() => state.intentions.find((i) => !i.result && i.date === dayKey()))
const endedIn = ref('TikTok')
function go() { if (!want.value.trim() && !['aburrimiento', 'automatico', 'ansiedad'].includes(reason.value)) return; A.addIntention(want.value.trim() || REASONS.find((r) => r[0] === reason.value)[1], mins.value, reason.value); want.value = '' }

// Tiempo de pantalla: se copia de Bienestar digital (una web no puede leerlo sola). Acepta "2 h 40 min", "2h40" o "160".
const scDate = ref(dayKey())
const sc = reactive({ total: '', notif: '', apps: {}, extra: [] })
function loadScreen() {
  const e = state.screen.find((s) => s.date === scDate.value)
  sc.total = showMin(e?.total || 0); sc.notif = e?.notifications || ''
  sc.apps = Object.fromEntries(APPS.map(([k]) => [k, showMin(e?.apps?.[k] || 0)]))
  sc.extra = Object.entries(e?.apps || {}).filter(([k]) => !APPS.some((a) => a[0] === k) && k !== 'otras').map(([k, v]) => ({ name: e.names?.[k] || k, min: showMin(v) }))
}
watch(scDate, loadScreen, { immediate: true })
const appSum = computed(() => APPS.reduce((a, [k]) => a + parseMin(sc.apps[k]), 0) + sc.extra.reduce((a, x) => a + parseMin(x.min), 0))
function saveScreen() {
  const apps = {}, names = {}
  APPS.forEach(([k]) => { const m = parseMin(sc.apps[k]); if (m) apps[k] = m })
  sc.extra.forEach((x) => { const k = x.name.trim().toLowerCase().replace(/\s+/g, '-'); const m = parseMin(x.min); if (k && m) { apps[k] = m; names[k] = x.name.trim() } })
  const total = parseMin(sc.total) || appSum.value
  A.logScreen({ date: scDate.value, total, notifications: Number(sc.notif) || null, apps, names })
}
const daysBack = computed(() => Array.from({ length: 7 }, (_, i) => keyPlus(-i)))
const week = computed(() => Array.from({ length: 7 }, (_, i) => { const k = keyPlus(-6 + i); const s = state.screen.find((x) => x.date === k); return { k, social: socialMinutes(s), total: s?.total || 0 } }))
const max = computed(() => Math.max(60, ...week.value.map((w) => w.total)))
const stats = computed(() => {
  const it = state.intentions.filter((i) => i.result)
  const by = {}; state.intentions.forEach((i) => (by[i.reason] = (by[i.reason] || 0) + 1))
  return { total: it.length, ok: it.filter((i) => i.result === 'logrado').length, by: Object.entries(by).sort((a, b) => b[1] - a[1]) }
})
const ins = computed(() => insights().filter((i) => ['phone', 'screen-focus'].includes(i.id)))
</script>

<template>
  <div class="stack">
    <div class="card pink">
      <div class="row"><Pet pose="think" :size="80" /><div class="grow"><h2 style="font-size:17px">Hey {{ state.settings.ownerName }} 💗 ¿Qué venías a hacer?</h2><p class="tiny muted">Antes de abrir otra app, dime tu intención. Después te pregunto si lo lograste.</p></div></div>
      <template v-if="!pending">
        <input class="input" v-model="want" placeholder="Ej: Revisar Aula" style="margin-top:10px" aria-label="Intención" />
        <div class="chips" style="margin-top:8px"><Chip v-for="r in REASONS" :key="r[0]" :active="reason === r[0]" @click="reason = r[0]">{{ r[1] }}</Chip></div>
        <div class="row" style="margin-top:8px"><div class="chips grow"><Chip v-for="m in [5, 10, 15, 30]" :key="m" :active="mins === m" @click="mins = m">{{ m }} min</Chip></div><button class="btn primary" @click="go">Listo</button></div>
      </template>
      <template v-else>
        <div class="card tight" style="margin-top:10px">
          <div class="small">Dijiste: <b>{{ pending.want }} — {{ pending.minutes }} min</b> ({{ pending.at }})</div>
          <div class="small b" style="margin-top:8px">¿Lo lograste?</div>
          <div class="row wrap" style="gap:6px;margin-top:6px">
            <button class="btn sm primary" @click="A.resolveIntention(pending.id, 'logrado')">¡Sí! 🎉</button>
            <button class="btn sm lav" @click="A.resolveIntention(pending.id, 'parcial')">Más o menos</button>
            <select class="input" style="width:auto;padding:6px" v-model="endedIn" aria-label="Terminé en"><option>TikTok</option><option>Instagram</option><option>Facebook</option><option>WhatsApp</option><option>YouTube</option><option>Otra</option></select>
            <button class="btn sm ghost" @click="A.resolveIntention(pending.id, 'distraje', endedIn)">Terminé en {{ endedIn }}</button>
          </div>
        </div>
      </template>
    </div>

    <div class="card stack" style="gap:10px">
      <div class="row between wrap" style="gap:8px">
        <h3>Tiempo de pantalla</h3>
        <select class="input" style="width:auto;padding:6px 10px;font-size:13px" v-model="scDate" aria-label="Día">
          <option v-for="(k, i) in daysBack" :key="k" :value="k">{{ i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : WEEKDAYS[parseDay(k).getDay()] + ' ' + parseDay(k).getDate() }}</option>
        </select>
      </div>
      <p class="tiny muted">Cópialo de Ajustes → Bienestar digital → Panel. Puedes escribir como sale allá: "2 h 40 min", "2h40" o "160".</p>
      <div class="grid2">
        <label class="field"><span>Tiempo total</span><input class="input" v-model="sc.total" placeholder="6 h 51 min" inputmode="text" /></label>
        <label class="field"><span>Notificaciones</span><input class="input" v-model="sc.notif" type="number" placeholder="410" /></label>
      </div>
      <div class="apps">
        <label v-for="[k, n, kind] in APPS" :key="k" class="app"><span class="an"><i class="adot" :class="kind"></i>{{ n }}</span><input class="input" v-model="sc.apps[k]" placeholder="0 min" :aria-label="`Minutos en ${n}`" /></label>
        <div v-for="(x, i) in sc.extra" :key="i" class="app"><input class="input an-in" v-model="x.name" placeholder="App" aria-label="Nombre de la app" /><input class="input" v-model="x.min" placeholder="0 min" aria-label="Minutos" /></div>
      </div>
      <button class="link small" style="align-self:flex-start" @click="sc.extra.push({ name: '', min: '' })">+ Otra app</button>
      <p class="tiny muted"><i class="adot social"></i> redes · <i class="adot util"></i> herramientas · <i class="adot ocio"></i> entretenimiento<span v-if="appSum"> · apps anotadas: {{ showMin(appSum) }}</span></p>
      <button class="btn lav block" @click="saveScreen">Guardar</button>
    </div>

    <div class="card">
      <h3>Esta semana</h3>
      <div class="spark" style="height:100px;margin-top:10px">
        <div v-for="w in week" :key="w.k" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:2px" :title="`${fmtDur(w.total)} total, ${fmtDur(w.social)} redes`">
          <i class="lav" :style="{ height: ((w.total - w.social) / max * 100) + '%', display: 'block', borderRadius: '6px 6px 0 0' }"></i>
          <i :style="{ height: (w.social / max * 100) + '%', display: 'block', borderRadius: '0 0 3px 3px' }"></i>
        </div>
      </div>
      <div class="row between tiny muted" style="margin-top:4px"><span v-for="w in week" :key="w.k">{{ WEEKDAYS[parseDay(w.k).getDay()] }}</span></div>
      <p class="tiny muted" style="margin-top:6px">Rosado = redes · Lila = resto</p>
    </div>

    <div class="card">
      <h3>Patrones (para entenderte, no para castigarte)</h3>
      <p class="small" style="margin-top:6px">Intenciones registradas: {{ state.intentions.length }} · lograste {{ stats.ok }} de {{ stats.total }}</p>
      <div class="row wrap" style="gap:6px;margin-top:8px"><span v-for="[r, n] in stats.by" :key="r" class="badge">{{ REASONS.find((x) => x[0] === r)?.[1] || r }} · {{ n }}</span></div>
      <p v-for="i in ins" :key="i.id" class="small" style="margin-top:8px">{{ i.emoji }} {{ i.text }}</p>
    </div>
    <p class="notice"><Icon name="shield" :size="18" />Una app web no puede aparecer encima de TikTok ni leer tu uso automáticamente. Por ahora: registro manual + recordatorios dentro de la app. Más adelante, una app nativa o una extensión podrían hacerlo con tu permiso.</p>
  </div>
</template>

<style scoped>
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.apps { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px 14px; }
.app { display: grid; grid-template-columns: 1fr 110px; align-items: center; gap: 8px; }
.an { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; }
.an-in { padding: 8px 10px; }
.adot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--line); vertical-align: middle; }
.adot.social { background: var(--pink-300); } .adot.util { background: var(--lav-300); } .adot.ocio { background: #FFE29A; }
</style>
