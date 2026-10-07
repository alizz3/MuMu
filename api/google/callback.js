// Google redirige aquí después de que autorizas. Guardamos los tokens CIFRADOS y volvemos a la app.
import { handler, HttpError } from '../_lib/http.js'
import { verify, encrypt, randomId } from '../_lib/crypto.js'
import { exchangeCode, userEmail, accountsRef } from '../_lib/google.js'

export default handler(async (req, res) => {
  const app = (process.env.APP_URL || '').replace(/\/$/, '')
  if (req.query.error) return res.redirect(302, `${app}/?connected=cancelado#/ajustes`)
  const st = verify(req.query.state)
  const tok = await exchangeCode(String(req.query.code || ''))
  if (!tok.refresh_token) throw new HttpError(400, 'Google no entregó acceso permanente. Quita el acceso de la app en tu cuenta de Google e intenta de nuevo.')
  const email = await userEmail(tok.access_token)
  const granted = String(tok.scope || '').split(' ')
  const ref = accountsRef(st.uid)
  const existing = await ref.where('email', '==', email).limit(1).get()
  const id = existing.empty ? randomId(6) : existing.docs[0].id
  await ref.doc(id).set({
    id, label: st.label, email, services: st.services, scopes: granted, connectedAt: Date.now(),
    tokens: encrypt({ access_token: tok.access_token, refresh_token: tok.refresh_token, expiry: Date.now() + tok.expires_in * 1000 }),
  })
  res.redirect(302, `${app}/?connected=google#/ajustes`)
}, { methods: ['GET'], limit: 20 })
