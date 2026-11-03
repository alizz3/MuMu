<script setup>
// Búsqueda de empleo: CRM de vacantes y postulaciones (etapas 1 y 2 del agente de empleo).
// Reglas sin IA: evita duplicados, marca seguimientos por días hábiles y alerta ofertas sospechosas.
import { computed, reactive, ref } from 'vue'
import { state } from '../store'
import { toast, ask } from '../engine/game'
import { Icon } from '../components/ui'

if (!state.jobs) state.jobs = { apps: [] }
const apps = computed(() => state.jobs.apps)
const STATES = ['Encontrada', 'Pendiente de revisión', 'Lista para postular', 'Postulada', 'En proceso', 'Entrevista programada', 'Prueba técnica', 'Esperando respuesta', 'Rechazada', 'Sin respuesta', 'Oferta recibida', 'Contratada']
const ACTIVE = ['Postulada', 'En proceso', 'Entrevista programada', 'Prueba técnica', 'Esperando respuesta']
const TONE = { Rechazada: 'red', 'Sin respuesta': '', 'Oferta recibida': 'green', Contratada: 'green', 'Entrevista programada': 'pink', 'Prueba técnica': 'pink' }
const today = () => new Date().toISOString().slice(0, 10)
const fmt = (d) => (d ? new Date(d + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '')
// Días hábiles (lunes a viernes) desde una fecha
function bizDays(from) { if (!from) return 0; let n = 0; const d = new Date(from + 'T12:00'), end = new Date(today() + 'T12:00'); while (d < end) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n++ } return n }
// Señales de fraude o de condiciones que no te sirven
const RED = /(consign|pag(a|ar|o) (por|para) (la )?(inscripci|capacitaci|entrevista|proceso)|cuota de ingreso|kit de inicio|multinivel|inversi[oó]n inicial)/i
const SAT = /s[aá]bado/i
function flags(a) { const t = `${a.role} ${a.company} ${a.schedule} ${a.requirements} ${a.notes}`; return [RED.test(t) && 'Pide dinero o parece sospechosa: no envíes datos', SAT.test(a.schedule || '') && !/no (trabaja|incluye) s[aá]bados|lunes a viernes/i.test(a.schedule || '') && 'Revisa el horario: menciona sábados'].filter(Boolean) }
const follow = (a) => { if (!['Postulada', 'Esperando respuesta'].includes(a.status)) return null; const n = bizDays(a.appliedAt); return n >= 7 ? { level: 'red', text: `${n} días hábiles sin respuesta: haz seguimiento` } : n >= 3 ? { level: 'yellow', text: `${n} días hábiles: evalúa un seguimiento` } : null }

const stats = computed(() => {
  const c = (f) => apps.value.filter(f).length
  return [['Encontradas', apps.value.length, 'search'], ['Postuladas', c((a) => !!a.appliedAt), 'check'], ['Activos', c((a) => ACTIVE.includes(a.status)), 'clock'], ['Entrevistas', c((a) => a.status === 'Entrevista programada'), 'chat'], ['Ofertas', c((a) => ['Oferta recibida', 'Contratada'].includes(a.status)), 'star'], ['Rechazos', c((a) => a.status === 'Rechazada'), 'x'], ['Sin respuesta', c((a) => a.status === 'Sin respuesta'), 'hourglass']]
})
const todo = computed(() => apps.value.map((a) => ({ a, f: follow(a) })).filter((x) => x.f || x.a.nextAction).sort((x, y) => (x.f?.level === 'red' ? -1 : 1)))
const filter = ref('todas')
const FILTERS = [['todas', 'Todas'], ['nuevas', 'Por revisar'], ['activas', 'En proceso'], ['cerradas', 'Cerradas']]
const list = computed(() => apps.value.filter((a) => filter.value === 'todas' || (filter.value === 'nuevas' ? ['Encontrada', 'Pendiente de revisión', 'Lista para postular'].includes(a.status) : filter.value === 'activas' ? ACTIVE.includes(a.status) : ['Rechazada', 'Sin respuesta', 'Oferta recibida', 'Contratada'].includes(a.status))).slice().sort((a, b) => ((b.updatedAt || 0) - (a.updatedAt || 0))))

// Formulario
const EMPTY = { company: '', role: '', mode: 'Remoto', salary: '', foundAt: '', appliedAt: '', url: '', status: 'Encontrada', contact: '', nextAction: '', schedule: '', requirements: '', notes: '' }
const form = ref(null)
const f = reactive({ ...EMPTY })
function edit(a = null) { Object.assign(f, EMPTY, a || { foundAt: today() }); form.value = a ? a.id : 'new' }
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, ' ').trim()
function save() {
  if (!f.company.trim() || !f.role.trim()) return toast('Escribe la empresa y el cargo')
  const dup = apps.value.find((a) => a.id !== form.value && ((f.url && a.url === f.url.trim()) || (norm(a.company) === norm(f.company) && norm(a.role) === norm(f.role))))
  if (dup) return toast(`Ya la tienes registrada: ${dup.role} en ${dup.company}`)
  if (['Postulada', 'Esperando respuesta', 'En proceso'].includes(f.status) && !f.appliedAt) f.appliedAt = today()
  const data = { ...f, company: f.company.trim(), role: f.role.trim(), url: /^https?:\/\//.test(f.url.trim()) ? f.url.trim() : '', updatedAt: Date.now() }
  if (form.value === 'new') apps.value.unshift({ id: 'job_' + Math.random().toString(36).slice(2, 10), createdAt: Date.now(), log: [{ at: today(), text: `Registrada: ${data.status}` }], ...data })
  else { const a = apps.value.find((x) => x.id === form.value); if (a.status !== data.status) (a.log ||= []).push({ at: today(), text: `${a.status} → ${data.status}` }); Object.assign(a, data) }
  form.value = null; toast('Guardado')
}
async function remove() { if (await ask('¿Borrar esta vacante?')) { state.jobs.apps = apps.value.filter((a) => a.id !== form.value); form.value = null } }
function setStatus(a, s) { if (a.status === s) return; (a.log ||= []).push({ at: today(), text: `${a.status} → ${s}` }); if (s === 'Postulada' && !a.appliedAt) a.appliedAt = today(); a.status = s; a.updatedAt = Date.now() }
</script>

<template>
  <div class="stack emp">
    <p class="small muted">Tu tablero de búsqueda: registra vacantes, postula y MuMu te avisa cuándo hacer seguimiento. Nada se envía sin ti.</p>
    <div class="kpis"><div v-for="s in stats" :key="s[0]" class="card kpi2"><Icon :name="s[2]" :size="16" class="muted" /><b>{{ s[1] }}</b><span class="tiny muted">{{ s[0] }}</span></div></div>

    <section class="card">
      <h3 class="wi"><Icon name="bell" :size="16" />Pendientes</h3>
      <button v-for="x in todo" :key="x.a.id" class="lrow" @click="edit(x.a)"><span class="dot" :class="x.f?.level || 'pink'"></span><span class="grow" style="min-width:0"><span class="small b" style="display:block">{{ x.a.role }} · {{ x.a.company }}</span><span class="tiny muted">{{ x.f?.text || x.a.nextAction }}</span></span><Icon name="chev" :size="14" class="muted" /></button>
      <p v-if="!todo.length" class="small muted" style="margin-top:6px">Nada pendiente. Cuando postules, aquí aparecen los seguimientos (a los 3 y a los 7 días hábiles).</p>
    </section>

    <div class="row between"><div class="chips"><button v-for="c in FILTERS" :key="c[0]" :class="{ on: filter === c[0] }" @click="filter = c[0]">{{ c[1] }}</button></div><button class="btn sm primary" @click="edit()"><Icon name="plus" :size="14" />Vacante</button></div>

    <section v-for="a in list" :key="a.id" class="card jcard" @click="edit(a)">
      <div class="row between" style="gap:8px;align-items:flex-start"><div style="min-width:0"><b class="small">{{ a.role }}</b><div class="tiny muted">{{ [a.company, a.mode, a.salary].filter(Boolean).join(' · ') }}</div></div><span class="chip-st" :class="TONE[a.status] ?? 'lav'">{{ a.status }}</span></div>
      <div class="tiny muted" style="margin-top:4px">{{ a.appliedAt ? `Postulada ${fmt(a.appliedAt)}` : a.foundAt ? `Encontrada ${fmt(a.foundAt)}` : '' }}{{ a.nextAction ? ` · Siguiente: ${a.nextAction}` : '' }}</div>
      <p v-for="w in flags(a)" :key="w" class="tiny tred wi" style="margin-top:4px"><Icon name="info" :size="12" />{{ w }}</p>
      <div class="row wrap" style="gap:6px;margin-top:8px" @click.stop>
        <a v-if="a.url" class="btn sm ghost" :href="a.url" target="_blank" rel="noopener">Ver vacante ↗</a>
        <select class="persel" :value="a.status" aria-label="Estado" @change="setStatus(a, $event.target.value)"><option v-for="s in STATES" :key="s">{{ s }}</option></select>
      </div>
    </section>
    <div v-if="!list.length" class="card empty"><Icon name="target" :size="28" /><b>{{ apps.length ? 'Nada en este filtro' : 'Empieza tu búsqueda' }}</b><span class="tiny muted">Pega cada vacante que encuentres. Luego MuMu la buscará por ti.</span><button class="btn primary sm" @click="edit()">Agregar vacante</button></div>

    <div v-if="form" class="pv" role="dialog" aria-modal="true" aria-label="Vacante" @click.self="form = null">
      <div class="pbox">
        <div class="row between"><h2 style="margin:0;font-size:18px">{{ form === 'new' ? 'Nueva vacante' : 'Vacante' }}</h2><button class="iconbtn" aria-label="Cerrar" @click="form = null"><Icon name="x" :size="18" /></button></div>
        <div class="grid2"><label class="field"><span>Empresa</span><input class="input" v-model="f.company" /></label><label class="field"><span>Cargo</span><input class="input" v-model="f.role" /></label></div>
        <div class="grid2"><label class="field"><span>Modalidad</span><select class="input" v-model="f.mode"><option>Remoto</option><option>Híbrido</option><option>Presencial</option></select></label><label class="field"><span>Salario</span><input class="input" v-model="f.salary" placeholder="Si lo publican" /></label></div>
        <div class="grid2"><label class="field"><span>Estado</span><select class="input" v-model="f.status"><option v-for="s in STATES" :key="s">{{ s }}</option></select></label><label class="field"><span>Fecha de postulación</span><input class="input" type="date" v-model="f.appliedAt" /></label></div>
        <label class="field"><span>Enlace de la vacante</span><input class="input" type="url" v-model="f.url" placeholder="https://…" /></label>
        <label class="field"><span>Horario</span><input class="input" v-model="f.schedule" placeholder="Ej. lunes a viernes 6 a. m. – 2 p. m." /></label>
        <label class="field"><span>Requisitos</span><textarea class="input" rows="2" v-model="f.requirements"></textarea></label>
        <div class="grid2"><label class="field"><span>Contacto / reclutador</span><input class="input" v-model="f.contact" placeholder="Correo o nombre" /></label><label class="field"><span>Siguiente acción</span><input class="input" v-model="f.nextAction" placeholder="Ej. enviar hoja de vida" /></label></div>
        <label class="field"><span>Observaciones</span><textarea class="input" rows="2" v-model="f.notes"></textarea></label>
        <p v-for="w in flags(f)" :key="w" class="tiny tred wi"><Icon name="info" :size="12" />{{ w }}</p>
        <div v-if="form !== 'new'" class="tiny muted"><b>Historial:</b> <span v-for="(l, i) in apps.find((a) => a.id === form)?.log || []" :key="i">{{ fmt(l.at) }} {{ l.text }}<template v-if="i < (apps.find((a) => a.id === form)?.log.length || 0) - 1"> · </template></span></div>
        <div class="row" style="gap:8px;margin-top:6px"><button class="btn primary" @click="save">Guardar</button><button v-if="form !== 'new'" class="btn ghost" style="color:var(--danger)" @click="remove">Borrar</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.kpi2 { display: flex; flex-direction: column; gap: 2px; padding: 12px; }
.kpi2 b { font-size: 22px; }
.lrow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--line); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--pink-500); } .dot.red { background: var(--danger); } .dot.yellow { background: var(--warn); }
.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.chips button { flex: none; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 13px; padding: 7px 12px; border-radius: 999px; cursor: pointer; }
.chips button.on { background: var(--pink-100); border-color: var(--pink-200); color: var(--pink-700); font-weight: 600; }
.jcard { cursor: pointer; }
.chip-st { font-size: 11.5px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: var(--lav-100); color: var(--lav-700); white-space: nowrap; }
.chip-st.green { background: color-mix(in srgb, var(--ok) 16%, var(--surface)); color: var(--mint-700); } .chip-st.red { background: color-mix(in srgb, var(--danger) 14%, var(--surface)); color: var(--danger); } .chip-st.pink { background: var(--pink-100); color: var(--pink-700); }
.tred { color: var(--danger); }
.persel { border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 999px; }
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 24px 16px; color: var(--muted); } .empty b { color: var(--ink); }
.pv { position: fixed; inset: 0; z-index: 80; background: rgba(20, 12, 24, .5); display: grid; place-items: center; padding: 12px; }
.pbox { width: min(560px, 100%); max-height: 92dvh; overflow-y: auto; background: var(--surface); border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
</style>
