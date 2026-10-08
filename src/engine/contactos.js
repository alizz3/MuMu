// Importa profes desde el CSV de Google Contacts (Exportar → Google CSV).
// Cada contacto con "Organization Title" (la materia) y un correo se vuelve el docente de esa materia.
import { state } from '../store'
import { uid } from './time'

export function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  const [head, ...data] = rows
  return data.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])))
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const COLORS = ['#C3B3D4', '#F7B6C2', '#B9DCCB', '#BFD7F0', '#F6DC8B', '#FAD6A5']

export function importProfes(text) {
  const rows = parseCSV(text)
  let created = 0, updated = 0
  for (const r of rows) {
    const materia = r['Organization Title'] || r['Organization Department']
    const email = r['E-mail 1 - Value'] || r['E-mail 2 - Value']
    if (!materia || !email) continue
    const nombre = [r['First Name'], r['Middle Name'], r['Last Name']].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const tel = r['Phone 1 - Value'] || r['Phone 2 - Value'] || ''
    const sem = (r['Labels'] || '').split(':::').map((x) => x.trim()).find((x) => /semestre/i.test(x)) || ''
    const n = norm(materia)
    const sj = state.subjects.find((s) => norm(s.name) === n || norm(s.name).includes(n) || n.includes(norm(s.name)) || (s.short && norm(s.short).length > 3 && n.includes(norm(s.short))))
    if (sj) { Object.assign(sj, { teacher: nombre || sj.teacher, teacherEmail: email.toLowerCase(), teacherPhone: tel || sj.teacherPhone, semester: sem || sj.semester }); updated++ }
    else {
      state.subjects.push({ id: uid('s'), name: materia, short: materia.split(' ').slice(0, 2).join(' '), institution: /tolima/i.test(r['Organization Name']) ? 'UT' : 'Otra', color: COLORS[state.subjects.length % COLORS.length], teacher: nombre, teacherEmail: email.toLowerCase(), teacherPhone: tel, semester: sem, schedule: [], notes: '' })
      created++
    }
  }
  return { created, updated }
}
