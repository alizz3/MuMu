// Puente MuMu ↔ MuMu Finanzas: pide SOLO un resumen (no movimientos) a la app de finanzas,
// servidor a servidor, con una clave compartida. Contrato en docs/INTEGRACION-FINANZAS.md
import { handler, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'

export default handler(async (req, res) => {
  const user = await requireUser(req)
  const { FINANCE_API_URL: url, FINANCE_API_KEY: key } = process.env
  if (!url || !key) throw new HttpError(501, 'La app de finanzas aún no está conectada')
  const r = await fetch(`${url.replace(/\/$/, '')}/api/summary`, { headers: { Authorization: `Bearer ${key}`, 'X-User-Email': user.email } })
  if (!r.ok) throw new HttpError(502, 'La app de finanzas no respondió')
  const j = await r.json()
  res.json({ summary: j.summary })
}, { methods: ['GET'], limit: 30 })
