// Firebase Admin: verifica la sesión del usuario y da acceso a Firestore desde el servidor.
// Credenciales en la variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio en base64).
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { HttpError } from './http.js'

function app() {
  if (getApps().length) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new HttpError(503, 'El servidor no tiene configurado Firebase (FIREBASE_SERVICE_ACCOUNT)')
  const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  return initializeApp({ credential: cert(json) })
}

export const db = () => getFirestore(app())
export { FieldValue }

// App personal: solo los correos de ALLOWED_EMAILS pueden usar el backend.
export async function requireUser(req) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) throw new HttpError(401, 'Inicia sesión primero')
  let decoded
  try { decoded = await getAuth(app()).verifyIdToken(token) } catch { throw new HttpError(401, 'Sesión vencida, vuelve a entrar') }
  const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (!allowed.length || !allowed.includes(String(decoded.email).toLowerCase())) throw new HttpError(403, 'Esta cuenta no tiene acceso a esta app personal')
  return { uid: decoded.uid, email: decoded.email }
}

// Los secretos (tokens cifrados) viven en /secrets/{uid}/..., una ruta que las reglas
// de Firestore bloquean por completo para el navegador. Solo el servidor la lee.
export const secrets = (uid) => db().collection('secrets').doc(uid)

// Buzón para que el servidor (cron) le entregue cambios a la app: users/{uid}/data/inbox
export async function pushInbox(uid, entry) {
  await db().collection('users').doc(uid).collection('data').doc('inbox').set({ items: FieldValue.arrayUnion(entry), updatedAt: Date.now() }, { merge: true })
}
