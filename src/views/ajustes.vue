<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { state, ui, startClean, resetToSeed, exportJSON } from '../store'
import { hasFirebase, signIn, signOut } from '../services/firebase'
import * as API from '../services/api'
import { askBrowserPermission } from '../engine/notify'
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
  ['calendar', 'Google Calendar (solo lectura)', 'Ver tus eventos para calcular tiempo libre.'],
  ['calendar-write', 'Calendar: crear eventos', 'Opcional: crear bloques de estudio en tu calendario.'],
  ['classroom', 'Classroom (solo lectura)', 'Ver cursos y tareas asignadas.'],
]
const toggleSvc = (s) => (g.services = g.services.includes(s) ? g.services.filter((x) => x !== s) : [...g.services, s])
// Se piden las cuentas cuando ya cargaron tus datos, para que la sincronización no las borre de la vista
const loadingAcc = ref(false)
async function loadAccounts() { loadingAcc.value = true; try { await API.refreshAccounts() } catch (e) { err(e) } finally { loadingAcc.value = false } }
watch(() => backendOk.value && ui.synced, (ok) => { if (ok) loadAccounts() }, { immediate: true })
const SVC_LABEL = { gmail: 'Gmail', calendar: 'Calendar (lectura)', 'calendar-write': 'Calendar (crear eventos)', classroom: 'Classroom' }

// Tu Aula
const aula = reactive({ site: state.integrations.aula.site || '', method: 'webservice', username: '', password: '', icalUrl: '' })
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
        <h3>Cuentas de Google conectadas</h3>
        <div class="row between"><p class="tiny muted">Puedes conectar varias (personal, universidad…). Se usa OAuth oficial de Google: nunca vemos ni guardamos tu contraseña.</p>
          <button v-if="backendOk" class="btn sm ghost" :disabled="loadingAcc" @click="loadAccounts"><Icon name="refresh" :size="14" />{{ loadingAcc ? '…' : 'Actualizar' }}</button></div>
        <p v-if="backendOk && !state.integrations.google.length && !loadingAcc" class="small muted" style="margin-top:8px">Aún no hay cuentas conectadas.</p>
        <div v-for="a in state.integrations.google" :key="a.id" class="item">
          <span class="ico" :class="{ lav: a.label === 'universidad' }"><Icon name="mail" :size="17" /></span>
          <div class="grow"><div class="small b">{{ a.label }} · {{ a.email }}</div><div class="row wrap" style="gap:4px;margin-top:4px"><span v-for="sv in a.services" :key="sv" class="badge green">✓ {{ SVC_LABEL[sv] || sv }}</span></div></div>
          <button class="btn sm ghost" @click="API.disconnectGoogle(a.id).catch(err)">Desconectar</button>
        </div>
        <div class="card tight soft stack" style="margin-top:10px">
          <div class="field"><span>Etiqueta</span><div class="chips"><Chip v-for="l in ['personal', 'universidad', 'trabajo']" :key="l" :active="g.label === l" @click="g.label = l">{{ l }}</Chip></div></div>
          <div class="field"><span>Permisos que vas a otorgar (puedes quitarlos cuando quieras)</span>
            <label v-for="s in SERVICES" :key="s[0]" class="row small" style="align-items:flex-start;padding:4px 0"><input type="checkbox" :checked="g.services.includes(s[0])" @change="toggleSvc(s[0])" style="margin-top:3px" /><span><b>{{ s[1] }}</b><br /><span class="tiny muted">{{ s[2] }}</span></span></label>
          </div>
          <button class="btn primary" :disabled="!backendOk || !g.services.length" @click="API.connectGoogle(g.label, g.services).catch(err)">Conectar cuenta de Google</button>
          <p v-if="!backendOk" class="tiny muted">Necesita el servidor desplegado y haber iniciado sesión.</p>
        </div>
      </div>
    </template>

    <!-- Integraciones -->
    <template v-if="tab === 'integraciones'">
      <div class="card stack">
        <div class="row"><span class="ico lav"><Icon name="cap" /></span><div class="grow"><h3>Tu Aula · Universidad del Tolima</h3><div class="tiny muted">Estado: {{ state.integrations.aula.status }}{{ state.integrations.aula.lastSync ? ' · última revisión ' + new Date(state.integrations.aula.lastSync).toLocaleString('es-CO') : '' }}</div></div></div>
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
      <div class="card row"><span class="ico"><Icon name="mail" /></span><div class="grow"><b class="small">Gmail y Calendar</b><div class="tiny muted">Por cuenta de Google (pestaña Cuentas). Se revisan desde Correo y Agenda.</div></div></div>
      <div class="card row"><span class="ico cream"><Icon name="book" /></span><div class="grow"><b class="small">Platzi</b><div class="tiny muted">Registro manual: Platzi no tiene API pública para tu progreso.</div></div></div>
      <div class="card stack">
        <div class="row"><span class="ico mint"><Icon name="wallet" /></span><div class="grow"><b class="small">{{ state.settings.financeAppName }}</b><div class="tiny muted">Resumen compartido servidor a servidor (FINANCE_API_URL + FINANCE_API_KEY).</div></div></div>
        <label class="field"><span>URL de la app de finanzas (para el botón “Abrir”)</span><input class="input" v-model="state.settings.financeAppUrl" placeholder="https://…" /></label>
      </div>
      <div class="card row"><span class="ico lav"><Icon name="sparkles" /></span><div class="grow"><b class="small">Asistente con IA (opcional)</b><div class="tiny muted">El motor de recomendaciones funciona sin IA. Para conversar libremente, el servidor usa la API de Claude con una clave guardada solo en Vercel (ANTHROPIC_API_KEY).</div></div></div>
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
