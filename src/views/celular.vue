<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { APPS, parseMin, showMin, socialMinutes } from '../engine/screen'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { toast } from '../engine/game'
import { insights } from '../engine/insights'
import { dayKey, fmtDur, keyPlus, WEEKDAYS, parseDay } from '../engine/time'
import { Pet, Chip, Icon } from '../components/ui'

const REASONS = [['estudiar', 'Estudiar', 'book'], ['trabajar', 'Trabajar', 'briefcase'], ['buscar', 'Buscar info', 'search'], ['hablar', 'Hablar con alguien', 'chat'], ['aburrimiento', 'Aburrimiento', 'clock'], ['evitar', 'Evitar una tarea', 'back'], ['ansiedad', 'Ansiedad', 'heart'], ['automatico', 'Automático', 'zap']]
const want = ref(''), mins = ref(10), reason = ref('estudiar')
const pending = computed(() => state.intentions.find((i) => !i.result && i.date === dayKey()))
const endedIn = ref('TikTok')
function go() { if (!want.value.trim() && !['aburrimiento', 'automatico', 'ansiedad'].includes(reason.value)) return; A.addIntention(want.value.trim() || REASONS.find((r) => r[0] === reason.value)[1], mins.value, reason.value); want.value = '' }

// Tiempo de pantalla: se copia de Bienestar digital (una web no puede leerlo sola). Acepta "2 h 40 min", "2h40" o "160".
const scDate = ref(dayKey())
const sc = reactive({ total: '', notif: '', apps: {}, extra: [], src: null })
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
  A.logScreen({ date: scDate.value, total, notifications: Number(sc.notif) || null, apps, names, source: sc.src || 'manual' })
  sc.src = null
}
// Leer capturas (en tu equipo, gratis): llena el formulario y tú solo revisas y guardas
const ocr = ref({ busy: false, pct: 0 })
async function fromShots(ev) {
  const files = [...(ev.target.files || [])]; ev.target.value = ''
  if (!files.length) return
  ocr.value = { busy: true, pct: 0 }
  try {
    const { readScreenshots } = await import('../services/screenOcr')
    const r = await readScreenshots(files, (p) => (ocr.value.pct = Math.round(p * 100)))
    sc.src = 'captura'
    if (r.total) sc.total = showMin(r.total)
    if (r.notifications) sc.notif = r.notifications
    let n = 0
    for (const [k, m] of Object.entries(r.apps)) {
      if (APPS.some((a) => a[0] === k)) { sc.apps[k] = showMin(m); n++ }
      else if (m >= 5 && !sc.extra.some((x) => x.name.toLowerCase() === (r.names[k] || k).toLowerCase())) { sc.extra.push({ name: r.names[k] || k, min: showMin(m) }); n++ }
    }
    toast(n || r.total ? `Leí ${n} apps${r.total ? ' y el total' : ''}. Revisa y dale Guardar` : 'No pude leer la captura. Prueba con una más nítida')
  } catch (e) { console.warn(e); toast('No pude leer la captura (¿sin internet la primera vez?)') } finally { ocr.value.busy = false }
}
// Llegaron capturas desde "Compartir → MuMu": se leen solas
async function readShared(n) {
  try {
    const cache = await caches.open('mumu-compartido')
    const files = []
    for (let i = 0; i < n; i++) { const r = await cache.match(`/compartido/${i}`); if (r) files.push(new File([await r.blob()], `captura-${i}.png`, { type: r.headers.get('content-type') || 'image/png' })) }
    for (const k of await cache.keys()) await cache.delete(k)
    if (files.length) await fromShots({ target: { files, value: '' } })
  } catch (e) { console.warn(e) }
}
// El formulario siempre arranca cerrado; solo se abre solo si llegan capturas compartidas para leer
const formOpen = ref(false)
const formEl = ref(null)
{
  const n = Number(new URLSearchParams(location.search).get('compartido') || 0)
  if (n) { history.replaceState(null, '', location.pathname); scDate.value = dayKey(); formOpen.value = true; readShared(n) }
}
function editDay(k) { scDate.value = k; formOpen.value = true; nextTick(() => formEl.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })) }
const daysBack = computed(() => Array.from({ length: 7 }, (_, i) => keyPlus(-i)))
// "9h 47" / "45m": cabe debajo de cada barra sin partirse
const short = (m) => { m = Math.round(Number(m) || 0); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}` : `${m}m` }
const week = computed(() => Array.from({ length: 7 }, (_, i) => { const k = keyPlus(-6 + i); const s = state.screen.find((x) => x.date === k); const total = s?.total || 0; return { k, social: Math.min(total, socialMinutes(s)), total, today: k === dayKey() } }))
// Línea de referencia: tu meta diaria si la tienes; si no, tu promedio de los días con datos
const withData = computed(() => week.value.filter((w) => w.total > 0))
const avg = computed(() => (withData.value.length ? Math.round(withData.value.reduce((a, w) => a + w.total, 0) / withData.value.length) : 0))
const screenGoal = computed(() => Number(state.settings.screenGoal) || 0)
const refLine = computed(() => (screenGoal.value ? { min: screenGoal.value, label: `Meta ${short(screenGoal.value)}` } : avg.value ? { min: avg.value, label: `Promedio ${short(avg.value)}` } : null))
const max = computed(() => Math.max(60, refLine.value?.min || 0, ...week.value.map((w) => w.total)))
const BAR_PX = 120
const barPx = (m) => (m ? Math.max(4, Math.round((m / max.value) * BAR_PX)) : 0)
const stats = computed(() => {
  const it = state.intentions.filter((i) => i.result)
  const by = {}; state.intentions.forEach((i) => (by[i.reason] = (by[i.reason] || 0) + 1))
  return { total: it.length, ok: it.filter((i) => i.result === 'logrado').length, by: Object.entries(by).sort((a, b) => b[1] - a[1]) }
})
// Días guardados (los últimos 14) y app de Android
const saved = computed(() => [...state.screen].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14))
const openDay = ref(null)
const appRows = (e) => Object.entries(e.apps || {}).map(([k, m]) => { const a = APPS.find((x) => x[0] === k); return { k, name: a?.[1] || e.names?.[k] || k, kind: a?.[2] || 'otra', m: Number(m) || 0 } }).sort((a, b) => b.m - a.m)
const tileTop = (k) => (k === dayKey() ? 'Hoy' : k === keyPlus(-1) ? 'Ayer' : WEEKDAYS[parseDay(k).getDay()])
const SRC = { android: ['phone', 'Leído del celular'], captura: ['image', 'Leído de capturas'], manual: ['edit', 'Escrito a mano'] }
const srcOf = (e) => SRC[e.source] || SRC.manual
// Proporción redes / herramientas / entretenimiento de cada día (el resto queda en el fondo de la barrita)
function mix(e) {
  const t = Math.max(1, Number(e.total) || 0, appRows(e).reduce((a, r) => a + r.m, 0))
  const by = { social: 0, util: 0, ocio: 0 }
  appRows(e).forEach((r) => { if (by[r.kind] != null) by[r.kind] += r.m })
  return Object.entries(by).filter(([, m]) => m > 0).map(([k, m]) => ({ k, w: (m / t) * 100 }))
}
const daysFolded = computed({ get: () => !!state.settings.screenDaysFolded, set: (v) => (state.settings.screenDaysFolded = v) })
const isAndroid = /android/i.test(navigator.userAgent)
const android = computed(() => state.settings.android)
function ago(iso) {
  const t = iso ? new Date(iso).getTime() : NaN
  if (!Number.isFinite(t)) return 'todavía no'
  const min = Math.round((Date.now() - t) / 60000)
  if (min < 2) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`
  const d = Math.round(min / 1440)
  return d === 1 ? 'ayer' : `hace ${d} días`
}
const tint = (c) => ({ background: `color-mix(in srgb, ${c} 40%, var(--surface))`, color: 'var(--ink)' })
const APK = 'https://github.com/alizz3/MuMu/releases/download/android/mumu.apk'
const ins = computed(() => insights().filter((i) => ['phone', 'screen-focus'].includes(i.id)))
</script>

<template>
  <div class="stack">
    <div class="card pink">
      <div class="row"><Pet pose="think" :size="80" /><div class="grow"><h2 style="font-size:17px">Hey {{ state.settings.ownerName }}, ¿qué venías a hacer?</h2><p class="tiny muted">Antes de abrir otra app, dime tu intención. Después te pregunto cómo te fue, sin regaños.</p></div></div>
      <template v-if="!pending">
        <input class="input" v-model="want" placeholder="Ej: Revisar Aula" style="margin-top:10px" aria-label="Intención" />
        <div class="reasons"><button v-for="r in REASONS" :key="r[0]" class="rb" :class="{ on: reason === r[0] }" @click="reason = r[0]"><Icon :name="r[2]" :size="14" />{{ r[1] }}</button></div>
        <div class="row" style="margin-top:8px"><div class="chips grow"><Chip v-for="m in [5, 10, 15, 30]" :key="m" :active="mins === m" @click="mins = m">{{ m }} min</Chip></div><button class="btn primary" @click="go">Listo</button></div>
      </template>
      <template v-else>
        <div class="card tight" style="margin-top:10px">
          <div class="small">Dijiste: <b>{{ pending.want }} — {{ pending.minutes }} min</b> ({{ pending.at }})</div>
          <div class="small b" style="margin-top:8px">¿Lo lograste?</div>
          <div class="row wrap" style="gap:6px;margin-top:6px">
            <button class="btn sm primary" @click="A.resolveIntention(pending.id, 'logrado')">¡Sí!</button>
            <button class="btn sm lav" @click="A.resolveIntention(pending.id, 'parcial')">Más o menos</button>
            <select class="input" style="width:auto;padding:6px" v-model="endedIn" aria-label="Terminé en"><option>TikTok</option><option>Instagram</option><option>Facebook</option><option>WhatsApp</option><option>YouTube</option><option>Otra</option></select>
            <button class="btn sm ghost" @click="A.resolveIntention(pending.id, 'distraje', endedIn)">Terminé en {{ endedIn }}</button>
          </div>
        </div>
      </template>
    </div>

    <!-- App de Android: lee el uso sola -->
    <div v-if="android" class="card andr" :class="{ ok: android.permiso }">
      <div class="row" style="gap:12px">
        <span class="gico" :style="tint(android.permiso ? '#B9DCCB' : '#F7B6C2')"><Icon :name="android.permiso ? 'check' : 'lock'" :size="18" :stroke="android.permiso ? 2.6 : 2" /></span>
        <div class="grow" style="min-width:0">
          <b class="small">{{ android.permiso ? 'Permiso listo · se lee solo' : 'Falta un permiso' }}</b>
          <div class="tiny muted">{{ android.permiso ? `Última lectura ${ago(android.at)} · cada vez que abres la app se guardan tus últimos 7 días` : 'Activa MuMu en "Acceso al uso" para que lea tu tiempo de pantalla.' }}</div>
        </div>
      </div>
      <div v-if="!android.permiso" class="andr-actions">
        <a class="btn sm primary" href="mumu://permiso"><Icon name="lock" :size="14" />Dar permiso</a>
        <a class="btn sm ghost" href="mumu://abrir"><Icon name="refresh" :size="14" />Ya le di permiso · actualizar</a>
        <p class="tiny muted" style="flex-basis:100%">Después de darle el permiso, la app se vuelve a abrir sola y lo lee.</p>
      </div>
      <div v-else class="andr-actions">
        <a class="btn sm ghost" href="mumu://abrir"><Icon name="refresh" :size="14" />Actualizar ahora</a>
      </div>
    </div>
    <a v-else-if="isAndroid" class="card row" style="gap:12px;text-decoration:none;color:inherit" :href="APK">
      <span class="gico" :style="tint('#F7B6C2')"><Icon name="download" :size="18" /></span>
      <div class="grow" style="min-width:0"><b class="small">Instala MuMu para Android</b><div class="tiny muted">Lee tu tiempo de pantalla sola, sin capturas.</div></div>
      <Icon name="chev" :size="16" class="muted" />
    </a>

    <!-- Registrar (plegable) -->
    <div ref="formEl" class="card grp">
      <button class="grp-head" :aria-expanded="formOpen" @click="formOpen = !formOpen">
        <span class="gico" :style="tint('#C3B3D4')"><Icon name="plus" :size="16" /></span>
        <h3 class="grow">Registrar tiempo de pantalla</h3>
        <Icon name="chev" :size="16" class="muted" :style="{ transform: formOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }" />
      </button>
      <div v-if="formOpen" class="stack" style="gap:10px;margin-top:12px">
        <div class="row between wrap" style="gap:8px">
          <span class="small muted">Día</span>
          <select class="input" style="width:auto;padding:6px 10px;font-size:13px" v-model="scDate" aria-label="Día">
            <option v-for="(k, i) in daysBack" :key="k" :value="k">{{ i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : WEEKDAYS[parseDay(k).getDay()] + ' ' + parseDay(k).getDate() }}</option>
          </select>
        </div>
        <label class="shot" :class="{ busy: ocr.busy }">
          <input type="file" accept="image/*" multiple class="sr" :disabled="ocr.busy" @change="fromShots" />
          <Icon name="image" :size="18" />
          <span v-if="!ocr.busy"><b>Subir capturas de Bienestar digital</b><br /><span class="tiny muted">Se leen aquí en tu equipo, no se suben a ningún lado.</span></span>
          <span v-else>Leyendo… {{ ocr.pct }}%</span>
        </label>
        <p class="tiny muted">O escríbelo a mano como sale allá: "2 h 40 min", "2h40" o "160".</p>
        <div class="grid2">
          <label class="field"><span>Tiempo total</span><input class="input" v-model="sc.total" placeholder="6 h 51 min" /></label>
          <label class="field"><span>Notificaciones</span><input class="input" v-model="sc.notif" type="number" placeholder="410" /></label>
        </div>
        <div class="apps">
          <label v-for="[k, n, kind] in APPS" :key="k" class="app"><span class="an"><i class="adot" :class="kind"></i>{{ n }}</span><input class="input" v-model="sc.apps[k]" placeholder="0 min" :aria-label="`Minutos en ${n}`" /></label>
          <div v-for="(x, i) in sc.extra" :key="i" class="app"><input class="input an-in" v-model="x.name" placeholder="App" aria-label="Nombre de la app" /><input class="input" v-model="x.min" placeholder="0 min" aria-label="Minutos" /></div>
        </div>
        <button class="link small" style="align-self:flex-start" @click="sc.extra.push({ name: '', min: '' })">+ Otra app</button>
        <button class="btn lav block" @click="saveScreen(); formOpen = false">Guardar</button>
      </div>
    </div>

    <!-- Esta semana: una barra por día (alto = tiempo total, la parte oscura de abajo = redes) -->
    <div class="card">
      <div class="row between" style="gap:8px">
        <h3>Esta semana</h3>
        <span v-if="withData.length" class="tiny muted num">{{ withData.length }} {{ withData.length === 1 ? 'día' : 'días' }} con datos</span>
      </div>
      <p v-if="!withData.length" class="tiny muted" style="margin-top:6px">Todavía no hay datos de estos 7 días. Registra uno y aquí lo ves.</p>
      <template v-else>
        <div class="wk" role="img" :aria-label="'Tiempo de pantalla de los últimos 7 días: ' + week.map((w) => `${WEEKDAYS[parseDay(w.k).getDay()]} ${w.total ? fmtDur(w.total) : 'sin datos'}`).join(', ')">
          <div class="wk-plot" :style="{ height: BAR_PX + 22 + 'px' }">
            <div v-if="refLine" class="wk-ref" :style="{ bottom: barPx(refLine.min) + 'px' }"></div>
            <div v-for="w in week" :key="w.k" class="wk-col" :class="{ today: w.today }" :title="w.total ? `${fmtDur(w.total)} en total · ${fmtDur(w.social)} en redes` : 'Sin datos'">
              <span class="wk-val num" :style="{ bottom: barPx(w.total) + 4 + 'px' }">{{ w.total ? short(w.total) : '' }}</span>
              <div v-if="w.total" class="wk-bar" :style="{ height: barPx(w.total) + 'px' }"><i :style="{ height: (w.social / w.total * 100) + '%' }"></i></div>
              <div v-else class="wk-none"></div>
            </div>
          </div>
          <div class="wk-days"><span v-for="w in week" :key="w.k" :class="{ today: w.today }">{{ w.today ? 'Hoy' : WEEKDAYS[parseDay(w.k).getDay()] }}</span></div>
        </div>
        <div class="wk-legend tiny muted">
          <span><i class="sw soc"></i>Redes</span><span><i class="sw rest"></i>Resto</span>
          <span v-if="refLine"><i class="sw dash"></i><span class="num">{{ refLine.label }}</span></span>
        </div>
      </template>
    </div>

    <!-- Lo que ya guardaste -->
    <section class="card grp">
      <button class="grp-head" :aria-expanded="!daysFolded" @click="daysFolded = !daysFolded">
        <span class="gico" :style="tint('#F7B6C2')"><Icon name="calendar" :size="16" /></span>
        <h3 class="grow">Tus días</h3>
        <span class="badge">{{ saved.length }}</span>
        <Icon name="chev" :size="16" class="muted" :style="{ transform: daysFolded ? 'none' : 'rotate(90deg)', transition: 'transform .2s' }" />
      </button>
      <template v-if="!daysFolded">
        <p v-if="!saved.length" class="tiny muted" style="margin-top:8px">Todavía no hay días guardados.</p>
        <div class="dlist">
          <div v-for="e in saved" :key="e.date" class="day">
            <button class="day-head" :aria-expanded="openDay === e.date" @click="openDay = openDay === e.date ? null : e.date">
              <span class="dtile" :class="{ today: e.date === dayKey() }"><small>{{ tileTop(e.date) }}</small><b class="num">{{ parseDay(e.date).getDate() }}</b></span>
              <span class="dmid">
                <b class="num dtot">{{ showMin(e.total) || '—' }}</b>
                <span class="mbar" aria-hidden="true"><i v-for="s in mix(e)" :key="s.k" :class="s.k" :style="{ width: s.w + '%' }"></i></span>
                <span class="tiny muted dsub num">redes {{ showMin(socialMinutes(e)) || '0 min' }}</span>
              </span>
              <span class="dsrc" :title="srcOf(e)[1]" :aria-label="srcOf(e)[1]"><Icon :name="srcOf(e)[0]" :size="15" /></span>
              <Icon name="chev" :size="14" class="muted" :style="{ flex: 'none', transform: openDay === e.date ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }" />
            </button>
            <div v-if="openDay === e.date" class="day-body">
              <div v-if="e.notifications" class="tiny muted row" style="gap:6px;margin-bottom:8px"><Icon name="bell" :size="12" /> {{ e.notifications }} notificaciones</div>
              <div v-for="r in appRows(e)" :key="r.k" class="arow">
                <span class="an small"><i class="adot" :class="r.kind"></i><span class="ell">{{ r.name }}</span></span>
                <span class="abar"><i :class="r.kind" :style="{ width: Math.max(3, r.m / Math.max(1, appRows(e)[0].m) * 100) + '%' }"></i></span>
                <span class="tiny muted num" style="text-align:right;white-space:nowrap">{{ showMin(r.m) }}</span>
              </div>
              <p v-if="!appRows(e).length" class="tiny muted">Ese día solo guardaste el total.</p>
              <button class="link tiny" style="margin-top:6px;padding-left:0" @click="editDay(e.date)"><Icon name="edit" :size="12" class="inl" /> Editar este día</button>
            </div>
          </div>
        </div>
        <p v-if="saved.length" class="tiny muted legend"><span><i class="adot social"></i> redes</span><span><i class="adot util"></i> herramientas</span><span><i class="adot ocio"></i> entretenimiento</span></p>
      </template>
    </section>
    <div class="card">
      <h3>Patrones (para entenderte, no para castigarte)</h3>
      <p class="small" style="margin-top:6px">Intenciones registradas: {{ state.intentions.length }} · lograste {{ stats.ok }} de {{ stats.total }}</p>
      <div class="row wrap" style="gap:6px;margin-top:8px"><span v-for="[r, n] in stats.by" :key="r" class="pill"><Icon :name="REASONS.find((x) => x[0] === r)?.[2] || 'sparkles'" :size="12" />{{ REASONS.find((x) => x[0] === r)?.[1] || r }} · {{ n }}</span></div>
      <p v-for="i in ins" :key="i.id" class="small row" style="margin-top:8px;gap:8px;align-items:flex-start"><Icon :name="i.icon || 'sparkles'" :size="16" style="flex:none;margin-top:2px" />{{ i.text }}</p>
    </div>
  </div>
</template>

<style scoped>
.shot { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px dashed var(--pink-300); border-radius: 14px; cursor: pointer; background: var(--pink-50, transparent); font-size: 14px; }
.shot.busy { opacity: .7; cursor: progress; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.apps { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px 14px; }
.app { display: grid; grid-template-columns: 1fr 110px; align-items: center; gap: 8px; }
.an { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; }
.an-in { padding: 8px 10px; }
.adot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--line); vertical-align: middle; }
.adot.social { background: var(--pink-500); } .adot.util { background: var(--lav-300); } .adot.ocio { background: #FFE29A; }
.reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.rb { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); border-radius: 999px; padding: 6px 11px; font: inherit; font-size: 12.5px; cursor: pointer; }
.rb.on { background: var(--pink-100); color: var(--pink-700); border-color: transparent; font-weight: 600; }
.gico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; color: var(--ink); }
.num { font-variant-numeric: tabular-nums; }
.ell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Encabezados plegables, igual que en Tareas */
.grp { padding-top: 12px; padding-bottom: 12px; }
.grp-head, .day-head { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
.grp-head h3 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Android */
.andr-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; padding-left: 42px; }
.andr-actions .btn { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
@media (max-width: 400px) { .andr-actions { padding-left: 0; } }
/* Esta semana */
.wk { margin-top: 12px; }
.wk-plot { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; border-bottom: 1px solid var(--line); }
.wk-col { position: relative; height: 100%; display: flex; justify-content: center; align-items: flex-end; }
.wk-bar { width: min(72%, 34px); border-radius: 8px 8px 3px 3px; background: color-mix(in srgb, var(--pink-300) 42%, var(--surface)); overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.wk-bar i { display: block; background: var(--pink-500); }
.wk-col.today .wk-bar { background: color-mix(in srgb, var(--pink-300) 72%, var(--surface)); box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--pink-500); }
.wk-none { width: min(72%, 34px); height: 3px; border-radius: 99px; background: var(--track); }
.wk-val { position: absolute; left: 50%; transform: translateX(-50%); font-size: 10.5px; line-height: 1; color: var(--ink-2); white-space: nowrap; letter-spacing: -.01em; background: var(--surface); padding: 1px 2px; border-radius: 4px; z-index: 2; }
.wk-col.today .wk-val { color: var(--pink-700); font-weight: 700; }
.wk-ref { position: absolute; left: 0; right: 0; border-top: 1.5px dashed var(--lav-500); opacity: .8; pointer-events: none; z-index: 1; }
.wk-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-top: 6px; }
.wk-days span { text-align: center; font-size: 11.5px; color: var(--muted); }
.wk-days span.today { color: var(--pink-700); font-weight: 700; }
.wk-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 10px; }
.wk-legend > span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
.sw.soc { background: var(--pink-500); }
.sw.rest { background: color-mix(in srgb, var(--pink-300) 42%, var(--surface)); border: 1px solid color-mix(in srgb, var(--pink-300) 60%, var(--surface)); }
.sw.dash { width: 14px; height: 0; border-radius: 0; border-top: 1.5px dashed var(--lav-500); }
/* Tus días */
.dlist { margin-top: 6px; }
.day { border-bottom: 1px solid var(--line); }
.day:last-child { border-bottom: 0; }
.day-head { padding: 10px 0; gap: 12px; }
.dtile { width: 42px; height: 44px; flex: none; border-radius: 12px; background: var(--surface-3); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.05; }
.dtile small { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 600; }
.dtile b { font-size: 16px; }
.dtile.today { background: var(--pink-100); }
.dtile.today small, .dtile.today b { color: var(--pink-700); }
.dmid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.dtot { font-size: 15px; line-height: 1.1; white-space: nowrap; }
.dsub { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.1; }
.mbar { display: flex; height: 6px; border-radius: 99px; background: var(--track); overflow: hidden; }
.mbar i { display: block; height: 100%; }
.mbar i.social { background: var(--pink-500); } .mbar i.util { background: var(--lav-300); } .mbar i.ocio { background: #FFE29A; }
.dsrc { width: 28px; height: 28px; flex: none; border-radius: 9px; display: grid; place-items: center; color: var(--muted); background: var(--surface-3); }
.day-body { padding: 0 0 12px 54px; }
.arow { display: grid; grid-template-columns: minmax(0, 112px) minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 3px 0; }
.arow .an { min-width: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 10px; }
.legend > span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
@media (max-width: 400px) { .day-body { padding-left: 0; } }
.abar { height: 7px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.abar i { display: block; height: 100%; border-radius: 99px; background: var(--line); }
.abar i.social { background: var(--pink-500); } .abar i.util { background: var(--lav-300); } .abar i.ocio { background: #FFE29A; }
.pill { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; padding: 5px 10px; border-radius: 999px; background: var(--surface-3); }
</style>
