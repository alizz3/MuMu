<script setup>
import { computed, ref, reactive, onUnmounted } from 'vue'
import { state } from '../store'
import * as A from '../store/actions'
import { dayKey, longDate, parseDay } from '../engine/time'
import { Icon, Pet, Chip } from '../components/ui'
import { toast } from '../engine/game'
import { useDictado, juntar } from '../services/dictado'

const VERSES = [
  ['Todo lo puedo en Cristo que me fortalece.', 'Filipenses 4:13'],
  ['Estad quietos, y conoced que yo soy Dios.', 'Salmos 46:10'],
  ['Venid a mí todos los que estáis trabajados y cargados, que yo os haré descansar.', 'Mateo 11:28'],
  ['Encomienda al Señor tus obras, y tus pensamientos serán afirmados.', 'Proverbios 16:3'],
  ['Nuevas son cada mañana; grande es tu fidelidad.', 'Lamentaciones 3:23'],
  ['Este es el día que hizo el Señor; nos gozaremos y alegraremos en él.', 'Salmos 118:24'],
  ['Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros.', '1 Pedro 5:7'],
  ['No temas, porque yo estoy contigo.', 'Isaías 41:10'],
]
const k = dayKey()
const verse = VERSES[parseDay(k).getDate() % VERSES.length]
const e = reactive({ heart: '', teach: '', grateful: '', give: '', intention: '', note: '', prayer: '', talked: false, prayers: { morning: false, night: false }, ...(state.god.entries[k] || {}) })
const save = () => A.saveGod(JSON.parse(JSON.stringify(e)))
const past = computed(() => Object.entries(state.god.entries).filter(([d]) => d !== k).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10))

// Preguntas: cada una con un ejemplo cortico para saber qué poner
const QUESTIONS = [
  { key: 'heart', q: '¿Qué pasó hoy o qué tienes en el corazón?', help: 'Lo que viviste y cómo te sientes. Ej: "Estoy cansada y me preocupa el parcial del domingo".' },
  { key: 'grateful', q: '¿Por qué das gracias?', help: 'Cosas grandes o chiquitas. Ej: "por mi papá, por Leo y la Negra, por el cafecito".' },
  { key: 'give', q: '¿Qué le quieres pedir o entregar?', help: 'Lo que quieres dejar en sus manos. Ej: "que me ayude a no angustiarme" o "la salud de mi papá".' },
  { key: 'teach', q: '¿Qué te enseñó hoy? (opcional)', help: 'Un versículo, un devocional o algo que viviste. Ej: "que no tengo que poder con todo sola".' },
  { key: 'intention', q: 'Tu intención para hoy (opcional)', help: 'Una frase cortica. Ej: "ser paciente conmigo misma".', short: true },
]

// ---------- Dictado ----------
const d = useDictado()
function mic(key) {
  const ok = d.toggle(key, (txt) => { e[key] = juntar(e[key], txt); save() })
  if (ok === false && d.error.value) toast(d.error.value)
  if (ok === false && !d.error.value) save()
}

// ---------- Armar la oración (plantillas locales, sin IA) ----------
const KEEP_CAP = /^(Dios|Jesús|Jesus|Señor|Papá|Papito|Espíritu|Cristo|Leo|Negra|Biblia|MuMu)\b/
function clean(s) {
  let t = (s || '').trim().replace(/\s+/g, ' ').replace(/[.。]+$/, '').trim()
  if (!t) return ''
  if (!KEEP_CAP.test(t) && !/^[A-ZÁÉÍÓÚÑ]{2,}\b/.test(t)) t = t.charAt(0).toLowerCase() + t.slice(1)
  return t
}
const strip = (t, re) => t.replace(re, '').trim()
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

const OPEN = [
  'Papá Dios, gracias por este ratico contigo. Aquí estoy, tal como soy.',
  'Señor, vengo a ti con el corazón abierto, sin tener que tener las palabras perfectas.',
  'Papito Dios, aquí estoy otra vez. Gracias porque siempre me escuchas.',
  'Señor Jesús, me acerco a ti con confianza, porque sé que me conoces y me amas.',
]
const HEART = [
  (x) => `Te cuento lo que tengo en el corazón: ${x}. Tú ya lo sabes, pero quiero decírtelo.`,
  (x) => `Hoy ${/^(me|estoy|tengo|siento|hoy)\b/.test(x) ? 'te cuento que ' : 'traigo esto ante ti: '}${x}. Tú conoces cada detalle mejor que yo.`,
  (x) => `Quiero ser sincera contigo: ${x}. Gracias porque puedo venir a ti así, sin máscaras.`,
]
const GRATEFUL = [
  (x) => `Gracias, Papá, ${/^(por|porque|que)\b/.test(x) ? x : 'por ' + x}. Todo lo bueno viene de ti.`,
  (x) => `Te doy gracias ${/^(por|porque|que)\b/.test(x) ? x : 'por ' + x}. No quiero dar nada por sentado.`,
  (x) => `Mi corazón está agradecido ${/^(por|porque|que)\b/.test(x) ? x : 'por ' + x}. Eres bueno conmigo, aun en los días difíciles.`,
]
const GIVE = [
  (x) => (/^que\b/.test(x) ? `Te pido, Señor, ${x}.` : `Pongo en tus manos ${x}.`) + ' Lo suelto y confío en que tú te encargas.',
  (x) => (/^que\b/.test(x) ? `Por favor, Papá Dios, ${x}.` : `Te entrego ${x}.`) + ' Ayúdame a descansar en ti y no cargarlo sola.',
  (x) => (/^que\b/.test(x) ? `Hoy te pido ${x}.` : `Dejo delante de ti ${x}.`) + ' Hágase tu voluntad, que es buena, agradable y perfecta.',
]
const TEACH = [
  (x) => `Gracias por lo que me enseñaste hoy: ${x}. Ayúdame a guardarlo en mi corazón y a vivirlo.`,
  (x) => `Hoy me hablaste: ${x}. Que no se me olvide y que dé fruto en mí.`,
]
const INTENT = [
  (x) => `Ayúdame hoy a ${x}.`,
  (x) => `Dame tu gracia para ${x}.`,
]
const NOTHING = [
  'Hoy no sé bien qué decirte, pero aquí estoy. Tú lees mi corazón aun cuando no me salen las palabras.',
  'No tengo palabras bonitas hoy, pero quiero estar contigo. Gracias porque tu Espíritu ora por mí.',
]
const CLOSE = [
  'Lléname de tu paz y acompáñame en todo lo que haga. Te amo.',
  'Gracias porque me escuchas y nunca me sueltas. Me quedo en tu paz.',
  'Renueva mis fuerzas y ayúdame a ver tu mano en mi día.',
]

function buildPrayer() {
  const heart = clean(e.heart)
  const grateful = strip(clean(e.grateful), /^(te doy gracias|doy gracias|gracias|agradezco|estoy agradecida)\s*(a ti|a dios|señor)?\s*,?\s*/i)
  // "que me ayude" (hablando de Dios) -> "que me ayudes" (hablándole a Él)
  const give = strip(clean(e.give), /^(te pido|quiero pedirte|le pido|quiero entregarte|quiero entregarle|te entrego|le entrego|quiero entregar)\s*(a dios)?\s*/i)
    .replace(/^que (me|nos|le|les) ([a-záéíóúñ]+?)(é|e|a)\b/i, (m, pr, v, end) => `que ${pr} ${v}${end === 'é' ? 'e' : end}s`)
  const teach = strip(clean(e.teach), /^(me enseñó|me enseñaste|aprendí)\s*/i)
  const intent = strip(clean(e.intention), /^(quiero|mi intención es)\s*/i)
  const parts = [pick(OPEN)]
  if (heart) parts.push(pick(HEART)(heart))
  if (grateful) parts.push(pick(GRATEFUL)(grateful))
  if (give) parts.push(pick(GIVE)(give))
  if (teach) parts.push(pick(TEACH)(teach))
  if (intent) parts.push(pick(INTENT)(intent.charAt(0).toLowerCase() + intent.slice(1)))
  if (parts.length === 1) parts.push(pick(NOTHING), `Me aferro a tu palabra de hoy: “${verse[0]}”`)
  parts.push(pick(CLOSE), 'En el nombre de Jesús, amén.')
  return parts.map((p) => cap(p.replace(/\s+([.,])/g, '$1').replace(/\.\./g, '.'))).join(' ')
}
const draft = ref(e.prayer || '')
const empty = computed(() => !['heart', 'grateful', 'give', 'teach', 'intention'].some((x) => (e[x] || '').trim()))
function arm() {
  d.stop()
  let p = buildPrayer(), tries = 0
  while (p === draft.value && tries++ < 5) p = buildPrayer()
  draft.value = p
}
function keep() { e.prayer = draft.value; save(); toast('Tu oración quedó guardada') }
async function copy() {
  try { await navigator.clipboard.writeText(draft.value); toast('Copiada') } catch {
    const ta = document.createElement('textarea'); ta.value = draft.value; document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy'); toast('Copiada') } catch { toast('No pude copiarla; mantén presionado el texto') }
    ta.remove()
  }
}

// ---------- Leer en voz alta ----------
const speaking = ref(false)
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
function read() {
  if (!canSpeak) { toast('Tu navegador no puede leer en voz alta'); return }
  const s = window.speechSynthesis
  if (speaking.value) { s.cancel(); speaking.value = false; return }
  const u = new SpeechSynthesisUtterance(draft.value)
  const vs = s.getVoices()
  const v = vs.find((x) => x.lang === 'es-CO') || vs.find((x) => /es[-_](US|MX|419)/i.test(x.lang)) || vs.find((x) => /^es/i.test(x.lang))
  if (v) u.voice = v
  u.lang = v?.lang || 'es-CO'; u.rate = 0.92; u.pitch = 1
  u.onend = u.onerror = () => { speaking.value = false }
  speaking.value = true
  s.cancel(); s.speak(u)
}
onUnmounted(() => { if (canSpeak) window.speechSynthesis.cancel() })

// ---------- "Hablé con Dios hoy" enlazado al hábito ----------
const habit = computed(() => state.habits.find((h) => /dios|devocional|oraci/i.test(h.name)))
const habitDone = computed(() => !!(habit.value && state.habitLogs[habit.value.id]?.[k]?.done))
const talked = computed(() => (habit.value ? habitDone.value : !!e.talked))
function setTalked(v) {
  e.talked = v
  if (habit.value && habitDone.value !== v) A.toggleHabit(habit.value.id, k)
  save()
}
function when(slot) {
  e.prayers[slot] = !e.prayers[slot]
  if (e.prayers[slot] && !talked.value) setTalked(true); else save()
}

// momento de silencio
const silence = ref(0), left = ref(0)
let t
function quiet(min) { clearInterval(t); silence.value = min; left.value = min * 60; t = setInterval(() => { left.value--; if (left.value <= 0) { clearInterval(t); silence.value = 0 } }, 1000) }
onUnmounted(() => clearInterval(t))
</script>

<template>
  <div class="stack">
    <div class="card soft" style="text-align:center;padding:22px">
      <Pet pose="pray" :size="110" />
      <div class="tiny muted b" style="margin-top:6px">VERSÍCULO DEL DÍA · TU DEVOCIONAL CORTICO</div>
      <p class="serif" style="font-size:19px;margin:8px 0">“{{ verse[0] }}”</p>
      <p class="small muted">{{ verse[1] }}</p>
    </div>

    <div class="card">
      <h3>¿Cómo funciona este espacio?</h3>
      <p class="small muted" style="margin-top:4px">Si a veces no te salen las palabras para orar, aquí te ayudo.</p>
      <ol class="god-steps">
        <li><b>Cuéntale lo tuyo</b> respondiendo las preguntas. Puedes hablar con el <Icon name="mic" :size="14" class="inl" /> en vez de escribir.</li>
        <li><b>MuMu arma tu oración</b> con tus propias palabras.</li>
        <li><b>Órala</b> en voz alta o en silencio y marca <i>Hablé con Dios hoy</i>.</li>
      </ol>
    </div>

    <div class="card stack">
      <div v-for="(item, i) in QUESTIONS" :key="item.key" class="field god-q">
        <label :for="'gq-' + item.key" class="god-qt"><span class="god-n">{{ i + 1 }}</span>{{ item.q }}</label>
        <p class="tiny muted">{{ item.help }}</p>
        <div class="god-in">
          <input v-if="item.short" :id="'gq-' + item.key" class="input" v-model="e[item.key]" @blur="save" placeholder="Escribe o dicta…" />
          <textarea v-else :id="'gq-' + item.key" class="input" v-model="e[item.key]" @blur="save" placeholder="Escribe o toca el micrófono y habla…"></textarea>
          <button type="button" class="mic-btn" :class="{ on: d.active.value === item.key }" :aria-pressed="d.active.value === item.key" :aria-label="d.active.value === item.key ? 'Dejar de dictar' : `Dictar: ${item.q}`" @click="mic(item.key)">
            <Icon :name="d.active.value === item.key ? 'stopsq' : 'mic'" :size="18" />
          </button>
        </div>
        <p v-if="d.active.value === item.key" class="tiny mic-live" aria-live="polite">Te escucho… {{ d.interim.value }}<span v-if="!d.interim.value">habla tranquila, toca de nuevo para parar</span></p>
      </div>
      <p v-if="!d.supported" class="tiny muted"><Icon name="info" :size="13" class="inl" /> Aquí el navegador no deja dictar. Usa el micrófono del teclado de Google: toca la cajita y luego el micro del teclado.</p>
      <button class="btn primary block big" @click="arm"><Icon name="sparkles" :size="18" />Armar mi oración</button>
      <p v-if="empty" class="tiny muted" style="text-align:center">Aunque sea responde una pregunta; si no, te armo una oración sencilla con el versículo de hoy.</p>
    </div>

    <div v-if="draft" class="card prayer-card">
      <div class="tiny b muted" style="display:flex;align-items:center;gap:6px"><Icon name="dove" :size="15" />TU ORACIÓN DE HOY</div>
      <p class="serif prayer-text">{{ draft }}</p>
      <div class="row wrap" style="gap:6px;margin-top:12px">
        <button class="btn sm lav" @click="arm"><Icon name="refresh" :size="14" />Otra versión</button>
        <button class="btn sm ghost" @click="copy"><Icon name="copy" :size="14" />Copiar</button>
        <button class="btn sm ghost" :aria-pressed="speaking" @click="read"><Icon :name="speaking ? 'stopsq' : 'speaker'" :size="14" />{{ speaking ? 'Parar' : 'Leer en voz alta' }}</button>
        <button class="btn sm primary" @click="keep"><Icon name="save" :size="14" />{{ e.prayer === draft ? 'Guardada' : 'Guardar' }}</button>
      </div>
      <p class="tiny muted" style="margin-top:8px">Es solo una ayudita: cámbiala en tu corazón como quieras. Lo que importa es hablar con Él.</p>
    </div>

    <div class="card">
      <h3>Hoy</h3>
      <label class="item god-talk" :class="{ on: talked }">
        <input type="checkbox" :checked="talked" @change="setTalked($event.target.checked)" />
        <span class="grow"><b>Hablé con Dios hoy</b>
          <span v-if="habit" class="tiny muted" style="display:block">Se marca también tu hábito “{{ habit.name }}” en Hábitos.</span>
          <span v-else class="tiny muted" style="display:block">Si creas un hábito con “Dios” u “oración” en el nombre, se marcará solito.</span>
        </span>
      </label>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <span class="small">¿Cuándo?</span>
        <Chip :active="e.prayers.morning" @click="when('morning')"><Icon name="sun" :size="14" class="inl" /> Mañana</Chip>
        <Chip :active="e.prayers.night" @click="when('night')"><Icon name="moon" :size="14" class="inl" /> Noche</Chip>
      </div>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <span class="small">Un momento de silencio:</span>
        <Chip v-for="m in [1, 3, 5, 10]" :key="m" :active="silence === m" @click="quiet(m)">{{ m }} min</Chip>
      </div>
      <p v-if="silence" class="small serif" style="margin-top:10px;text-align:center">Respira… {{ Math.floor(left / 60) }}:{{ String(left % 60).padStart(2, '0') }}</p>
    </div>

    <div class="card">
      <div class="row between"><h3>Notas</h3>
        <button type="button" class="mic-btn sm" :class="{ on: d.active.value === 'note' }" :aria-label="d.active.value === 'note' ? 'Dejar de dictar' : 'Dictar nota'" @click="mic('note')"><Icon :name="d.active.value === 'note' ? 'stopsq' : 'mic'" :size="16" /></button>
      </div>
      <textarea class="input" v-model="e.note" @blur="save" placeholder="Lo que sientes, lo que oras, lo que entiendes…" style="margin-top:8px"></textarea>
    </div>

    <div v-if="past.length" class="card">
      <h3>Lo que Dios me ha ido enseñando</h3>
      <div v-for="[dk, x] in past" :key="dk" class="item" style="align-items:flex-start">
        <div class="grow small" style="min-width:0"><div class="tiny muted">{{ longDate(parseDay(dk)) }}</div>
          <div v-if="x.heart"><Icon name="chat" :size="13" class="inl" /> {{ x.heart }}</div>
          <div v-if="x.teach"><Icon name="sparkles" :size="13" class="inl" /> {{ x.teach }}</div><div v-if="x.grateful"><Icon name="heart" :size="13" class="inl" /> {{ x.grateful }}</div><div v-if="x.give"><Icon name="gift" :size="13" class="inl" /> {{ x.give }}</div>
          <details v-if="x.prayer" class="god-past"><summary class="tiny b">Ver la oración</summary><p class="serif small">{{ x.prayer }}</p></details>
        </div>
      </div>
    </div>
  </div>
</template>
