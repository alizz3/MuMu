// Sincronización con Firestore: users/{uid}/data/{coleccion} = { items, updatedAt }.
// Una colección por documento mantiene pocas escrituras y cabe de sobra para uso personal.
import { state, ui, onPersist } from '../store'
import { getFirebase } from './firebase'
import { markVisit, applyAcademicChanges } from '../store/actions'
import { syncAula } from './api'
import { toast } from '../engine/game'

const last = {}
let uid = null, ready = false

export async function initSync() {
  markVisit()
  if (location.protocol.startsWith('http')) fetch('/api/health').then((r) => r.ok && r.json()).then((j) => { ui.backend = !!j?.ok }).catch(() => { ui.backend = false })
  const fb = await getFirebase()
  if (!fb) return
  const { doc, getDoc, setDoc } = fb.fs
  fb.authMod.onAuthStateChanged(fb.auth, async (user) => {
    ui.user = user ? { uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL } : null
    uid = user?.uid || null
    ready = false
    ui.synced = false
    if (!uid) return
    const keys = Object.keys(state)
    const snaps = await Promise.all(keys.map((k) => getDoc(doc(fb.db, 'users', uid, 'data', k))))
    const anyRemote = snaps.some((s) => s.exists())
    if (anyRemote) {
      snaps.forEach((s, i) => { if (s.exists()) { state[keys[i]] = s.data().items; last[keys[i]] = JSON.stringify(s.data().items) } })
    }
    ready = true
    ui.synced = true
    markVisit()
    processInbox()
    autoSync()
    if (!anyRemote) push(fb, doc, setDoc)
  })
  onPersist(() => { if (ready && uid) push(fb, doc, setDoc) })
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
  if (created || updated) toast(`Tu Aula: ${created} nuevas, ${updated} con cambios 🎓`)
}

// Si Tu Aula está conectada y no se revisa hace más de 3 horas, se revisa al abrir
function autoSync() {
  const a = state.integrations.aula
  if (!ui.backend || a?.status !== 'conectado') return
  if (a.lastSync && Date.now() - new Date(a.lastSync).getTime() < 3 * 3600e3) return
  syncAula().catch(() => {})
}
