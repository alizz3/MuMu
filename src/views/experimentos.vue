<script setup>
import { computed, ref, reactive } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { myMethod } from '../engine/insights'
import { dayKey, daysUntil, keyPlus, parseDay, addDays, shortDate } from '../engine/time'
import { Icon, Pet, Ring, Chip } from '../components/ui'

const tab = ref('activos')
const active = computed(() => state.experiments.filter((x) => x.status === 'activo'))
const done = computed(() => state.experiments.filter((x) => x.status === 'terminado'))
const method = computed(() => myMethod())
const princ = (x) => state.principles.find((p) => p.id === x.principleId)
const dayN = (x) => Math.min(x.days, -daysUntil(x.start) + 1)
const okDays = (x) => Object.values(x.logs).filter((l) => l.did).length
const today = dayKey()
const log = reactive({ felt: 3, note: '' })
const closing = ref(null)
const fin = reactive({ result: 'parcial', difficulty: 3, conclusion: '', learnings: ['', ''] })
function finish(x) { A.finishExperiment(x.id, fin.result, fin.conclusion, fin.difficulty, fin.learnings); closing.value = null; Object.assign(fin, { result: 'parcial', difficulty: 3, conclusion: '', learnings: ['', ''] }) }
const newP = ref('')
const days = (x) => Array.from({ length: x.days }, (_, i) => { const k = keyPlus(0, addDays(parseDay(x.start), i)); return { k, l: x.logs[k] } })
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <Pet pose="think" :size="86" />
      <div class="grow"><h2 style="font-size:17px">Experimentos personales 🧪</h2><p class="small">Probar ideas contigo misma para descubrir <b>tu propio método</b>.</p></div>
    </div>
    <div class="seg"><button v-for="t in [['activos', 'Activos'], ['metodo', 'Mi propio método'], ['principios', 'Principios'], ['historial', 'Historial']]" :key="t[0]" :class="{ on: tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button></div>

    <template v-if="tab === 'activos'">
      <div v-for="x in active" :key="x.id" class="card">
        <div class="row"><Ring :value="dayN(x) / x.days * 100" :size="54" label="Días del experimento">{{ dayN(x) }}/{{ x.days }}</Ring>
          <div class="grow"><div class="b">{{ x.title }}</div><div class="tiny muted">{{ princ(x)?.author }} · desde {{ shortDate(x.start) }}</div></div></div>
        <p class="small quote" style="margin-top:10px">Hipótesis: {{ x.hypothesis }}</p>
        <div class="week" style="margin-top:10px"><span v-for="d in days(x)" :key="d.k" :class="{ on: d.l?.did, today: d.k === today }" :title="d.l?.note || d.k">{{ d.l ? (d.l.did ? '✓' : '·') : '' }}</span></div>
        <div v-if="!x.logs[today]" class="card tight soft" style="margin-top:10px">
          <div class="small b">¿Lo aplicaste hoy?</div>
          <div class="small" style="margin-top:6px">¿Cómo te sentiste? {{ ['😣', '😕', '😐', '🙂', '🤩'][log.felt - 1] }}</div>
          <input type="range" min="1" max="5" v-model.number="log.felt" style="width:100%" aria-label="Cómo te sentiste" />
          <input class="input" v-model="log.note" placeholder="¿Qué pasó? ¿Qué notaste?" style="margin-top:6px" />
          <div class="row" style="gap:6px;margin-top:8px">
            <button class="btn sm primary" @click="A.logExperiment(x.id, true, log.felt, log.note); log.note = ''">Sí</button>
            <button class="btn sm ghost" @click="A.logExperiment(x.id, false, log.felt, log.note); log.note = ''">Hoy no</button>
          </div>
        </div>
        <p v-else class="small" style="margin-top:8px">Hoy: {{ x.logs[today].did ? '✓ lo aplicaste' : 'no se dio, y está bien' }}{{ x.logs[today].note ? ' — ' + x.logs[today].note : '' }}</p>
        <p class="tiny muted" style="margin-top:6px">{{ okDays(x) }} días aplicado · el modo “5 minutos” del enfoque registra este experimento automáticamente cuando aplica.</p>
        <button v-if="closing !== x.id" class="btn sm lav" style="margin-top:8px" @click="closing = x.id">{{ dayN(x) >= x.days ? 'Cerrar y sacar conclusiones' : 'Terminar antes' }}</button>
        <div v-else class="stack" style="gap:8px;margin-top:10px">
          <div class="field"><span>¿Funcionó?</span><div class="chips"><Chip v-for="r in ['funcionó', 'parcial', 'no funcionó']" :key="r" :active="fin.result === r" @click="fin.result = r">{{ r }}</Chip></div></div>
          <div class="field"><span>Dificultad (1–5): {{ fin.difficulty }}</span><input type="range" min="1" max="5" v-model.number="fin.difficulty" /></div>
          <label class="field"><span>¿Por qué? Conclusión</span><textarea class="input" v-model="fin.conclusion"></textarea></label>
          <label class="field"><span>¿Qué aprendiste de ti? (se guarda en “Mi propio método”)</span>
            <input v-for="(l, i) in fin.learnings" :key="i" class="input" v-model="fin.learnings[i]" :placeholder="['Ej: Los bloques cortos me funcionan', 'Ej: Si es muy rígido, abandono'][i]" style="margin-bottom:6px" /></label>
          <button class="btn primary" @click="finish(x)">Guardar conclusiones</button>
        </div>
      </div>
      <div class="card">
        <h3>Empezar un experimento</h3>
        <p class="tiny muted">Elige un principio de lo que estás aprendiendo:</p>
        <div class="stack" style="gap:6px;margin-top:8px">
          <button v-for="p in state.principles.filter((p) => p.status === 'idea')" :key="p.id" class="btn ghost sm" style="justify-content:flex-start;text-align:left" @click="A.startExperiment(p.id)">🧪 {{ p.text }} <span class="muted">· {{ p.author }}</span></button>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'metodo'">
      <div class="card soft">
        <h3>Mi propio método 💗</h3>
        <p class="tiny muted">Lo que tus experimentos y tus datos dicen que funciona para ti. No reglas de otras personas.</p>
        <div v-for="(m, i) in method" :key="i" class="item" style="align-items:flex-start">
          <span class="ico" :class="{ lav: m.kind === 'datos', mint: m.kind === 'principio' }">{{ m.kind === 'experimento' ? '🧪' : m.kind === 'datos' ? '📊' : '✅' }}</span>
          <div class="grow"><div class="small b">{{ m.text }}</div><div class="tiny muted">{{ m.from }}</div></div>
        </div>
        <p v-if="!method.length" class="small muted" style="margin-top:8px">Termina tu primer experimento y aquí empezará tu método.</p>
      </div>
    </template>

    <template v-else-if="tab === 'principios'">
      <div class="row"><input class="input grow" v-model="newP" placeholder="Nuevo principio en tus palabras…" /><button class="btn sm primary" @click="ui.modal = { type: 'principle', prefill: { text: newP, status: 'idea' } }; newP = ''">+</button></div>
      <div v-for="p in state.principles" :key="p.id" class="card tight row">
        <div class="grow"><div class="small b">{{ p.text }}</div><div class="tiny muted">{{ p.author }} · {{ p.tags.join(', ') }}</div></div>
        <span class="badge" :class="{ green: p.status === 'validado', red: p.status === 'descartado', pink: p.status === 'probando' }">{{ p.status }}</span>
        <button class="iconbtn" aria-label="Editar principio" @click="ui.modal = { type: 'principle', id: p.id }"><Icon name="edit" :size="15" /></button>
      </div>
    </template>

    <template v-else>
      <div v-for="x in done" :key="x.id" class="card">
        <div class="row between"><b class="small">{{ x.title }}</b><span class="badge" :class="{ green: x.result === 'funcionó', yellow: x.result === 'parcial', red: x.result === 'no funcionó' }">{{ x.result }}</span></div>
        <p class="small" style="margin-top:6px">{{ x.conclusion }}</p>
        <div v-for="l in x.learnings" :key="l" class="tiny muted">• {{ l }}</div>
      </div>
    </template>
  </div>
</template>
