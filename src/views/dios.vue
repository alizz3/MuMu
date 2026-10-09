<script setup>
import { computed, ref, reactive, onUnmounted } from 'vue'
import { state } from '../store'
import * as A from '../store/actions'
import { dayKey, longDate, parseDay } from '../engine/time'
import { Icon, Pet, Chip } from '../components/ui'

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
const e = reactive({ teach: '', grateful: '', give: '', intention: '', note: '', prayers: { morning: false, night: false }, ...(state.god.entries[k] || {}) })
const save = () => A.saveGod(JSON.parse(JSON.stringify(e)))
const past = computed(() => Object.entries(state.god.entries).filter(([d]) => d !== k).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10))

// momento de silencio
const silence = ref(0), left = ref(0)
let t
function quiet(min) { clearInterval(t); silence.value = min; left.value = min * 60; t = setInterval(() => { left.value--; if (left.value <= 0) { clearInterval(t); silence.value = 0 } }, 1000) }
onUnmounted(() => clearInterval(t))
</script>

<template>
  <div class="stack" style="--pink-100:#F3ECFA">
    <div class="card soft" style="text-align:center;padding:22px">
      <Pet pose="pray" :size="110" />
      <div class="tiny muted b" style="margin-top:6px">VERSÍCULO DEL DÍA</div>
      <p class="serif" style="font-size:19px;margin:8px 0">“{{ verse[0] }}”</p>
      <p class="small muted">{{ verse[1] }}</p>
    </div>

    <div class="card stack">
      <label class="field"><span class="serif" style="font-size:16px;color:var(--ink)">Papito Dios, ¿qué quieres enseñarme hoy?</span><textarea class="input" v-model="e.teach" @blur="save" placeholder="Escribe con calma…"></textarea></label>
      <label class="field"><span class="serif" style="font-size:16px;color:var(--ink)">¿Por qué estoy agradeciendo hoy?</span><textarea class="input" v-model="e.grateful" @blur="save"></textarea></label>
      <label class="field"><span class="serif" style="font-size:16px;color:var(--ink)">¿Qué quiero entregarle a Dios hoy?</span><textarea class="input" v-model="e.give" @blur="save"></textarea></label>
      <label class="field"><span>Mi intención para hoy</span><input class="input" v-model="e.intention" @blur="save" placeholder="Ej: Ser paciente conmigo misma" /></label>
    </div>

    <div class="card">
      <h3>Hoy</h3>
      <label class="item"><input type="checkbox" v-model="e.prayers.morning" @change="save" /><span class="grow small">Hablé con Dios en la mañana <Icon name="sun" :size="14" class="inl" /></span></label>
      <label class="item"><input type="checkbox" v-model="e.prayers.night" @change="save" /><span class="grow small">Hablé con Dios en la noche <Icon name="moon" :size="14" class="inl" /></span></label>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <span class="small">Un momento de silencio:</span>
        <Chip v-for="m in [1, 3, 5, 10]" :key="m" :active="silence === m" @click="quiet(m)">{{ m }} min</Chip>
      </div>
      <p v-if="silence" class="small serif" style="margin-top:10px;text-align:center">Respira… {{ Math.floor(left / 60) }}:{{ String(left % 60).padStart(2, '0') }}</p>
    </div>

    <div class="card">
      <h3>Notas</h3>
      <textarea class="input" v-model="e.note" @blur="save" placeholder="Lo que sientes, lo que oras, lo que entiendes…" style="margin-top:8px"></textarea>
    </div>

    <div v-if="past.length" class="card">
      <h3>Lo que Dios me ha ido enseñando</h3>
      <div v-for="[d, x] in past" :key="d" class="item" style="align-items:flex-start">
        <div class="grow small"><div class="tiny muted">{{ longDate(parseDay(d)) }}</div>
          <div v-if="x.teach"><Icon name="sparkles" :size="13" class="inl" /> {{ x.teach }}</div><div v-if="x.grateful"><Icon name="heart" :size="13" class="inl" /> {{ x.grateful }}</div><div v-if="x.give"><Icon name="gift" :size="13" class="inl" /> {{ x.give }}</div></div>
      </div>
    </div>
  </div>
</template>
