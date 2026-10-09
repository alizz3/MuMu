// Icono de línea para cosas que antes mostraban un emoji (hábitos, objetivos, rutinas, cuartos…).
// El campo `emoji` se conserva en los datos, pero ya no se muestra: el icono sale de la categoría o del tipo.
import { state } from '../store'

export const GOAL_ICON = {
  carrera: 'briefcase', universidad: 'cap', trabajo: 'briefcase', dinero: 'wallet', aprendizaje: 'book', 'inglés': 'globe',
  'vida personal': 'leaf', familia: 'heart', espiritualidad: 'dove', proyectos: 'rocket', bienestar: 'sun',
}
export const goalIcon = (g) => (g && GOAL_ICON[g.category]) || 'target'

const HABIT_WORDS = [
  [/dios|ora(r|ción)|biblia|devocional/i, 'dove'], [/dorm|sueño|acostar/i, 'moon'], [/despert|madrug/i, 'sun'],
  [/ingl[eé]s|idioma/i, 'globe'], [/estudi|leer|lectura|libro/i, 'book'], [/proyecto|c[oó]digo|program|portafolio/i, 'laptop'],
  [/agua|tomar/i, 'drop'], [/ejercicio|caminar|correr|gym|entren/i, 'zap'], [/familia|pap[aá]s|mam[aá]/i, 'heart'],
  [/m[uú]sica|guitarra|piano/i, 'music'], [/celular|pantalla|redes/i, 'phone'], [/ahorr|dinero|gasto/i, 'wallet'],
]
const WHEN_ICON = { 'mañana': 'sun', tarde: 'clock', noche: 'moon' }
export function habitIcon(h) {
  if (!h) return 'check'
  const w = HABIT_WORDS.find(([re]) => re.test(h.name || ''))
  if (w) return w[1]
  const g = h.goalId && state.goals.find((x) => x.id === h.goalId)
  if (g && GOAL_ICON[g.category]) return GOAL_ICON[g.category]
  return WHEN_ICON[h.when] || 'check'
}

const ROUTINE_WORDS = [[/mañana/i, 'sun'], [/noche/i, 'moon'], [/universidad|clase/i, 'cap'], [/estudi/i, 'book'], [/trabajo/i, 'briefcase'], [/fin de semana|descanso/i, 'leaf']]
export const routineIcon = (r) => ROUTINE_WORDS.find(([re]) => re.test(r?.name || ''))?.[1] || 'routine'

export const ROOM_ICON = { dormitorio: 'bed', cocina: 'pan', patio: 'tree', bano: 'bath', estudio: 'book' }
export const roomIcon = (r) => r?.icon || ROOM_ICON[r?.id] || 'house'

export const RESOURCE_ICON = { libro: 'book', podcast: 'headphones', video: 'film', conferencia: 'mic', nota: 'note', idea: 'bulb' }

// Escala de 1 a 5 (cómo te sentiste, calidad del sueño)
export const FACES = ['face1', 'face2', 'face3', 'face4', 'face5']
export const FEELINGS = ['Muy mal', 'Mal', 'Normal', 'Bien', 'Genial']

// Quita emojis de textos que vienen de datos viejos (historial de monedas, avisos guardados)
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2B07}\u{2B05}\u{2705}\u{274C}\u{23E9}-\u{23FA}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu
export const stripEmoji = (s) => String(s ?? '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim()
