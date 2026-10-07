<script setup>
import { computed, reactive, ref } from 'vue'
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

const today = state.screen.find((s) => s.date === dayKey())
const sc = reactive({ total: today?.total || 0, tiktok: today?.apps.tiktok || 0, instagram: today?.apps.instagram || 0, facebook: today?.apps.facebook || 0, whatsapp: today?.apps.whatsapp || 0, otras: today?.apps.otras || 0 })
function saveScreen() { A.logScreen({ total: Number(sc.total), apps: { tiktok: +sc.tiktok, instagram: +sc.instagram, facebook: +sc.facebook, whatsapp: +sc.whatsapp, otras: +sc.otras } }) }
const week = computed(() => Array.from({ length: 7 }, (_, i) => { const k = keyPlus(-6 + i); const s = state.screen.find((x) => x.date === k); return { k, social: s ? Object.values(s.apps).reduce((a, b) => a + b, 0) : 0, total: s?.total || 0 } }))
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

    <div class="card">
      <h3>Tiempo de pantalla de hoy (minutos)</h3>
      <p class="tiny muted">Cópialo de Bienestar digital (Android) o Tiempo en pantalla (iPhone). Una web no puede leerlo sola.</p>
      <div class="grid3" style="margin-top:10px">
        <label class="field"><span>Total</span><input class="input" type="number" v-model="sc.total" /></label>
        <label class="field"><span>TikTok</span><input class="input" type="number" v-model="sc.tiktok" /></label>
        <label class="field"><span>Instagram</span><input class="input" type="number" v-model="sc.instagram" /></label>
        <label class="field"><span>Facebook</span><input class="input" type="number" v-model="sc.facebook" /></label>
        <label class="field"><span>WhatsApp</span><input class="input" type="number" v-model="sc.whatsapp" /></label>
        <label class="field"><span>Otras</span><input class="input" type="number" v-model="sc.otras" /></label>
      </div>
      <button class="btn lav block" style="margin-top:10px" @click="saveScreen">Guardar</button>
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
