// Sincronización con Firestore: users/{uid}/data/{coleccion} = { items, updatedAt }.
// Una colección por documento mantiene pocas escrituras y cabe de sobra para uso personal.
import { state, ui, onPersist, resetToSeed } from '../store'
import { getFirebase, idToken } from './firebase'
import { markVisit, applyAcademicChanges, dropSena, cleanTitles, linkHabitTasks, fixSubjects } from '../store/actions'
import { syncAula, syncClassroom, syncGTasks, pushNewGTasks, gtAccounts } from './api'
import { watch } from 'vue'
import { initModoU } from '../engine/modoU'
import { toast } from '../engine/game'

const last = {}
let uid = null, ready = false
let unsubs = []

// Nada debe dejar la vaquita de carga pegada: todo lo de red tiene tiempo límite
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
export async function initSync() {
  markVisit()
  // Plan B: si en 8 s no se resolvió el inicio de sesión, se muestra la app con lo guardado en el equipo
  setTimeout(() => {
    if (ui.authReady) return
    try { const u = JSON.parse(localStorage.getItem('mumu:lastUser') || 'null'); if (u && !ui.user) ui.user = u } catch {}
    ui.authReady = true
    console.warn('sync: inicio lento, se abre con datos locales')
  }, 8000)
  if (location.protocol.startsWith('http')) fetch('/api/health').then((r) => r.ok && r.json()).then((j) => { ui.backend = !!j?.ok }).catch(() => { ui.backend = false })
  let fb = null
  try { fb = await withTimeout(getFirebase(), 10000) } catch (e) { console.warn('firebase', e.message) }
  if (!fb) { ui.authReady = true; return }
  const { doc, getDoc, setDoc } = fb.fs
  fb.authMod.onAuthStateChanged(fb.auth, async (user) => {
    ui.user = user ? { uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL } : null
    try { if (ui.user) localStorage.setItem('mumu:lastUser', JSON.stringify(ui.user)); else localStorage.removeItem('mumu:lastUser') } catch {}
    // Al cerrar sesión se borra la copia local para que nadie más vea tus datos en este equipo
    if (!user && uid) { ready = false; unsubs.forEach((u) => u()); unsubs = []; resetToSeed() }
    uid = user?.uid || null
    ready = false
    ui.synced = false
    if (!uid) { ui.authReady = true; return }
    // Solo la dueña: si el servidor dice que esta cuenta no tiene acceso, se muestra la pantalla de "casita de Alizz"
    const dkey = `mumu:dataUid:${user.uid}`
    if (location.protocol.startsWith('http')) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000)
        const r = await fetch('/api/me', { signal: ctrl.signal, headers: { Authorization: `Bearer ${await withTimeout(idToken(), 5000)}` } }).finally(() => clearTimeout(t))
        if (r.status === 403) { ui.blocked = true; ui.authReady = true; uid = null; return }
        const j = await r.json().catch(() => ({}))
        if (j.dataUid) { uid = j.dataUid; try { localStorage.setItem(dkey, uid) } catch {} } // la cuenta de la U usa los mismos datos que tu Gmail
      } catch {
        // Sin internet: se usa la última cuenta de datos conocida
        try { uid = localStorage.getItem(dkey) || uid } catch {}
      }
    }
    ui.blocked = false
    ui.demo = false
    ui.dataUid = uid
    initModoU(user.email)
    ui.authReady = true
    const keys = Object.keys(state)
    let snaps
    try { snaps = await Promise.all(keys.map((k) => getDoc(doc(fb.db, 'users', uid, 'data', k)))) } catch (e) {
      toast('No pude leer tus datos: revisa que las reglas de Firestore estén publicadas (firestore.rules).')
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
    fixSubjects()
    linkHabitTasks()
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
  // Sin await: sin internet la escritura queda guardada en el equipo y Firebase la sube sola al volver
  for (const k of Object.keys(state)) {
    const json = JSON.stringify(state[k])
    if (last[k] === json) continue
    last[k] = json
    setDoc(doc(fb.db, 'users', uid, 'data', k), { items: JSON.parse(json), updatedAt: Date.now() }).catch((e) => console.warn('sync', k, e.message))
  }
}

// Lo que el cron dejó en el buzón (actividades nuevas o cambiadas de Tu Aula) se aplica al abrir la app
function processInbox() {
  const box = state.inbox || []
  if (!box.length) return
  let created = 0, updated = 0
  for (const entry of box) { const r = applyAcademicChanges(entry.items || [], entry.source || 'aula'); created += r.created; updated += r.updated }
  state.inbox = []
  if (created || updated) toast(`Universidad: ${created} nuevas, ${updated} con cambios`)
}

// Si Tu Aula está conectada y no se revisa hace más de 3 horas, se revisa al abrir
function autoSync() {
  if (!ui.backend || !navigator.onLine) return
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
  const run = () => { if (navigator.onLine && gtAccounts().length) syncGTasks({ quiet: true }).catch(() => {}) }
  setTimeout(run, 3000)
  setInterval(run, 20 * 60e3)
  document.addEventListener('visibilitychange', () => { const l = state.integrations.gtasksLast; if (document.visibilityState === 'visible' && (!l || Date.now() - new Date(l).getTime() > 5 * 60e3)) run() })
  let timer = null
  watch(() => state.tasks.map((t) => `${t.id}:${t.status}:${t.gtask ? 1 : 0}:${t.projectId || ''}:${t.title}:${t.due}:${(t.notes || '').length}`).join('|'), () => {
    clearTimeout(timer)
    timer = setTimeout(() => { if (gtAccounts().length) pushNewGTasks().catch(() => {}) }, 4000)
  })
}
