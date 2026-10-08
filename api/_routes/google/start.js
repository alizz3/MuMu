// Inicia OAuth de Google para conectar una cuenta (personal, universidad…) con los permisos elegidos.
import { handler, body, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'
import { sign, randomId } from '../../_lib/crypto.js'
import { authUrl, SERVICE_SCOPES } from '../../_lib/google.js'

export default handler(async (req, res) => {
  const user = await requireUser(req)
  const b = body(req)
  const label = String(b.label || 'personal').slice(0, 30).replace(/[^\p{L}\p{N} _-]/gu, '')
  const services = Array.isArray(b.services) ? b.services.filter((s) => SERVICE_SCOPES[s]) : []
  if (!services.length) throw new HttpError(400, 'Elige al menos un permiso')
  const state = sign({ uid: user.uid, label, services, n: randomId(), exp: Date.now() + 10 * 60_000 })
  const hint = typeof b.email === 'string' && /^[^@\s]+@[^@\s]+$/.test(b.email) ? b.email : undefined
  res.json({ url: authUrl(state, services, hint) })
}, { methods: ['POST'], limit: 10 })
