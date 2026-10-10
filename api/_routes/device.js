// La app de Android habla con MuMu sin abrirla: lee el plan de alarmas/recordatorios y el widget,
// y sube el tiempo de pantalla. Se enlaza una sola vez con un token aleatorio que solo vive en tu celular;
// aquí se guarda únicamente su huella (sha256) en /secrets, que el navegador nunca puede leer.
import { createHash, randomBytes } from 'node:crypto'
import { handler, body, HttpError } from '../_lib/http.js'
import { requireUser, initDb } from '../_lib/firebase.js'

const sha = (t) => createHash('sha256').update(t).digest('hex')
const tokens = (db) => db.collection('secrets').doc('_devices').collection('t')

async function deviceUid(req) {
  const t = String(req.headers['x-mumu-device'] || '')
  if (!/^[\w-]{40,64}$/.test(t)) throw new HttpError(401, 'Celular sin enlazar')
  const db = await initDb()
  const snap = await tokens(db).doc(sha(t)).get()
  if (!snap.exists) throw new HttpError(401, 'Este celular ya no está enlazado')
  return { db, uid: snap.data().uid }
}

// POST /api/device/link (con tu sesión) → token nuevo para el celular
export const link = handler(async (req, res) => {
  const u = await requireUser(req)
  const db = await initDb()
  const t = randomBytes(32).toString('base64url')
  await tokens(db).doc(sha(t)).set({ uid: u.uid, createdAt: Date.now() })
  res.json({ token: t })
}, { methods: ['POST'], limit: 10 })

// GET /api/device/plan → { plan, widget, home, at }
export const plan = handler(async (req, res) => {
  const { db, uid } = await deviceUid(req)
  const snap = await db.collection('users').doc(uid).collection('data').doc('device').get()
  res.json(snap.exists ? (snap.data().items || {}) : {})
}, { methods: ['GET'], limit: 30 })

// POST /api/device/uso { d: { "2026-10-09": { t, a: { paquete: min } } }, l: { paquete: nombre } }
// Se deja en el buzón y la app lo pasa a "Celular y redes" al abrir (mismo formato que #uso=).
export const uso = handler(async (req, res) => {
  const { db, uid } = await deviceUid(req)
  const b = body(req)
  if (!b || typeof b.d !== 'object') throw new HttpError(400, 'Datos inválidos')
  const json = JSON.stringify({ v: 1, permiso: true, d: b.d, l: b.l || {} })
  if (json.length > 200_000) throw new HttpError(413, 'Demasiados datos')
  await db.collection('users').doc(uid).collection('data').doc('usoCelular').set({ items: { at: Date.now(), json } })
  res.json({ ok: true })
}, { methods: ['POST'], limit: 20 })
