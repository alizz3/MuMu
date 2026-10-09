// Sincronización con Firestore: users/{uid}/data/{coleccion} = { items, updatedAt }.
// Una colección por documento mantiene pocas escrituras y cabe de sobra para uso personal.
import { state, ui, onPersist, resetToSeed } from '../store'
import { getFirebase, idToken } from './firebase'
import { markVisit, applyAcademicChanges, dropSena, cleanTitles } from '../store/actions'
import { syncAula, syncClassroom, syncGTasks, pushNewGTasks, gtAccounts } from './api'
import { watch } from 'vue'
import { initModoU } from '../engine/modoU'
import { toast } from '../engine/game'

const last = {}
let uid = null, ready = false
let unsubs = []

export async function initSync() {
  markVisit()
  if (location.protocol.startsWith('http')) fetch('/api/health').then((r) => r.ok && r.json()).then((j) => { ui.backend = !!j?.ok }).catch(() => { ui.backend = false })
  const fb = await getFirebase()
  if (!fb) { ui.authReady = true; return }
  const { doc, getDoc, setDoc } = fb.fs
  fb.authMod.onAuthStateChanged(fb.auth, async (user) => {
    ui.user = user ? { uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL } : null
    // Al cerrar sesión se borra la copia local para que nadie más vea tus datos en este equipo
    if (!user && uid) { ready = false; unsubs.forEach((u) => u()); unsubs = []; resetToSeed() }
    uid = user?.uid || null
    ready = false
    ui.synced = false
    if (!uid) { ui.authReady = true; return }
    // Solo la dueña: si el servidor dice que esta cuenta no tiene acceso, se muestra la pantalla de "casita de Alizz"
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch('/api/me', { headers: { Authorization: `Bearer ${await idToken()}` } })
        if (r.status === 403) { ui.blocked = true; ui.authReady = true; uid = null; return }
        const j = await r.json().catch(() => ({}))
        if (j.dataUid) uid = j.dataUid // la cuenta de la U usa los mismos datos que tu Gmail
      } catch { /* sin servidor: se permite (modo local) */ }
    }
    ui.blocked = false
    ui.demo = false
    ui.dataUid = uid
    initModoU(user.email)
    ui.authReady = true
    const keys = Object.keys(state)
    let snaps
    try { snaps = await Promise.all(keys.map((k) => getDoc(doc(fb.db, 'users', uid, 'data', k)))) } catch (e) {
      toast('No pude leer tus datos: revisa que las reglas de Firestore estén publicadas (firestore.rules) 🙏')
      console.warn('sync', e.message); ui.synced = true; return
    }
    const anyRemote = snaps.some((s) => s.exists())
    if (anyRemote) {
      snaps.forEach((s, i) => { if (s.exists()) { state[keys[i]] = s.data().items; last[keys[i]] = JSON.stringify(s.data().items) } })
    }
    ready = true
    ui.synced = true
    listen(fb, uid)
    markVisit()
    dropSena()
    cleanTitles()
    processInbox()
    autoSync()
    if (!anyRemote) push(fb, doc, setDoc)
  })
  onPersist(() => { if (ready && uid) push(fb, doc, setDoc) })
}

// En vivo: si cambias algo en otra pestaña o en el celular, esta pestaña se actualiza sola.
// Así una pestaña vieja no vuelve a subir tareas que ya borraste.
function listen(fb, id) {
  unsubs.forEach((u) => u()); unsubs = []
  const { doc, onSnapshot } = fb.fs
  for (const k of Object.keys(state)) {
    unsubs.push(onSnapshot(doc(fb.db, 'users', id, 'data', k), (s) => {
      if (!s.exists() || s.metadata.hasPendingWrites) return
      const json = JSON.stringify(s.data().items)
      if (json === last[k]) return
      last[k] = json
      state[k] = JSON.parse(json)
    }, () => { /* sin conexión: se reintenta solo */ }))
  }
}

async function push(fb, doc, setDoc) {
  for (const k of Object.keys(state)) {
    const json = JSON.stringify(state[k])
    if (last[k] === json) continue
    last[k] = json
    try { await setDoc(doc(fb.db, 'users', uid, 'data', k), { items: JSON.parse(json), updatedAt: Date.now() }) } catch (e) { console.warn('sync', k, e.message) }
  }
}

// Lo que el cron dejó en el buzón (actividades nuevas o cambiadas de Tu Aula) se aplica al abrir la app
function processInbox() {
  const box = state.inbox || []
  if (!box.length) return
  let created = 0, updated = 0
  for (const entry of box) { const r = applyAcademicChanges(entry.items || [], entry.source || 'aula'); created += r.created; updated += r.updated }
  state.inbox = []
  if (created || updated) toast(`Universidad: ${created} nuevas, ${updated} con cambios 🎓`)
}

// Si Tu Aula está conectada y no se revisa hace más de 3 horas, se revisa al abrir
function autoSync() {
  if (!ui.backend) return
  const old = (iso) => !iso || Date.now() - new Date(iso).getTime() > 3 * 3600e3
  const a = state.integrations.aula
  if (a?.status === 'conectado' && old(a.lastSync)) syncAula().catch(() => {})
  const cr = state.integrations.classroom
  if (state.integrations.google.some((g) => g.services.includes('classroom')) && old(cr?.lastSync)) syncClassroom().catch(() => {})
  startGTasks()
}
// Google Tasks: se revisa al abrir y cada 20 minutos con la app abierta; lo que hagas en MuMu se manda a los pocos segundos
let gtStarted = false
function startGTasks() {
  if (gtStarted) return
  gtStarted = true
  // Con varias pestañas abiertas, solo una habla con Google Tasks (evita tareas repetidas)
  if (navigator.locks?.request) { navigator.locks.request('mumu-gtasks', () => new Promise(() => runGTasks())).catch(() => {}); return }
  runGTasks()
}
function runGTasks() {
  const run = () => { if (gtAccounts().length) syncGTasks({ quiet: true }).catch(() => {}) }
  setTimeout(run, 3000)
  setInterval(run, 20 * 60e3)
  document.addEventListener('visibilitychange', () => { const l = state.integrations.gtasksLast; if (document.visibilityState === 'visible' && (!l || Date.now() - new Date(l).getTime() > 5 * 60e3)) run() })
  let timer = null
  watch(() => state.tasks.map((t) => `${t.id}:${t.status}:${t.gtask ? 1 : 0}:${t.title}:${t.due}:${(t.notes || '').length}`).join('|'), () => {
    clearTimeout(timer)
    timer = setTimeout(() => { if (gtAccounts().length) pushNewGTasks().catch(() => {}) }, 4000)
  })
}
