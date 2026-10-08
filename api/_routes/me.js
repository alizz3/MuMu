// ¿Quién soy? Sirve para que la app sepa si la cuenta con la que entraste tiene acceso.
import { handler } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'

export default handler(async (req, res) => {
  const u = await requireUser(req)
  res.json({ ok: true, email: u.email, dataUid: u.uid })
}, { methods: ['GET'], limit: 30 })
