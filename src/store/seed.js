// Datos iniciales. Todo lo marcado con `demo: true` es de ejemplo y se borra desde
// Configuración → Privacidad → "Empezar en limpio". Los correos y actividades de Aula
// de ejemplo NO vienen de ninguna integración real: aparecen con la etiqueta "ejemplo".
import { BRAND } from '../config/brand'
import { keyPlus, rng, dayKey } from '../engine/time'

export const SCHEMA_VERSION = 1

export function seed() {
  const r = rng(42)
  const past = (n) => keyPlus(-n)

  const goals = [
    { id: 'g1', name: 'Graduarme con excelencia', category: 'universidad', description: 'Ingeniería de Sistemas en la Universidad del Tolima.', due: keyPlus(900), emoji: '🎓', progress: 35 },
    { id: 'g2', name: 'Mejorar mi inglés', category: 'inglés', description: 'Poder tener una entrevista de trabajo en inglés.', due: keyPlus(240), emoji: '🇺🇸', progress: 0 },
    { id: 'g3', name: 'Portafolio y perfil profesional', category: 'carrera', description: 'Un portafolio que me consiga trabajo y clientes freelance.', due: keyPlus(60), emoji: '💼', progress: 0 },
    { id: 'g4', name: 'Independencia financiera', category: 'dinero', description: 'Ingresos estables como desarrolladora.', due: keyPlus(540), emoji: '💰', progress: 15 },
    { id: 'g5', name: 'Vida equilibrada con mi familia', category: 'familia', description: 'Tiempo de calidad con mis papás, Leo y Negra.', due: null, emoji: '🤍', progress: 0 },
    { id: 'g6', name: 'Crecer en mi relación con Dios', category: 'espiritualidad', description: 'Un espacio diario, sin presión.', due: null, emoji: '🕊️', progress: 0 },
  ]

  const projects = [
    { id: 'p1', name: 'Portafolio profesional', goalId: 'g3', status: 'progreso', area: 'carrera', color: '#C3B3D4', description: 'Proyectos, demos interactivas y CV.', resources: ['github.com/alizz3'], skills: ['Vue', 'Diseño UI'], due: keyPlus(30) },
    { id: 'p2', name: 'Emily Pizza · menú web', goalId: 'g4', status: 'progreso', area: 'freelance', color: '#F7B6C2', description: 'Menú digital para el local de unos amigos.', resources: [], skills: ['HTML/CSS', 'JS'], due: keyPlus(10) },
    { id: 'p3', name: 'Vamos donde Nata', goalId: 'g4', status: 'plan', area: 'freelance', color: '#FAD6A5', description: 'Menú digital con modo mesero y admin.', resources: [], skills: ['Vue', 'Firebase'], due: keyPlus(25) },
    { id: 'p4', name: BRAND.appName, goalId: 'g3', status: 'progreso', area: 'personal', color: '#B9DCCB', description: 'Mi sistema operativo personal 🐮', resources: [], skills: ['Vue', 'Arquitectura'], due: null },
    { id: 'p5', name: 'Plan de inglés', goalId: 'g2', status: 'progreso', area: 'aprendizaje', color: '#BFD7F0', description: 'Listening diario + curso.', resources: [], skills: ['Inglés'], due: null },
  ]

  const subjects = [
    { id: 's1', name: 'Programación Orientada a Objetos', short: 'POO', institution: 'UT', color: '#C3B3D4', teacher: 'Edwin Mateus', schedule: [{ weekday: 0, start: '08:00', end: '10:00' }], notes: '' },
    { id: 's2', name: 'Ética Profesional', short: 'Ética', institution: 'UT', color: '#F6DC8B', teacher: 'María Arévalo', schedule: [{ weekday: 0, start: '10:30', end: '12:00' }], notes: '' },
    { id: 's3', name: 'Teoría de Sistemas', short: 'Sistemas', institution: 'UT', color: '#B9DCCB', teacher: 'Edna Triana', schedule: [{ weekday: 0, start: '13:00', end: '15:00' }], notes: '' },
    { id: 's4', name: 'Estadística', short: 'Estadística', institution: 'UT', color: '#F7B6C2', teacher: '', schedule: [{ weekday: 0, start: '15:30', end: '17:00' }], notes: '' },
  ]

  const T = (o) => ({ status: 'pendiente', priority: 'media', tags: [], subtasks: [], notes: '', postponed: 0, createdAt: past(3), source: 'manual', estimate: 30, category: 'personal', ...o })
  const tasks = [
    T({ id: 't1', title: 'Resolver taller de POO: clases y objetos', subjectId: 's1', goalId: 'g1', category: 'universidad', source: 'aula', demo: true, priority: 'alta', due: keyPlus(2), estimate: 120, postponed: 2, subtasks: [{ id: 'st1', title: 'Leer el enunciado', done: true }, { id: 'st2', title: 'Diagrama de clases', done: false }, { id: 'st3', title: 'Código en Java', done: false }] }),
    T({ id: 't2', title: 'Ejercicios de distribución normal', subjectId: 's4', goalId: 'g1', category: 'universidad', source: 'aula', demo: true, priority: 'alta', due: keyPlus(1), estimate: 60 }),
    T({ id: 't3', title: 'Lectura: dilemas éticos en software', subjectId: 's2', goalId: 'g1', category: 'universidad', source: 'aula', demo: true, due: keyPlus(5), estimate: 45 }),
    T({ id: 't4', title: 'Responder correo de coordinación IDEAD', category: 'universidad', source: 'gmail', demo: true, priority: 'alta', due: keyPlus(0), estimate: 10 }),
    T({ id: 't5', title: 'Sección "Proyectos" del portafolio', projectId: 'p1', goalId: 'g3', category: 'trabajo', due: keyPlus(6), estimate: 90, status: 'en progreso' }),
    T({ id: 't6', title: 'Ajustar precios del menú de Emily Pizza', projectId: 'p2', goalId: 'g4', category: 'trabajo', due: keyPlus(3), estimate: 40 }),
    T({ id: 't7', title: 'Listening en inglés (podcast corto)', projectId: 'p5', goalId: 'g2', category: 'aprendizaje', due: keyPlus(0), estimate: 20, priority: 'baja' }),
    T({ id: 't8', title: 'Wireframe del modo mesero', projectId: 'p3', goalId: 'g4', category: 'trabajo', due: keyPlus(9), estimate: 60, priority: 'baja' }),
    T({ id: 't9', title: 'Organizar escritorio y cuaderno', category: 'vida', due: null, estimate: 15, priority: 'baja' }),
    T({ id: 't10', title: 'Mapa conceptual de Teoría de Sistemas', subjectId: 's3', goalId: 'g1', category: 'universidad', source: 'aula', demo: true, due: keyPlus(4), estimate: 75 }),
    T({ id: 't11', title: 'Subir demo de Cuidapp al portafolio', projectId: 'p1', goalId: 'g3', category: 'trabajo', status: 'completada', completedAt: past(1), due: past(1), estimate: 30 }),
    T({ id: 't12', title: 'Entregar quiz de Ética', subjectId: 's2', category: 'universidad', status: 'completada', completedAt: past(2), due: past(2), estimate: 20 }),
  ]

  const today = dayKey()
  const events = [
    { id: 'e1', title: 'Almuerzo en familia', date: today, start: '12:30', end: '13:30', type: 'familia', source: 'manual' },
    { id: 'e2', title: 'Reunión con Emily Pizza', date: keyPlus(1), start: '16:00', end: '16:45', type: 'trabajo', source: 'manual', projectId: 'p2' },
    { id: 'e3', title: 'Paseo con Negra', date: today, start: '17:30', end: '18:00', type: 'vida', source: 'manual', recurring: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'e4', title: 'Desayuno familiar', date: today, start: '08:30', end: '09:00', type: 'familia', source: 'rutina', recurring: [1, 2, 3, 4, 5, 6] },
  ]

  const habits = [
    { id: 'h1', name: 'Despertar ~6:30', emoji: '☀️', when: 'mañana', target: 7, goalId: null, color: '#FAD6A5' },
    { id: 'h2', name: 'Tiempo con Dios', emoji: '🕊️', when: 'mañana', target: 7, goalId: 'g6', color: '#E8DDF5' },
    { id: 'h3', name: 'Bloque de estudio profundo', emoji: '📚', when: 'tarde', target: 5, goalId: 'g1', color: '#C3B3D4' },
    { id: 'h4', name: 'Inglés 20 min', emoji: '🎧', when: 'tarde', target: 5, goalId: 'g2', color: '#BFD7F0' },
    { id: 'h5', name: 'Avanzar en proyectos', emoji: '💻', when: 'tarde', target: 5, goalId: 'g3', color: '#B9DCCB' },
    { id: 'h6', name: 'Dormir antes de las 11', emoji: '🌙', when: 'noche', target: 7, goalId: null, color: '#F7B6C2' },
  ]
  const habitLogs = {}
  habits.forEach((h, i) => {
    habitLogs[h.id] = {}
    for (let d = 1; d <= 24; d++) if (r() < 0.55 + i * 0.04 - (d < 4 ? 0.2 : 0)) habitLogs[h.id][past(d)] = { done: true }
  })
  habitLogs.h2[today] = { done: true, note: 'Oración corta antes de desayunar' }

  const sleep = [], screen = [], focus = []
  for (let d = 1; d <= 21; d++) {
    const bed = 22 * 60 + Math.round(r() * 150) // 22:00–00:30
    const dur = 6 * 60 + Math.round(r() * 150)
    const wake = (bed + dur) % 1440
    const quality = Math.min(5, Math.max(1, Math.round(dur / 100 - 1 + r())))
    sleep.push({ id: `sl${d}`, date: past(d), bed: minToHM(bed), wake: minToHM(wake), minutes: dur, quality, hardWake: dur < 400 ? 4 : 2, notes: '' })
    const social = Math.round(60 + r() * 150 + (dur < 400 ? 60 : 0))
    screen.push({ id: `sc${d}`, date: past(d), total: social + 90 + Math.round(r() * 60), apps: { tiktok: Math.round(social * 0.5), instagram: Math.round(social * 0.3), facebook: Math.round(social * 0.05), whatsapp: Math.round(social * 0.15) } })
    const n = Math.max(0, Math.round((dur - 330) / 70 + r() * 1.5 - social / 200))
    for (let k = 0; k < n; k++) {
      const hour = r() < 0.6 ? 7 + Math.round(r() * 4) : 14 + Math.round(r() * 7)
      const minutes = r() < 0.5 ? 25 : r() < 0.5 ? 5 : 45
      focus.push({ id: `f${d}_${k}`, date: past(d), hour, minutes, mode: minutes === 5 ? 'empezar' : 'pomodoro', taskId: null, outcome: r() < (hour < 12 ? 0.8 : 0.55) ? 'logrado' : 'parcial', started: true })
    }
  }
  sleep.unshift({ id: 'sl0', date: today, bed: '23:10', wake: '06:40', minutes: 450, quality: 4, hardWake: 2, notes: '' })

  const intentions = [
    { id: 'i1', date: past(1), at: '15:10', want: 'Revisar Aula', minutes: 10, reason: 'estudiar', result: 'distraje', endedIn: 'TikTok' },
    { id: 'i2', date: past(2), at: '09:20', want: 'Buscar info del taller', minutes: 15, reason: 'buscar', result: 'logrado' },
    { id: 'i3', date: past(3), at: '21:40', want: 'Contestar a mi mamá', minutes: 5, reason: 'hablar', result: 'logrado' },
    { id: 'i4', date: past(4), at: '16:30', want: 'Nada, aburrimiento', minutes: 0, reason: 'aburrimiento', result: 'distraje', endedIn: 'Instagram' },
  ]

  const resources = [
    { id: 'r1', type: 'libro', title: 'Atomic Habits', author: 'James Clear', status: 'leyendo', progress: 45, concepts: ['hábitos', 'identidad', 'sistemas', 'entorno', 'empezar pequeño', 'volver después de fallar'], notes: 'Los hábitos son votos por la persona que quiero ser.' },
    { id: 'r2', type: 'libro', title: 'The 5 AM Club', author: 'Robin Sharma', status: 'leído', progress: 100, concepts: ['mañanas', 'primeras horas', 'proteger tiempo', 'rutina'], notes: 'Me quedo con la idea de proteger la primera hora, no con la hora exacta.' },
    { id: 'r3', type: 'conferencia', title: 'Prioridades y acción', author: 'Brian Tracy', status: 'pendiente', progress: 0, minutes: 45, concepts: ['disciplina', 'prioridades', 'hacer primero lo importante', 'no esperar motivación', 'planificación'], notes: '' },
    { id: 'r4', type: 'podcast', title: 'Estás Rica', author: 'Dani Sayan', status: 'escuchando', progress: 30, concepts: ['límites', 'autoestima', 'apego', 'ambición', 'responsabilidad emocional', 'dejar de autoengañarse'], notes: 'Episodio sobre límites sanos.' },
    { id: 'r5', type: 'video', title: 'Cómo organizo mi semana', author: 'YouTube', status: 'pendiente', progress: 0, minutes: 18, concepts: ['planificación'], notes: '' },
    { id: 'r6', type: 'nota', title: 'Ideas sobre hábitos', author: 'Yo', status: 'activo', progress: 0, concepts: ['hábitos'], notes: 'Cuando estudio después del desayuno me rinde más.' },
  ]

  const courses = [
    { id: 'c1', title: 'Curso de JavaScript', platform: 'Platzi', progress: 60, hours: 6, goalId: 'g3', projectId: 'p1', skill: 'JavaScript', status: 'en curso', practice: 'Filtros interactivos del portafolio', sessions: [past(2), past(5)] },
    { id: 'c2', title: 'Curso de Inglés Básico', platform: 'Platzi', progress: 25, hours: 3, goalId: 'g2', projectId: 'p5', skill: 'Inglés', status: 'en curso', practice: 'Escribir el README del portafolio en inglés', sessions: [past(1)] },
    { id: 'c3', title: 'Curso de Firebase', platform: 'Platzi', progress: 100, hours: 5, goalId: 'g4', projectId: 'p3', skill: 'Firebase', status: 'completado', practice: 'Login con Google en Maletica', sessions: [] },
  ]

  const principles = [
    { id: 'pr1', text: 'Haz que empezar sea fácil', sourceId: 'r1', author: 'James Clear', tags: ['procrastinación', 'empezar'], action: 'Hazlo solo 2–5 minutos.', status: 'probando' },
    { id: 'pr2', text: 'Nunca fallar dos veces seguidas', sourceId: 'r1', author: 'James Clear', tags: ['rachas', 'volver'], action: 'Si ayer no pude, hoy una versión mini.', status: 'idea' },
    { id: 'pr3', text: 'Cada acción es un voto por quien quiero ser', sourceId: 'r1', author: 'James Clear', tags: ['identidad', 'hábitos'], action: 'Nombra la identidad detrás del hábito.', status: 'idea' },
    { id: 'pr4', text: 'Lo más importante va primero', sourceId: 'r3', author: 'Brian Tracy', tags: ['prioridad', 'procrastinación', 'mañana'], action: 'Elige la tarea de mayor impacto y empiézala antes que todo.', status: 'idea' },
    { id: 'pr5', text: 'Planear la noche anterior', sourceId: 'r3', author: 'Brian Tracy', tags: ['planificación', 'noche'], action: 'Antes de dormir, elige la prioridad de mañana.', status: 'idea' },
    { id: 'pr6', text: 'Proteger la primera hora del día', sourceId: 'r2', author: 'Robin Sharma', tags: ['mañana', 'rutina'], action: 'Primera hora sin redes.', status: 'validado' },
    { id: 'pr7', text: 'Los límites también son amor propio', sourceId: 'r4', author: 'Dani Sayan', tags: ['límites', 'autoestima'], action: 'Hoy di que no a algo que no te suma.', status: 'idea' },
    { id: 'pr8', text: 'Nombrar lo que estoy evitando', sourceId: 'r4', author: 'Dani Sayan', tags: ['autoengaño', 'procrastinación'], action: 'Escribe en una frase qué estás evitando y por qué.', status: 'idea' },
  ]

  const experiments = [
    { id: 'x1', title: '5 minutos para empezar', principleId: 'pr1', hypothesis: 'Si solo me comprometo a 5 minutos, empezaré más tareas difíciles.', days: 7, start: past(3), status: 'activo', logs: { [past(3)]: { did: true, felt: 4, note: 'Empecé el taller y seguí 40 min' }, [past(2)]: { did: true, felt: 3 }, [past(1)]: { did: false, felt: 2, note: 'Día pesado' } }, result: null, conclusion: '' },
    { id: 'x2', title: 'Primera hora protegida', principleId: 'pr6', hypothesis: 'Sin celular la primera hora, me concentro más en la mañana.', days: 7, start: past(20), status: 'terminado', logs: {}, result: 'parcial', difficulty: 3, conclusion: 'Funciona si me levanto ~6:30. A las 5 a.m. no me funciona y abandono.', learnings: ['Las rutinas demasiado rígidas me hacen abandonar.', 'Mi mejor bloque de concentración es temprano, después de orar.'] },
  ]

  const emails = [
    { id: 'm1', demo: true, account: 'universidad', from: 'Coordinación IDEAD', subject: 'Cambio de fecha de parciales', snippet: 'Les informamos que los parciales se mueven al domingo...', date: today, category: 'importante', status: 'nuevo', taskId: 't4' },
    { id: 'm2', demo: true, account: 'universidad', from: 'Tu Aula', subject: 'Nueva actividad: Taller clases y objetos', snippet: 'Se ha publicado una nueva tarea en Programación Orientada a Objetos', date: keyPlus(-1), category: 'importante', status: 'convertido', taskId: 't1' },
    { id: 'm3', demo: true, account: 'personal', from: 'Platzi', subject: 'Tu ruta de aprendizaje de la semana', snippet: 'Continúa tu Curso de JavaScript...', date: keyPlus(-1), category: 'informativo', status: 'nuevo' },
    { id: 'm4', demo: true, account: 'personal', from: 'Emily Pizza', subject: 'Fotos nuevas para el menú', snippet: 'Hola! te mando las fotos de las pizzas nuevas para...', date: today, category: 'revisar', status: 'nuevo' },
  ]

  const aula = [
    { id: 'a1', demo: true, externalId: 'demo-1', courseId: 's1', type: 'assign', title: 'Taller: clases y objetos', due: keyPlus(2), firstSeen: past(1), changed: false, taskId: 't1' },
    { id: 'a2', demo: true, externalId: 'demo-2', courseId: 's4', type: 'assign', title: 'Ejercicios distribución normal', due: keyPlus(1), firstSeen: past(4), changed: true, changeNote: 'La fecha cambió (antes vencía el viernes)', taskId: 't2' },
    { id: 'a3', demo: true, externalId: 'demo-3', courseId: 's2', type: 'forum', title: 'Anuncio: rúbrica del ensayo final', due: null, firstSeen: today, changed: false },
  ]

  return {
    v: SCHEMA_VERSION,
    profile: { name: BRAND.ownerName, wake: '06:30', sleep: '22:30', energy: { morning: 'alta', afternoon: 'media', night: 'baja' }, lastVisit: today },
    settings: {
      appName: BRAND.appName, ownerName: BRAND.ownerName, financeAppName: BRAND.financeAppName, financeAppUrl: BRAND.financeAppUrl,
      theme: 'auto', petAccessory: 'bow',
      notify: { aula: true, email: true, freeTime: true, classes: true, habits: true, quiet: ['22:30', '06:00'], browser: false },
      demo: true,
    },
    goals, projects, subjects, tasks, events, habits, habitLogs,
    routines: [
      { id: 'ro1', name: 'Mañana', emoji: '🌅', steps: [{ t: 'Despertar', at: '06:30' }, { t: 'Higiene', min: 15 }, { t: 'Tiempo con Dios', min: 15 }, { t: 'Bloque de concentración', min: 60 }, { t: 'Desayuno familiar', at: '08:30' }, { t: 'Empezar el día', at: '09:00' }], flexible: true },
      { id: 'ro2', name: 'Noche', emoji: '🌙', steps: [{ t: 'Dejar mañana preparado', min: 10 }, { t: 'Oración de la noche', min: 10 }, { t: 'Celular lejos de la cama', min: 1 }, { t: 'Dormir', at: '22:30' }], flexible: true },
      { id: 'ro3', name: 'Estudio', emoji: '📚', steps: [{ t: 'Agua + escritorio limpio', min: 3 }, { t: 'Elegir UNA tarea', min: 2 }, { t: 'Bloque 25 min', min: 25 }, { t: 'Pausa', min: 5 }], flexible: true },
      { id: 'ro4', name: 'Trabajo', emoji: '💻', steps: [{ t: 'Revisar correos importantes', min: 10 }, { t: 'Bloque de proyecto', min: 50 }, { t: 'Commit y notas', min: 5 }], flexible: true },
      { id: 'ro5', name: 'Universidad (domingo)', emoji: '🎓', steps: [{ t: 'Revisar Aula', min: 10 }, { t: 'Preparar materiales', min: 10 }, { t: 'Clases', at: '08:00' }], flexible: true },
      { id: 'ro6', name: 'Fin de semana', emoji: '🧺', steps: [{ t: 'Descanso sin culpa', min: 60 }, { t: 'Planear la semana', min: 20 }, { t: 'Tiempo en familia', min: 120 }], flexible: true },
    ],
    routineLogs: {},
    sleep, screen, intentions, focus,
    resources, courses, principles, experiments,
    notes: [],
    emails, aula,
    god: { entries: { [past(1)]: { teach: 'Paciencia conmigo misma', grateful: 'Por mi papá y su salud', give: 'Mi ansiedad por los parciales', prayers: { morning: true, night: true } } } },
    life: [
      { id: 'l1', date: past(1), type: 'familia', title: 'Película con mis papás', minutes: 120, feeling: 5 },
      { id: 'l2', date: past(2), type: 'mascotas', title: 'Jugar con Leo', minutes: 20, feeling: 5 },
      { id: 'l3', date: past(3), type: 'descanso', title: 'Siesta sin culpa', minutes: 40, feeling: 4 },
    ],
    finance: { connected: false, demo: true, summary: { month: 'Este mes', income: 1200000, expenses: 820000, balance: 380000, debts: 0, nextPayments: [{ name: 'Plan de celular', amount: 55000, due: keyPlus(6) }], goal: { name: 'Fondo de emergencia', progress: 22 } } },
    notifications: [],
    game: { coins: 120, xp: 180, owned: ['bed-basic', 'plant-small', 'window', 'wall-pink', 'leo', 'negra', 'bow'], placed: { wall: 'wall-pink', bed: 'bed-basic', plantL: 'plant-small', window: 'window', leo: 'leo', negra: 'negra' }, accessory: 'bow', history: [] },
    missionsDone: {},
    daily: {},
    opportunities: [],
    inbox: [],
    integrations: { google: [], aula: { status: 'no-conectado', method: null, lastSync: null, site: '' }, classroom: { status: 'no-conectado' }, platzi: { status: 'manual' }, finance: { status: 'no-conectado' } },
    pendingSync: [],
  }
}

function minToHM(min) { min = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }
