// Sincronización de Tu Aula compartida entre "Revisar ahora" y el cron.
import { HttpError } from './http.js'
import { secrets } from './firebase.js'
import { decrypt } from './crypto.js'
import { fetchWebservice, fetchIcal } from './moodle.js'

export const aulaRef = (uid) => secrets(uid).collection('aula').doc('main')

export async function runAulaSync(uid) {
  const ref = aulaRef(uid)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'Tu Aula no está conectada')
  const a = snap.data()
  const cred = decrypt(a.cred)
  const res = a.method === 'webservice' ? await fetchWebservice(a.site, cred.token) : await fetchIcal(cred.icalUrl)
  const prev = a.hashes || {}
  const changed = res.items.filter((i) => prev[i.externalId] !== i.hash)
  await ref.update({ hashes: Object.fromEntries(res.items.map((i) => [i.externalId, i.hash])), lastSync: Date.now(), lastWarnings: res.warnings || [] })
  return { items: res.items, changed, warnings: res.warnings || [] }
}
