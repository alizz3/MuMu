// Copias de seguridad automáticas de tus datos (las hace el cron 3 veces al día, se guardan 14 días).
// Viven en /secrets (el navegador no puede leerlas directo); solo tú las pides con tu sesión.
import { handler, HttpError } from '../_lib/http.js'
import { requireUser, initDb } from '../_lib/firebase.js'

const KEEP_DAYS = 14
const root = (db, uid) => db.collection('secrets').doc('_backups').collection(uid)

// Lo llama el cron: copia users/{uid}/data/* → secrets/_backups/{uid}/{fecha_franja} (una colección "k" por clave)
export async function backupAll(db, franja = 'x') {
  const out = { usuarios: 0, saltadas: 0 }
  const stamp = `${new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10)}_${franja}`
  for (const u of await db.collection('users').listDocuments()) {
    const snap = await u.collection('data').get()
    if (snap.empty) continue
    const data = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().items]))
    // No se guarda una copia que parezca vacía o de ejemplo (para no tapar las buenas)
    const n = (data.tasks || []).length + (data.projects || []).length
    if (n < 15) { out.saltadas++; continue }
    const ref = root(db, u.id).doc(stamp)
    const batch = db.batch()
    batch.set(ref, { at: Date.now(), keys: Object.keys(data), resumen: { proyectos: (data.projects || []).length, materias: (data.subjects || []).length, tareas: (data.tasks || []).length, habitos: (data.habits || []).length } })
    for (const [k, v] of Object.entries(data)) batch.set(ref.collection('k').doc(k), { items: v ?? null })
    await batch.commit()
    out.usuarios++
    // Borra las de más de 14 días
    const old = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10)
    for (const d of (await root(db, u.id).get()).docs) if (d.id < old) { for (const k of (await d.ref.collection('k').get()).docs) await k.ref.delete(); await d.ref.delete() }
  }
  return out
}

// GET /api/backup → lista; GET /api/backup?id=2026-10-15_tarde → los datos de esa copia
export default handler(async (req, res) => {
  const u = await requireUser(req)
  const db = await initDb()
  const id = String(req.query?.id || '')
  if (!id) {
    const list = (await root(db, u.uid).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at)
    return res.json({ backups: list })
  }
  if (!/^\d{4}-\d{2}-\d{2}_\w+$/.test(id)) throw new HttpError(400, 'Copia inválida')
  const ref = root(db, u.uid).doc(id)
  const k = await ref.collection('k').get()
  if (k.empty) throw new HttpError(404, 'Esa copia no existe')
  res.json({ id, data: Object.fromEntries(k.docs.map((d) => [d.id, d.data().items])) })
}, { methods: ['GET'], limit: 20 })
