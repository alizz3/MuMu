// Garaje — archivos privados: se suben en partes al servidor (con tu sesión) y se bajan igual.
// Las fotos se achican antes de subir (máx. 1600 px) para que suban rápido con datos móviles.
import { vfilePut, vfileGet, vfileDelete, vfileFetchManual } from '../../services/api'
import { addFileMeta, removeFileMeta } from './actions'

const PART = 700 * 1024
const rid = () => `vf_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s) }

async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file
  try {
    const img = await createImageBitmap(file)
    const k = Math.min(1, 1600 / Math.max(img.width, img.height))
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) })
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82))
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file
  } catch { return file }
}

// Sube un archivo y lo registra en el vehículo. onProgress(0..1)
export async function uploadFile(file, { vehicleId, kind = 'otro', note = '' }, onProgress = () => {}) {
  if (!file) throw new Error('Elige un archivo')
  const f = await shrinkImage(file)
  if (f.size > 25 * 1024 * 1024) throw new Error('El archivo pasa de 25 MB')
  const mime = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : 'application/octet-stream')
  const buf = await f.arrayBuffer()
  const id = rid(), total = Math.max(1, Math.ceil(buf.byteLength / PART))
  for (let i = 0; i < total; i++) {
    await vfilePut({ id, part: i, total, name: f.name, mime, size: buf.byteLength, vehicleId, data: toB64(buf.slice(i * PART, (i + 1) * PART)) })
    onProgress((i + 1) / total)
  }
  return addFileMeta({ id, vehicleId, name: f.name, mime, size: buf.byteLength, kind, note, storage: 'mumu' })
}

// El servidor descarga el manual oficial (Honda) y lo guarda en privado
export async function saveManualCopy({ vehicleId, url, name }) {
  const id = rid()
  const r = await vfileFetchManual({ id, vehicleId, url })
  return addFileMeta({ id, vehicleId, name: name || 'Manual del propietario (copia guardada)', mime: 'application/pdf', size: r.size, kind: 'manual', storage: 'mumu', source: url, note: `Copia guardada desde ${new URL(url).hostname}${r.lastModified ? ` · versión del ${new Date(r.lastModified).toLocaleDateString('es-CO')}` : ''}` })
}

const cache = new Map()
export async function fileBlob(meta, onProgress = () => {}) {
  if (cache.has(meta.id)) return cache.get(meta.id)
  const first = await vfileGet(meta.id, 0)
  const parts = [first]
  onProgress(1 / first.total)
  for (let i = 1; i < first.total; i++) { parts.push(await vfileGet(meta.id, i)); onProgress((i + 1) / first.total) }
  const bytes = parts.map((p) => Uint8Array.from(atob(p.data), (c) => c.charCodeAt(0)))
  const blob = new Blob(bytes, { type: first.mime })
  cache.set(meta.id, blob)
  return blob
}
// Abre (o descarga) el archivo sin hacerlo público: se arma en tu equipo desde las partes privadas
export async function openFile(meta, { download = false } = {}, onProgress) {
  if (meta.storage === 'link') { window.open(meta.url, '_blank', 'noopener'); return }
  const w = !download ? window.open('', '_blank') : null
  const url = URL.createObjectURL(await fileBlob(meta, onProgress))
  if (download || !w) { const a = Object.assign(document.createElement('a'), { href: url, download: meta.name }); a.click() }
  else w.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60e3)
}
export async function thumbUrl(meta) { return URL.createObjectURL(await fileBlob(meta)) }
export async function deleteFile(meta) {
  if (meta.storage === 'mumu') await vfileDelete(meta.id).catch((e) => { if (!/404/.test(e.message)) throw e })
  removeFileMeta(meta.id); cache.delete(meta.id)
}
