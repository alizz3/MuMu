<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { state, ui, startClean, resetToSeed, exportJSON } from '../store'
import { hasFirebase, signIn, signOut } from '../services/firebase'
import * as API from '../services/api'
import { askBrowserPermission } from '../engine/notify'
import { installApp } from '../services/pwa'
import AulaStatus from '../components/AulaStatus.vue'
import { setModoU } from '../engine/modoU'
import { BRAND } from '../config/brand'
import { toast, ask } from '../engine/game'
import { Icon, Pet, Chip } from '../components/ui'

const tab = ref('cuentas')
const backendOk = computed(() => API.canUseBackend())
const FB_ERR = {
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase. Agrégalo en Authentication → Settings → Dominios autorizados.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio.',
  'auth/operation-not-allowed': 'El inicio con Google no está activado en Firebase (Authentication → Sign-in method).',
}
const err = (e) => toast(FB_ERR[e?.code] || e?.message || String(e))

// Google
const g = reactive({ label: 'personal', services: ['gmail', 'calendar'] })
const SERVICES = [
  ['gmail', 'Gmail (solo lectura)', 'Leer correos para detectar los importantes. No puede enviar ni borrar.'],
  ['gmail-organize', 'Organizar Gmail', 'Mandar a la papelera, poner etiquetas y estrella a tus profes. Sigue sin poder enviar correos.'],
  ['calendar', 'Google Calendar (solo lectura)', 'Ver tus eventos para calcular tiempo libre.'],
  ['calendar-write', 'Calendar: crear eventos', 'Opcional: crear bloques de estudio en tu calendario.'],
  ['classroom', 'Classroom (solo lectura)', 'Ver cursos, tareas, anuncios y materiales.'],
  ['drive', 'Google Drive (solo lectura)', 'Ver las carpetas y archivos de tus materias dentro de MuMu. No puede borrar ni cambiar nada.'],
  ['tasks', 'Google Tasks', 'Traer tus listas de tareas, crear tareas nuevas y marcarlas hechas.'],
]
const adding = ref(false)
const cals = ref([]), calBusy = ref(false), calLink = ref('')
const gtBusyUi = ref(false)
async function gtNow() { gtBusyUi.value = true; try { await API.syncGTasks() } catch (e) { err(e) } finally { gtBusyUi.value = false } }
async function loadCals(a) { calBusy.value = true; try { cals.value = await API.listCalendars(a.id) } catch (e) { err(e) } finally { calBusy.value = false } }
function toggleCal(a, id, on) { const cur = API.calendarsOf(a.id); API.setCalendars(a.id, on ? [...cur, id] : cur.filter((x) => x !== id)) }
function addCalLink(a) {
  const id = API.calendarIdFromLink(calLink.value)
  if (!id) return toast('No reconocí ese enlace. Cópialo desde Google Calendar → Configuración del calendario → Integrar calendario.')
  toggleCal(a, id, true); calLink.value = ''; toast('Calendario agregado. Sincroniza desde Agenda → Google.')
}
const sel = ref(null)
const extra = ref([])
const openAdd = () => { g.label = 'personal'; g.services = ['gmail', 'calendar']; adding.value = true }
const has = (a) => SERVICES.filter((s) => a.services.includes(s[0]))
const missing = (a) => SERVICES.filter((s) => !a.services.includes(s[0]))
const toggleExtra = (k) => (extra.value = extra.value.includes(k) ? extra.value.filter((x) => x !== k) : [...extra.value, k])
watch(sel, () => { extra.value = []; cals.value = [] })
async function disconnect(a) { if (await ask(`¿Desconectar ${a.email}? Se revocan todos los permisos en Google.`)) { await API.disconnectGoogle(a.id).catch(err); sel.value = null } }
const toggleSvc = (s) => (g.services = g.services.includes(s) ? g.services.filter((x) => x !== s) : [...g.services, s])
// Se piden las cuentas cuando ya cargaron tus datos, para que la sincronización no las borre de la vista
const loadingAcc = ref(false)
async function loadAccounts() { loadingAcc.value = true; try { await API.refreshAccounts() } catch (e) { err(e) } finally { loadingAcc.value = false } }
watch(() => backendOk.value && ui.synced, (ok) => { if (ok) loadAccounts() }, { immediate: true })
const SVC_LABEL = { gmail: 'Gmail', 'gmail-organize': 'Organizar Gmail', calendar: 'Calendar (lectura)', 'calendar-write': 'Calendar (crear eventos)', classroom: 'Classroom', tasks: 'Google Tasks', drive: 'Google Drive' }

// Tu Aula
const aula = reactive({ site: state.integrations.aula.site || BRAND.aulaSite, method: 'webservice', username: '', password: '', icalUrl: '' })
const connecting = ref(false)
async function connectAula() {
  connecting.value = true
  try {
    const payload = aula.method === 'webservice' ? { site: aula.site, method: 'webservice', username: aula.username, password: aula.password } : { site: aula.site, method: 'ical', icalUrl: aula.icalUrl }
    await API.connectAula(payload)
    aula.password = ''
    await API.syncAula()
  } catch (e) { err(e) } finally { aula.password = ''; connecting.value = false }
}
const clean = async () => (await ask('Se borran los datos de ejemplo (tareas, correos, registros) y quedan tus hábitos, objetivos, rutinas y principios. ¿Continuar?')) && startClean()
const reset = async () => (await ask('¿Volver a cargar los datos de ejemplo? Se reemplaza todo.')) && resetToSeed()
const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })); a.download = `${state.settings.appName.replace(/\s+/g, '-').toLowerCase()}-respaldo.json`; a.click() }
</script>

<template>
  <div class="stack">
    <div class="chips"><Chip v-for="t in [['cuentas', 'Cuentas'], ['integraciones', 'Integraciones'], ['notif', 'Notificaciones'], ['apariencia', 'Apariencia'], ['privacidad', 'Privacidad']]" :key="t[0]" :active="tab === t[0]" @click="tab = t[0]">{{ t[1] }}</Chip></div>

    <p v-if="!ui.backend" class="notice"><Icon name="shield" :size="18" />Estás en <b>modo local</b>: todo funciona y se guarda en este navegador. Las integraciones (Google, Tu Aula, IA, finanzas) se activan cuando la app está desplegada con su servidor en Vercel (instrucciones en el README).</p>

    <!-- Cuentas -->
    <template v-if="tab === 'cuentas'">
      <div class="card">
        <h3>Tu cuenta de {{ state.settings.appName }}</h3>
        <div v-if="ui.user" class="row" style="margin-top:10px"><img v-if="ui.user.photo" :src="ui.user.photo" alt="" width="38" height="38" style="border-radius:50%" /><div class="grow small"><b>{{ ui.user.name }}</b><div class="tiny muted">{{ ui.user.email }} · tus datos se sincronizan en Firebase</div></div><button class="btn sm ghost" @click="signOut">Salir</button></div>
        <div v-else style="margin-top:10px">
          <p class="small muted">Inicia sesión con Google para guardar tus datos en la nube y usarlos en el celular y el computador.</p>
          <button class="btn primary" style="margin-top:8px" :disabled="!hasFirebase()" @click="signIn().catch(err)">Entrar con Google</button>
          <p v-if="!hasFirebase()" class="tiny muted" style="margin-top:6px">Falta configurar Firebase (VITE_FIREBASE_*).</p>
        </div>
      </div>

      <div class="card">
        <div class="row between">
          <h3>Apps conectadas</h3>
          <button v-if="backendOk" class="iconbtn" :disabled="loadingAcc" aria-label="Actualizar cuentas" @click="loadAccounts"><Icon name="refresh" :size="17" /></button>
        </div>
        <button class="btn primary block" style="margin-top:10px" :disabled="!backendOk" @click="openAdd"><Icon name="plus" :size="16" />Agregar cuenta de Google</button>
        <p v-if="!backendOk" class="tiny muted" style="margin-top:6px">Necesita el servidor desplegado y haber iniciado sesión.</p>
        <p v-else-if="!state.integrations.google.length && !loadingAcc" class="small muted" style="margin-top:10px">Aún no hay cuentas conectadas.</p>
        <div class="list" style="margin-top:6px">
          <button v-for="a in state.integrations.google" :key="a.id" class="item" style="all:unset;display:flex;gap:12px;align-items:center;padding:12px 2px;border-bottom:1px solid var(--line);cursor:pointer" @click="sel = a">
            <span class="ico" :class="{ lav: a.label === 'universidad' }"><Icon name="mail" :size="17" /></span>
            <div class="grow" style="min-width:0"><div class="small b">{{ a.email }}</div><div class="tiny muted">{{ a.label }} · {{ a.services.length }} de {{ SERVICES.length }} permisos</div></div>
            <Icon name="chev" :size="16" />
          </button>
        </div>
        <p class="tiny muted" style="margin-top:10px">Se usa el inicio de sesión oficial de Google: nunca vemos ni guardamos tu contraseña.</p>
      </div>

      <!-- Agregar cuenta -->
      <div v-if="adding" class="scrim" @click.self="adding = false">
        <div class="sheet stack" role="dialog" aria-modal="true" aria-label="Agregar cuenta de Google">
          <div class="grab"></div>
          <div class="row between"><h2>Agregar cuenta</h2><button class="iconbtn" aria-label="Cerrar" @click="adding = false"><Icon name="x" /></button></div>
          <div class="field"><span>¿Qué cuenta es?</span><div class="chips"><Chip v-for="l in ['personal', 'universidad', 'trabajo']" :key="l" :active="g.label === l" @click="g.label = l">{{ l }}</Chip></div></div>
          <div class="field"><span>Permisos (puedes cambiarlos después)</span>
            <label v-for="s in SERVICES" :key="s[0]" class="row small" style="align-items:flex-start;padding:5px 0"><input type="checkbox" :checked="g.services.includes(s[0])" @change="toggleSvc(s[0])" style="margin-top:3px" /><span><b>{{ s[1] }}</b><br /><span class="tiny muted">{{ s[2] }}</span></span></label>
          </div>
          <button class="btn primary" :disabled="!g.services.length" @click="API.connectGoogle(g.label, g.services).catch(err)">Continuar con Google</button>
        </div>
      </div>

      <!-- Detalle de una cuenta -->
      <div v-if="sel" class="scrim" @click.self="sel = null">
        <div class="sheet stack" role="dialog" aria-modal="true" :aria-label="`Cuenta ${sel.email}`">
          <div class="grab"></div>
          <div class="row"><span class="ico" :class="{ lav: sel.label === 'universidad' }"><Icon name="mail" /></span>
            <div class="grow" style="min-width:0"><div class="b">{{ sel.email }}</div><div class="tiny muted">{{ sel.label }}{{ sel.connectedAt ? ' · conectada el ' + new Date(sel.connectedAt).toLocaleDateString('es-CO') : '' }}</div></div>
            <button class="iconbtn" aria-label="Cerrar" @click="sel = null"><Icon name="x" /></button></div>
          <div v-if="has(sel).length">
            <div class="tiny b muted">TIENE PERMISO</div>
            <div v-for="s in has(sel)" :key="s[0]" class="item"><span class="badge green" aria-label="Activo"><Icon name="check" :size="13" :stroke="2.6" /></span><div class="grow small"><b>{{ s[1] }}</b><div class="tiny muted">{{ s[2] }}</div></div></div>
          </div>
          <div v-if="missing(sel).length">
            <div class="tiny b muted">LE FALTA</div>
            <label v-for="s in missing(sel)" :key="s[0]" class="item" style="cursor:pointer"><input type="checkbox" :checked="extra.includes(s[0])" @change="toggleExtra(s[0])" /><div class="grow small"><b>{{ s[1] }}</b><div class="tiny muted">{{ s[2] }}</div></div></label>
            <button class="btn primary block" style="margin-top:10px" :disabled="!extra.length" @click="API.connectGoogle(sel.label, [...sel.services, ...extra], sel.email).catch(err)">Dar {{ extra.length || '' }} permiso{{ extra.length === 1 ? '' : 's' }} más</button>
          </div>
          <p v-else class="small muted">Esta cuenta ya tiene todos los permisos.</p>
          <div v-if="sel.services.includes('tasks')" class="card tight soft stack" style="gap:8px">
            <b class="small wi"><Icon name="check" :size="15" />Google Tasks</b>
            <label class="field"><span>Esta cuenta es para</span>
              <select class="input" v-model="API.gtConf(sel).role"><option value="universidad">Tareas de la universidad</option><option value="personal">Tareas personales</option></select></label>
            <label v-if="API.gtConf(sel).lists.length" class="field"><span>Lista para tareas nuevas {{ API.gtConf(sel).role === 'universidad' ? 'sin materia' : '' }}</span>
              <select class="input" v-model="API.gtConf(sel).defaultList"><option value="@default">Mis tareas (la principal)</option><option v-for="l in API.gtConf(sel).lists" :key="l.id" :value="l.id">{{ l.title }}</option></select></label>
            <p class="tiny muted">{{ API.gtConf(sel).role === 'universidad' ? 'Las tareas de cada materia se crean en la lista que tenga su nombre (ej. "2. Elementos de Programación…").' : 'Las tareas personales que crees en MuMu se crean aquí.' }} Lo que marques hecho en un lado queda hecho en el otro.</p>
            <button class="btn sm lav" :disabled="gtBusyUi" @click="gtNow">{{ gtBusyUi ? 'Sincronizando…' : 'Sincronizar ahora' }}</button>
          </div>
          <div v-if="sel.services.includes('calendar')" class="card tight soft stack" style="gap:8px">
            <div class="row between"><b class="small wi"><Icon name="calendar" :size="15" />Calendarios que MuMu lee</b><button class="btn sm ghost" :disabled="calBusy" @click="loadCals(sel)">{{ calBusy ? '…' : 'Ver mis calendarios' }}</button></div>
            <label v-for="c in cals" :key="c.id" class="row small" style="gap:8px"><input type="checkbox" :checked="API.calendarsOf(sel.id).includes(c.primary ? 'primary' : c.id)" @change="toggleCal(sel, c.primary ? 'primary' : c.id, $event.target.checked)" /><i :style="{ background: c.color, width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' }"></i>{{ c.name }}{{ c.primary ? ' (principal)' : '' }}</label>
            <div v-for="id in API.calendarsOf(sel.id).filter((x) => x !== 'primary' && !cals.some((c) => c.id === x))" :key="id" class="row small" style="gap:8px"><input type="checkbox" checked @change="toggleCal(sel, id, false)" /><span class="tiny">{{ id.length > 40 ? id.slice(0, 38) + '…' : id }}</span></div>
            <div class="row"><input class="input" v-model="calLink" placeholder="Pega un enlace de Google Calendar (…?cid=…)" aria-label="Enlace de calendario" /><button class="btn sm lav" @click="addCalLink(sel)">Agregar</button></div>
            <p class="tiny muted">Los eventos que ya son tareas (Tu Aula, Classroom) o que se repiten en varios calendarios no se duplican.</p>
          </div>
          <button class="btn ghost" @click="disconnect(sel)"><Icon name="trash" :size="15" />Desconectar y quitar todos los permisos</button>
        </div>
      </div>
    </template>

    <!-- Integraciones -->
    <template v-if="tab === 'integraciones'">
      <div class="card stack">
        <div class="row"><span class="ico lav"><Icon name="cap" /></span><div class="grow"><h3>Tu Aula · Universidad del Tolima</h3><div class="tiny muted">Estado: {{ state.integrations.aula.status }}{{ state.integrations.aula.lastSync ? ' · última revisión ' + new Date(state.integrations.aula.lastSync).toLocaleString('es-CO') : '' }}</div></div></div>
        <AulaStatus />
        <p v-if="ui.aulaStatus && ui.aulaStatus.online === false" class="notice">Tu Aula está caída ahora mismo. Mejor espera a que vuelva antes de conectarla.</p>
        <label class="field"><span>Dirección de Tu Aula (la que abres en el navegador)</span><input class="input" v-model="aula.site" placeholder="https://…" inputmode="url" /></label>
        <div class="seg"><button :class="{ on: aula.method === 'webservice' }" @click="aula.method = 'webservice'">Usuario y contraseña</button><button :class="{ on: aula.method === 'ical' }" @click="aula.method = 'ical'">Enlace de calendario</button></div>
        <template v-if="aula.method === 'webservice'">
          <p class="tiny muted">Tu contraseña viaja cifrada (HTTPS) al servidor, que la usa <b>una sola vez</b> para pedirle a Moodle un token de su servicio para apps (el mismo que usa la app oficial “Moodle”). Se guarda solo ese token, cifrado. La contraseña no se guarda, no se registra en logs y nunca queda en el navegador.</p>
          <label class="field"><span>Usuario de Tu Aula</span><input class="input" v-model="aula.username" autocomplete="username" /></label>
          <label class="field"><span>Contraseña</span><input class="input" type="password" v-model="aula.password" autocomplete="current-password" /></label>
        </template>
        <template v-else>
          <p class="tiny muted">Sin contraseña: en Tu Aula ve a <b>Calendario → Exportar calendario</b>, elige “Todos los cursos” y “Eventos recientes y próximos”, pulsa “Obtener URL del calendario” y pégala aquí. Trae entregas y fechas (no anuncios).</p>
          <label class="field"><span>URL de exportación del calendario</span><input class="input" v-model="aula.icalUrl" placeholder="https://…/calendar/export_execute.php?…" /></label>
        </template>
        <div class="row" style="gap:6px">
          <button class="btn primary" :disabled="!backendOk || connecting || !aula.site" @click="connectAula">{{ connecting ? 'Conectando…' : 'Conectar y revisar' }}</button>
          <button v-if="state.integrations.aula.status === 'conectado'" class="btn ghost" @click="API.disconnectAula().catch(err)">Desconectar</button>
        </div>
      </div>

      <div class="card row"><span class="ico"><Icon name="cap" /></span><div class="grow"><b class="small">Google Classroom</b><div class="tiny muted">Se activa al conectar una cuenta de Google con el permiso de Classroom (pestaña Cuentas).</div></div>
        <button class="btn sm lav" :disabled="!backendOk" @click="API.syncClassroom().catch(err)">Revisar</button></div>
      <div class="card stack"><div class="row"><span class="ico"><Icon name="mail" /></span><div class="grow"><b class="small">Gmail y Calendar</b><div class="tiny muted">Por cuenta de Google (pestaña Cuentas). Se revisan desde Correo y Agenda.</div></div></div>
        <label class="row small"><input type="checkbox" :checked="state.settings.mail?.starProfes !== false" @change="state.settings.mail = { ...(state.settings.mail || {}), starProfes: $event.target.checked }" /> Poner estrella en Gmail a los correos de mis profes</label>
        <label class="row small"><input type="checkbox" :checked="state.settings.mail?.labelProfes !== false" @change="state.settings.mail = { ...(state.settings.mail || {}), labelProfes: $event.target.checked }" /> Ponerles la etiqueta “MuMu/Profes”</label>
        <p class="tiny muted">Los correos de tus profes se reconocen por el correo que tiene cada materia (Universidad → Materias). Necesita el permiso “Organizar Gmail”.</p>
      </div>
      <div class="card row"><span class="ico cream"><Icon name="book" /></span><div class="grow"><b class="small">Platzi</b><div class="tiny muted">Registro manual: Platzi no tiene API pública para tu progreso.</div></div></div>
      <div class="card stack">
        <div class="row"><span class="ico mint"><Icon name="wallet" /></span><div class="grow"><b class="small">{{ state.settings.financeAppName }}</b><div class="tiny muted">Resumen compartido servidor a servidor (FINANCE_API_URL + FINANCE_API_KEY).</div></div></div>
        <label class="field"><span>URL de la app de finanzas (para el botón “Abrir”)</span><input class="input" v-model="state.settings.financeAppUrl" placeholder="https://…" /></label>
      </div>
    </template>

    <!-- Notificaciones -->
    <template v-if="tab === 'notif'">
      <div class="card stack">
        <h3>¿Qué te aviso?</h3>
        <label v-for="n in [['aula', 'Tareas nuevas o cambios en Aula/Classroom'], ['email', 'Correos importantes'], ['freeTime', 'Cuando tengo tiempo libre'], ['classes', 'Clase en 30 minutos'], ['habits', 'Hábitos pendientes (8 p. m.)']]" :key="n[0]" class="row small"><input type="checkbox" v-model="state.settings.notify[n[0]]" /> {{ n[1] }}</label>
        <div class="grid2"><label class="field"><span>Silencio desde</span><input class="input" type="time" v-model="state.settings.notify.quiet[0]" /></label><label class="field"><span>hasta</span><input class="input" type="time" v-model="state.settings.notify.quiet[1]" /></label></div>
        <button class="btn lav" @click="askBrowserPermission().then((r) => toast(r === 'granted' ? 'Notificaciones del navegador activadas' : 'No se activaron (' + r + ')'))">Permitir notificaciones del navegador</button>
        <p class="tiny muted">Una web solo puede notificarte dentro de la app o como notificación del navegador. No puede aparecer encima de otras apps del celular.</p>
      </div>
    </template>

    <!-- Apariencia -->
    <template v-if="tab === 'apariencia'">
      <div class="card stack">
        <label class="field"><span>Nombre de la app (provisional, cámbialo cuando quieras)</span><input class="input" v-model="state.settings.appName" /></label>
        <label class="field"><span>¿Cómo te llamo?</span><input class="input" v-model="state.settings.ownerName" /></label>
        <label class="field"><span>Nombre de la app de finanzas</span><input class="input" v-model="state.settings.financeAppName" /></label>
        <div class="field"><span>Tema</span><div class="seg"><button v-for="t in [['auto', 'Automático'], ['light', 'Clarito'], ['dark', 'Oscuro']]" :key="t[0]" :class="{ on: state.settings.theme === t[0] }" @click="state.settings.theme = t[0]">{{ t[1] }}</button></div></div>
        <label class="row small" style="gap:10px;align-items:flex-start"><input type="checkbox" :checked="ui.modoU" @change="setModoU($event.target.checked)" style="margin-top:3px" /><span><b class="wi"><Icon name="cap" :size="15" />Modo U</b><br /><span class="tiny muted">Muestra solo tareas, clases, correos y metas de la universidad. Se activa solo cuando entras con tu cuenta @{{ BRAND.uniDomain }}; puedes apagarlo aquí o con el birrete de arriba.</span></span></label>
        <div class="field"><span>App en tu celular o computador</span>
          <p v-if="ui.installed" class="small wi"><Icon name="check" :size="15" />MuMu ya está instalada como app.</p>
          <button v-else-if="ui.installPrompt" class="btn lav" @click="installApp"><Icon name="download" :size="16" />Instalar MuMu</button>
          <p v-else class="tiny muted">{{ ui.isIOS ? 'En iPhone: Compartir → "Agregar a inicio".' : 'En Chrome: menú ⋮ → "Instalar MuMu" (o "Agregar a pantalla de inicio").' }}</p>
        </div>
        <div class="row"><Pet :size="70" /><div class="grow small">Los accesorios de la vaquita y la decoración se cambian en la casita.</div><button class="btn sm lav" @click="ui.route = 'casa'">Ir</button></div>
      </div>
    </template>

    <!-- Privacidad -->
    <template v-if="tab === 'privacidad'">
      <div class="card stack small">
        <h3>Dónde viven tus datos</h3>
        <p>• <b>Modo local:</b> en este navegador.<br />• <b>Con sesión:</b> en tu Firebase (solo tú puedes leerlos, por las reglas de seguridad).<br />• <b>Tokens de Google y de Tu Aula:</b> cifrados en el servidor, nunca en el navegador.<br />• <b>Contraseñas:</b> no se guardan en ningún lado.</p>
        <button class="btn lav" @click="download">Descargar respaldo (JSON)</button>
        <button class="btn ghost" @click="clean">Empezar en limpio (quitar ejemplos)</button>
        <button class="btn ghost" @click="reset">Restaurar datos de ejemplo</button>
      </div>
    </template>
  </div>
</template>
