// Modo U: muestra solo lo de la universidad. Se activa solo al entrar con la cuenta de la U
// (o con el botón 🎓), y la elección se recuerda por cuenta en este dispositivo.
import { state, ui } from '../store'
import { BRAND } from '../config/brand'

const key = (email) => `mumu:modoU:${(email || 'local').toLowerCase()}`
const isUniEmail = (email) => String(email || '').toLowerCase().endsWith('@' + BRAND.uniDomain)

export function initModoU(email) {
  let saved = null
  try { saved = localStorage.getItem(key(email)) } catch { /* sin almacenamiento */ }
  ui.modoU = saved == null ? isUniEmail(email) : saved === '1'
}
export function setModoU(on) {
  ui.modoU = on
  try { localStorage.setItem(key(ui.user?.email), on ? '1' : '0') } catch { /* sin almacenamiento */ }
}

const uniTask = (t) => !!t && (t.category === 'universidad' || !!t.subjectId || ['aula', 'classroom'].includes(t.source) || t.goalId === 'g1')

export function inScope(kind, x) {
  if (!ui.modoU) return true
  switch (kind) {
    case 'task': return uniTask(x)
    case 'email': return x.account === 'universidad' || isUniEmail(x.fromEmail) || !!x.profe || String(x.from || '').toLowerCase().includes('tu aula')
    case 'event': return ['clase', 'estudio'].includes(x.type) || !!x.subjectId || (x.type === 'bloque' && uniTask(state.tasks.find((t) => t.id === x.taskId)))
    case 'goal': return ['universidad', 'aprendizaje', 'inglés'].includes(x.category)
    case 'project': return x.area === 'universidad'
    case 'habit': { const g = state.goals.find((gg) => gg.id === x.goalId); return !!g && ['universidad', 'aprendizaje', 'inglés'].includes(g.category) }
    default: return true
  }
}
