// Archivos privados del Garaje (manuales, facturas, fotos, SOAT…).
// Se guardan en Firestore bajo /secrets (el navegador NO puede leerlos: solo este servidor con tu sesión),
// partidos en trozos de ~700 KB porque un documento de Firestore no puede pasar de 1 MB.
//   POST { op: 'put', id, part, total, name, mime, size, vehicleId, data(base64) }   → sube un trozo
//   GET  ?id=…&part=n                                                                → baja un trozo
//   POST { op: 'delete', id }                                                        → borra el archivo
//   POST { op: 'fetchManual', id, vehicleId, url }  → el servidor descarga el manual oficial (solo dominios de Honda) y lo guarda
import { handler, body, str, HttpError } from '../_lib/http.js'
import { requireUser, initDb } from '../_lib/firebase.js'

const PART = 700 * 1024
const MAX = 25 * 1024 * 1024
const ID = /^[\w-]{4,60}$/
const MIMES = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif|gif)|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.[\w.]+))$/
const MANUAL_HOSTS = ['motos.honda.com.co', 'www.honda.com.co', 'honda.com.co']
const ref = (db, uid, id) => db.collection('secrets').doc('_vfiles').collection(uid).doc(id)

async function remove(db, uid, id) {
  const r = ref(db, uid, id)
  const parts = await r.collection('p').get()
  const batch = db.batch()
  parts.docs.forEach((d) => batch.delete(d.ref)); batch.delete(r)
  await batch.commit()
}

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  const db = await initDb()
  if (req.method === 'GET') {
    const id = String(req.query?.id || ''), part = Number(req.query?.part || 0)
    if (!ID.test(id) || !Number.isInteger(part) || part < 0) throw new HttpError(400, 'Archivo inválido')
    const meta = await ref(db, uid, id).get()
    if (!meta.exists || !meta.data().complete) throw new HttpError(404, 'Ese archivo no está guardado')
    const p = await ref(db, uid, id).collection('p').doc(String(part)).get()
    if (!p.exists) throw new HttpError(404, 'Falta una parte del archivo')
    const m = meta.data()
    return res.json({ id, part, total: m.total, name: m.name, mime: m.mime, size: m.size, data: Buffer.from(p.data().b).toString('base64') })
  }
  const b = body(req)
  const id = str(b.id, 'archivo', { max: 60 })
  if (!ID.test(id)) throw new HttpError(400, 'Archivo inválido')
  if (b.op === 'delete') { await remove(db, uid, id); return res.json({ ok: true }) }

  if (b.op === 'put') {
    const part = Number(b.part), total = Number(b.total), size = Number(b.size)
    const mime = str(b.mime, 'tipo', { max: 120 })
    if (!MIMES.test(mime)) throw new HttpError(415, 'Ese tipo de archivo no se puede guardar (PDF, imágenes, Word o texto)')
    if (!Number.isInteger(part) || !Number.isInteger(total) || part < 0 || total < 1 || part >= total || total > Math.ceil(MAX / PART)) throw new HttpError(400, 'Parte inválida')
    if (!(size > 0 && size <= MAX)) throw new HttpError(413, 'El archivo pasa de 25 MB')
    const buf = Buffer.from(str(b.data, 'datos', { max: PART * 2 }), 'base64')
    if (!buf.length || buf.length > PART) throw new HttpError(400, 'Parte demasiado grande')
    const r = ref(db, uid, id)
    if (part === 0) await r.set({ name: str(b.name, 'nombre', { max: 160 }), mime, size, total, vehicleId: str(b.vehicleId || 'x', 'vehículo', { max: 60 }), complete: false, at: Date.now() })
    await r.collection('p').doc(String(part)).set({ b: buf })
    if (part === total - 1) await r.update({ complete: true })
    return res.json({ ok: true, part, complete: part === total - 1 })
  }

  if (b.op === 'fetchManual') {
    let u
    try { u = new URL(str(b.url, 'enlace', { max: 500 })) } catch { throw new HttpError(400, 'Enlace inválido') }
    if (u.protocol !== 'https:' || !MANUAL_HOSTS.includes(u.hostname)) throw new HttpError(400, 'Solo se descargan manuales de los sitios oficiales de Honda')
    // Redirecciones a mano: cada salto debe seguir en un dominio oficial de Honda (evita que un redirect lleve el servidor a otro sitio)
    let r = null
    for (let hop = 0; hop < 4; hop++) {
      r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(20_000) }).catch(() => null)
      if (!r || r.status < 300 || r.status >= 400) break
      try { u = new URL(r.headers.get('location') || '', u) } catch { r = null; break }
      if (u.protocol !== 'https:' || !MANUAL_HOSTS.includes(u.hostname)) throw new HttpError(400, 'El enlace redirige fuera de los sitios oficiales de Honda')
      if (hop === 3) r = null
    }
    if (!r || !r.ok) throw new HttpError(502, `No pude descargar el manual (${r ? r.status : 'sin respuesta'}). Puedes subirlo tú desde tu celular o computador.`)
    const type = (r.headers.get('content-type') || '').split(';')[0]
    const buf = Buffer.from(await r.arrayBuffer())
    if (type !== 'application/pdf' && buf.subarray(0, 4).toString() !== '%PDF') throw new HttpError(502, 'El enlace no devolvió un PDF')
    if (buf.length > MAX) throw new HttpError(413, 'El manual pasa de 25 MB')
    const total = Math.ceil(buf.length / PART)
    const fr = ref(db, uid, id)
    await fr.set({ name: decodeURIComponent(u.pathname.split('/').pop() || 'manual.pdf'), mime: 'application/pdf', size: buf.length, total, vehicleId: str(b.vehicleId || 'x', 'vehículo', { max: 60 }), complete: false, at: Date.now(), source: u.href })
    for (let i = 0; i < total; i++) await fr.collection('p').doc(String(i)).set({ b: buf.subarray(i * PART, (i + 1) * PART) })
    await fr.update({ complete: true })
    return res.json({ ok: true, size: buf.length, total, lastModified: r.headers.get('last-modified') || null })
  }
  throw new HttpError(400, 'Operación desconocida')
}, { methods: ['GET', 'POST'], limit: 120 })
