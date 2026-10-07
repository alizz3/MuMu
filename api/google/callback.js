// Google redirige aquí después de que autorizas. Guardamos los tokens CIFRADOS y volvemos a la app.
import { handler, HttpError } from '../_lib/http.js'
import { verify, encrypt, randomId } from '../_lib/crypto.js'
import { exchangeCode, userEmail, accountsRef, servicesFromScopes } from '../_lib/google.js'
import { initDb } from '../_lib/firebase.js'

export default handler(async (req, res) => {
  const app = (process.env.APP_URL || '').replace(/\/$/, '')
  if (req.query.error) return res.redirect(302, `${app}/?connected=cancelado#/ajustes`)
  try {
  await initDb()
  const st = verify(req.query.state)
  const tok = await exchangeCode(String(req.query.code || ''))
  if (!tok.refresh_token) throw new HttpError(400, 'Google no entregó acceso permanente. Quita el acceso de la app en tu cuenta de Google e intenta de nuevo.')
  const email = await userEmail(tok.access_token)
  const granted = String(tok.scope || '').split(' ')
  const ref = accountsRef(st.uid)
  const existing = await ref.where('email', '==', email).limit(1).get()
  const id = existing.empty ? randomId(6) : existing.docs[0].id
  await ref.doc(id).set({
    id, label: st.label, email, services: servicesFromScopes(granted), scopes: granted, connectedAt: Date.now(),
    tokens: encrypt({ access_token: tok.access_token, refresh_token: tok.refresh_token, expiry: Date.now() + tok.expires_in * 1000 }),
  })
  res.redirect(302, `${app}/?connected=google#/ajustes`)
  } catch (e) {
    // Volver a la app con un mensaje claro en vez de una página de error
    console.error(`[api] callback google: ${String(e.message).slice(0, 160)}`)
    const msg = e.expose ? e.message : 'No se pudo guardar la cuenta. Intenta de nuevo.'
    res.redirect(302, `${app}/?connected=error&msg=${encodeURIComponent(msg)}#/ajustes`)
  }
}, { methods: ['GET'], limit: 20 })
