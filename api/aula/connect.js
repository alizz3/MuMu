// Conecta Tu Aula. La contraseña se usa UNA vez para obtener el token del servicio móvil de Moodle
// y se descarta: no se guarda, no se registra y no vuelve al navegador. Solo se guarda el token, cifrado.
import { handler, body, str, httpsUrl, HttpError } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'
import { encrypt } from '../_lib/crypto.js'
import { getToken, siteInfo, fetchIcal } from '../_lib/moodle.js'
import { aulaRef } from '../_lib/aula.js'

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  if (req.method === 'DELETE') { await aulaRef(uid).delete(); return res.json({ ok: true }) }
  const b = body(req)
  const siteUrl = httpsUrl(b.site, 'La dirección de Tu Aula')
  const site = `${siteUrl.origin}${siteUrl.pathname.replace(/\/(login\/index\.php|my\/?|index\.php)?$/, '').replace(/\/$/, '')}`
  if (b.method === 'webservice') {
    const token = await getToken(site, str(b.username, 'usuario', { max: 120 }), str(b.password, 'contraseña', { max: 200 }))
    const info = await siteInfo(site, token)
    await aulaRef(uid).set({ site, method: 'webservice', cred: encrypt({ token }), siteName: info.sitename, moodleUser: info.userid, connectedAt: Date.now(), hashes: {} })
    return res.json({ ok: true, method: 'webservice', siteName: info.sitename })
  }
  if (b.method === 'ical') {
    const u = httpsUrl(b.icalUrl, 'El enlace del calendario')
    if (u.hostname !== siteUrl.hostname) throw new HttpError(400, 'El enlace del calendario debe ser de la misma dirección de Tu Aula')
    await fetchIcal(u.toString())
    await aulaRef(uid).set({ site, method: 'ical', cred: encrypt({ icalUrl: u.toString() }), connectedAt: Date.now(), hashes: {} })
    return res.json({ ok: true, method: 'ical' })
  }
  throw new HttpError(400, 'Método no válido')
}, { methods: ['POST', 'DELETE'], limit: 5, windowMs: 10 * 60_000 })
