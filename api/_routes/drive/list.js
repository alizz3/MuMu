// Google Drive (solo lectura): lista lo que hay dentro de una carpeta para verlo en MuMu.
// GET ?account=ID&folder=FOLDER_ID → { folder: { id, name }, items: [...] }
import { handler, str, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'
import { accessToken, gget } from '../../_lib/google.js'

const API = 'https://www.googleapis.com/drive/v3/files'
const ID = /^[\w-]{10,100}$/

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  const accountId = str(String(req.query.account || ''), 'cuenta', { max: 100 })
  const folder = String(req.query.folder || '')
  if (!ID.test(folder)) throw new HttpError(400, 'Carpeta inválida')
  const { token } = await accessToken(uid, accountId, 'drive')
  const common = 'supportsAllDrives=true'
  const meta = await gget(token, `${API}/${folder}?fields=id,name,mimeType,webViewLink&${common}`)
  if (meta.mimeType !== 'application/vnd.google-apps.folder') throw new HttpError(400, 'Ese enlace no es una carpeta')
  const items = []
  let page = ''
  for (let i = 0; i < 4; i++) {
    const p = new URLSearchParams({ q: `'${folder}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,webViewLink,thumbnailLink,shortcutDetails)', orderBy: 'folder,name', pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })
    if (page) p.set('pageToken', page)
    const j = await gget(token, `${API}?${p}`)
    for (const f of j.files || []) {
      const sc = f.shortcutDetails
      items.push({ id: sc?.targetId || f.id, name: f.name, mime: sc?.targetMimeType || f.mimeType, folder: (sc?.targetMimeType || f.mimeType) === 'application/vnd.google-apps.folder', modified: f.modifiedTime, size: f.size ? Number(f.size) : null, icon: f.iconLink || null, url: f.webViewLink || null })
    }
    if (!(page = j.nextPageToken)) break
  }
  res.json({ folder: { id: meta.id, name: meta.name, url: meta.webViewLink }, items })
}, { limit: 90 })
