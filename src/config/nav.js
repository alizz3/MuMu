export const NAV = [
  { group: 'Hoy', items: [
    { id: 'home', label: 'Inicio', icon: 'home' },
    { id: 'agenda', label: 'Agenda', icon: 'calendar' },
    { id: 'tareas', label: 'Tareas', icon: 'list' },
    { id: 'enfoque', label: 'Modo enfoque', icon: 'timer' },
  ] },
  { group: 'Crecer', items: [
    { id: 'objetivos', label: 'Objetivos', icon: 'target' },
    { id: 'proyectos', label: 'Proyectos', icon: 'folder' },
    { id: 'habitos', label: 'Hábitos', icon: 'heart' },
    { id: 'rutinas', label: 'Rutinas', icon: 'routine' },
    { id: 'sueno', label: 'Sueño', icon: 'moon' },
    { id: 'celular', label: 'Celular y redes', icon: 'phone' },
  ] },
  { group: 'Estudio y trabajo', items: [
    { id: 'universidad', label: 'Universidad', icon: 'cap' },
    { id: 'correo', label: 'Correo', icon: 'mail' },
    { id: 'cerebro', label: 'Mi cerebro', icon: 'brain' },
    { id: 'experimentos', label: 'Experimentos', icon: 'flask' },
    { id: 'aprendizaje', label: 'Cursos · Platzi', icon: 'book' },
    { id: 'trabajo', label: 'Trabajo y carrera', icon: 'briefcase' },
  ] },
  { group: 'Vida', items: [
    { id: 'vida', label: 'Vida', icon: 'leaf' },
    { id: 'dios', label: 'Espacio con Dios', icon: 'dove' },
    { id: 'finanzas', label: 'Finanzas', icon: 'wallet' },
    { id: 'analitica', label: 'Analítica', icon: 'chart' },
    { id: 'casa', label: 'Casa de la vaquita', icon: 'house' },
  ] },
  { group: 'Sistema', items: [
    { id: 'alarmas', label: 'Alarmas', icon: 'alarm' },
    { id: 'notificaciones', label: 'Notificaciones', icon: 'bell' },
    { id: 'ajustes', label: 'Configuración', icon: 'settings' },
  ] },
]
export const ALL = NAV.flatMap((g) => g.items)
export const BOTTOM = ['home', 'agenda', 'habitos', 'universidad', 'mas']
export const titleOf = (id) => ALL.find((x) => x.id === id)?.label || { habito: 'Hábito' }[id] || 'Más'
