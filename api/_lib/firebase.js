// Firebase Admin: verifica la sesión del usuario y da acceso a Firestore desde el servidor.
// Credenciales en la variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio en base64).
import { HttpError } from './http.js'

// Firebase Admin se carga bajo demanda: si falla, el error llega como mensaje claro en vez de tumbar la función.
let mods
async function load() {
  if (mods) return mods
  try {
    const [a, au, fs] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/auth'), import('firebase-admin/firestore')])
    mods = { ...a, getAuth: au.getAuth, getFirestore: fs.getFirestore, FieldValue: fs.FieldValue }
    return mods
  } catch (e) { throw new HttpError(500, `No se pudo cargar Firebase Admin (${e.message}). Revisa la versión de Node en Vercel.`) }
}

async function app() {
  const { getApps, initializeApp, cert } = await load()
  if (getApps().length) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new HttpError(503, 'El servidor no tiene configurado Firebase (FIREBASE_SERVICE_ACCOUNT)')
  let json
  try { json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) } catch { throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT no es un base64 válido del archivo .json') }
  return initializeApp({ credential: cert(json) })
}

let owner = null
async function ownerUid(ownerEmail, decoded) {
  if (String(decoded.email).toLowerCase() === ownerEmail) return decoded.uid
  if (owner) return owner
  const { getAuth } = await load()
  try { owner = (await getAuth(await app()).getUserByEmail(ownerEmail)).uid } catch { throw new HttpError(409, `Primero entra una vez con ${ownerEmail}, que es la cuenta dueña de los datos`) }
  return owner
}

let dbi
export async function initDb() { if (!dbi) { const m = await load(); dbi = m.getFirestore(await app()) } return dbi }
export const db = () => { if (!dbi) throw new Error('Firestore sin inicializar'); return dbi }
export const fieldValue = async () => (await load()).FieldValue

// App personal: solo los correos de ALLOWED_EMAILS pueden usar el backend.
export async function requireUser(req) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) throw new HttpError(401, 'Inicia sesión primero')
  let decoded
  const { getAuth } = await load()
  const a = await app()
  await initDb()
  try { decoded = await getAuth(a).verifyIdToken(token) } catch { throw new HttpError(401, 'Sesión vencida, vuelve a entrar') }
  const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const email = String(decoded.email).toLowerCase()
  if (!allowed.length || !allowed.includes(email) || decoded.email_verified === false) throw new HttpError(403, 'Esta cuenta no tiene acceso a esta app personal')
  // Todas las cuentas permitidas (ej. Gmail personal y la de la U) comparten los datos de la dueña: el primer correo de ALLOWED_EMAILS
  return { uid: await ownerUid(allowed[0], decoded), authUid: decoded.uid, email: decoded.email }
}

// Los secretos (tokens cifrados) viven en /secrets/{uid}/..., una ruta que las reglas
// de Firestore bloquean por completo para el navegador. Solo el servidor la lee.
export const secrets = (uid) => db().collection('secrets').doc(uid)

// Buzón para que el servidor (cron) le entregue cambios a la app: users/{uid}/data/inbox
export async function pushInbox(uid, entry) {
  const FieldValue = await fieldValue()
  await (await initDb()).collection('users').doc(uid).collection('data').doc('inbox').set({ items: FieldValue.arrayUnion(entry), updatedAt: Date.now() }, { merge: true })
}
