// ¿Tu Aula está en línea? Hace una visita corta a la página de inicio de sesión y mide cuánto tarda.
import { handler, httpsUrl } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'

export default handler(async (req, res) => {
  await requireUser(req)
  const u = httpsUrl(req.query.site || process.env.AULA_SITE || 'https://tuaulavirtual.ut.edu.co', 'La dirección de Tu Aula')
  const t0 = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(`${u.origin}/login/index.php`, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'MuMu/1.0 (+uso personal)' } })
    const ms = Date.now() - t0
    res.json({ online: r.status < 500, status: r.status, ms, slow: ms > 4000, checkedAt: Date.now() })
  } catch (e) {
    res.json({ online: false, status: 0, ms: Date.now() - t0, reason: e.name === 'AbortError' ? 'No respondió en 8 segundos' : 'No se pudo conectar', checkedAt: Date.now() })
  } finally { clearTimeout(timer) }
}, { methods: ['GET'], limit: 20 })
