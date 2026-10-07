// Lista o desconecta (revocando permisos en Google) las cuentas conectadas. Nunca devuelve tokens.
import { handler, HttpError } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'
import { accountsRef, revoke } from '../_lib/google.js'

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  if (req.method === 'DELETE') {
    const id = String(req.query.id || '')
    if (!id) throw new HttpError(400, 'Falta id')
    await revoke(uid, id)
    return res.json({ ok: true })
  }
  const snap = await accountsRef(uid).get()
  res.json({ accounts: snap.docs.map((d) => { const a = d.data(); return { id: d.id, label: a.label, email: a.email, services: a.services, connectedAt: a.connectedAt } }) })
}, { methods: ['GET', 'DELETE'] })
