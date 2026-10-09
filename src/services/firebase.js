// Firebase es opcional: sin configuración la app funciona en "modo local" (datos en este navegador).
// La configuración web de Firebase NO es secreta (es pública por diseño); la seguridad la dan
// las reglas de Firestore (firestore.rules) y la verificación de tokens en el backend.
let cached = null

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const hasFirebase = () => !!firebaseConfig.apiKey && !!firebaseConfig.projectId

export async function getFirebase() {
  if (!hasFirebase()) return null
  if (cached) return cached
  const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
  const app = initializeApp(firebaseConfig)
  // Caché local de Firestore: sin internet la app lee tus datos guardados y lo que hagas se sube al volver
  let db
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }) } catch { db = fs.getFirestore(app) }
  cached = { app, auth: auth.getAuth(app), authMod: auth, db, fs }
  return cached
}

export async function signIn() {
  const fb = await getFirebase()
  if (!fb) throw new Error('Firebase no está configurado (mira el README).')
  const provider = new fb.authMod.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return fb.authMod.signInWithPopup(fb.auth, provider)
}
export async function signOut() { const fb = await getFirebase(); if (fb) await fb.authMod.signOut(fb.auth) }
export async function idToken() { const fb = await getFirebase(); return fb?.auth.currentUser ? fb.auth.currentUser.getIdToken() : null }
