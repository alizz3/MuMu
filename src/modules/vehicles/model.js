// Módulo de Vehículos — modelo de datos (independiente de la interfaz de MuMu).
// Todo vive en una sola colección de MuMu: state.vehicles (users/{uid}/data/vehicles en Firestore),
// con una lista por entidad e identificadores estables. Así se puede exportar o migrar tal cual
// a una app propia (ver docs/VEHICULOS.md).
//
// Entidades (todas con id y vehicleId):
//   vehicles   → el vehículo (moto, carro, camioneta u otro)
//   readings   → lecturas del odómetro (con correcciones justificadas)
//   services   → visitas al taller / intervenciones (con varios trabajos = items)
//   plans      → plan de mantenimiento por componente (km y/o tiempo), con su fuente
//   documents  → SOAT, RTM y otros, con historial de renovaciones (status vigente/reemplazado)
//   expenses   → gastos (combustible, repuestos, parqueadero…)
//   fuel       → tanqueadas (cantidad, unidad, km) — cada una enlazada a su gasto
//   files      → archivos guardados en privado en el servidor (manuales, facturas, fotos)
//   shops      → talleres (nombre, mecánico, ubicación, teléfono)
//   categories → categorías propias de mantenimiento

export const SCHEMA = 1

export const VEHICLE_TYPES = [
  { id: 'moto', label: 'Motocicleta', icon: 'moto' },
  { id: 'carro', label: 'Automóvil', icon: 'car' },
  { id: 'camioneta', label: 'Camioneta', icon: 'car' },
  { id: 'otro', label: 'Otro', icon: 'tool' },
]

// Componentes de mantenimiento. "types" limita a qué vehículos aplica (vacío = todos).
export const BASE_CATEGORIES = [
  { id: 'aceite', name: 'Aceite del motor' },
  { id: 'filtro_aire', name: 'Filtro de aire' },
  { id: 'bujia', name: 'Bujía', types: ['moto', 'carro', 'camioneta', 'otro'] },
  { id: 'bateria', name: 'Batería' },
  { id: 'electrico', name: 'Sistema eléctrico' },
  { id: 'frenos', name: 'Frenos' },
  { id: 'llantas', name: 'Llantas, desgaste y presión' },
  { id: 'transmision', name: 'Transmisión final y lubricación', types: ['moto'] },
  { id: 'correa', name: 'Correa de transmisión (CVT)', types: ['moto'] },
  { id: 'cadena', name: 'Cadena y piñones', types: ['moto'] },
  { id: 'refrigerante', name: 'Refrigerante', types: ['carro', 'camioneta'] },
  { id: 'filtro_aceite', name: 'Filtro de aceite', types: ['carro', 'camioneta'] },
  { id: 'alineacion', name: 'Alineación y balanceo', types: ['carro', 'camioneta'] },
  { id: 'valvulas', name: 'Holgura de válvulas' },
  { id: 'inspeccion', name: 'Inspección general' },
  { id: 'sincronizacion', name: 'Ajustes o sincronización del motor' },
  { id: 'reparacion', name: 'Reparaciones' },
  { id: 'otros', name: 'Otros' },
]

// Lo que se le hace: no todo es cambiar la pieza
export const ACTIONS = [
  { id: 'inspeccionar', label: 'Inspeccionar' },
  { id: 'limpiar', label: 'Limpiar' },
  { id: 'lubricar', label: 'Lubricar' },
  { id: 'ajustar', label: 'Ajustar' },
  { id: 'reemplazar', label: 'Reemplazar' },
  { id: 'recargar', label: 'Recargar' },
  { id: 'reparar', label: 'Reparar' },
  { id: 'otro', label: 'Otro' },
]

export const SERVICE_STATUS = {
  realizado: { label: 'Realizado', badge: 'green' },
  programado: { label: 'Programado', badge: '' },
  por_confirmar: { label: 'Por confirmar', badge: 'yellow' },
}

export const DOC_KINDS = [
  { id: 'soat', label: 'SOAT', lead: 30 },
  { id: 'rtm', label: 'Revisión técnico-mecánica y de emisiones', short: 'Tecnomecánica', lead: 30 },
  { id: 'tarjeta', label: 'Tarjeta de propiedad', lead: 0 },
  { id: 'impuesto', label: 'Impuesto vehicular', lead: 30 },
  { id: 'otro', label: 'Otro documento', lead: 15 },
]

export const EXPENSE_CATS = [
  { id: 'combustible', label: 'Combustible', icon: 'drop' },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: 'tool' },
  { id: 'repuestos', label: 'Repuestos', icon: 'puzzle' },
  { id: 'documentos', label: 'Documentos', icon: 'note' },
  { id: 'parqueadero', label: 'Parqueadero', icon: 'pin' },
  { id: 'lavado', label: 'Lavado', icon: 'drop' },
  { id: 'accesorios', label: 'Accesorios', icon: 'star' },
  { id: 'reparaciones', label: 'Reparaciones', icon: 'tool' },
  { id: 'otros', label: 'Otros', icon: 'more' },
]

export const FILE_KINDS = [
  { id: 'manual', label: 'Manual' },
  { id: 'factura', label: 'Factura o recibo' },
  { id: 'foto', label: 'Foto' },
  { id: 'documento', label: 'Documento' },
  { id: 'otro', label: 'Otro' },
]

// Grado de verificación de un plan: de dónde sale cada intervalo
export const VERIFICATION = {
  manual: { label: 'Verificado en el manual', badge: 'green' },
  usuario: { label: 'Configurado por ti', badge: '' },
  externa: { label: 'Fuente externa · por confirmar', badge: 'yellow' },
  sugerencia: { label: 'Sugerencia general', badge: 'yellow' },
}

export const PLAN_STATUS = {
  vencido: { label: 'Vencido', badge: 'red', rank: 0 },
  por_confirmar: { label: 'Por confirmar', badge: 'yellow', rank: 1 },
  proximo: { label: 'Próximo', badge: 'pink', rank: 2 },
  pendiente: { label: 'Falta información', badge: 'yellow', rank: 3 },
  al_dia: { label: 'Al día', badge: 'green', rank: 4 },
  inactivo: { label: 'Sin activar', badge: '', rank: 5 },
}

export function emptyGarage() {
  return { schema: SCHEMA, vehicles: [], readings: [], services: [], plans: [], documents: [], expenses: [], fuel: [], files: [], shops: [], categories: [], seeded: [] }
}

// ---------- Carga inicial (solo lo que se sabe; lo demás queda pendiente) ----------
export const MINAVI_ID = 'veh_minavi'
export const HONDA_NAVI_MANUAL = 'https://motos.honda.com.co/manuales/manual-navi.pdf'

// Fuente externa: maintenanceschedule.com dice citar el manual del propietario de la Honda Navi
// (mercado y año no especificados; probablemente EE. UU.). NO es el manual de Honda Colombia,
// por eso entra como "por confirmar" y SIN activar: no genera alertas hasta que tú lo confirmes.
const EXT = 'https://maintenanceschedule.com/honda-navi-nva110-maintenance-schedule/'
const extNote = 'Tomado de una fuente externa que cita el manual de la Honda Navi (mercado no especificado). Compáralo con el manual de Honda Colombia antes de activarlo.'
export const NAVI_SUGGESTED_PLANS = [
  { key: 'aceite', component: 'aceite', action: 'reemplazar', intervalKm: 4000, intervalMonths: 12, firstKm: 1000, notes: 'Primer cambio a los 1.000 km; luego cada 4.000 km o una vez al año. La misma fuente menciona que Honda sugiere cambiarlo cada 6 meses.' },
  { key: 'bujia_insp', component: 'bujia', action: 'inspeccionar', intervalKm: 4000, notes: 'Inspeccionar cada 4.000 km.' },
  { key: 'bujia', component: 'bujia', action: 'reemplazar', intervalKm: 8000, notes: 'Reemplazar cada 8.000 km.' },
  { key: 'filtro_aire', component: 'filtro_aire', action: 'reemplazar', intervalKm: 16000, notes: 'Cada 16.000 km; más seguido si andas en zonas con polvo o lluvia.' },
  { key: 'transmision', component: 'transmision', action: 'reemplazar', intervalMonths: 24, notes: 'Aceite de la transmisión final: cada 2 años.' },
  { key: 'correa_insp', component: 'correa', action: 'inspeccionar', intervalKm: 8000, notes: 'Revisar estado, tensión y alineación cada 8.000 km.' },
  { key: 'correa', component: 'correa', action: 'reemplazar', intervalKm: 24000, notes: 'Reemplazar cada 24.000 km.' },
  { key: 'valvulas', component: 'valvulas', action: 'ajustar', intervalKm: 4000, notes: 'Inspeccionar y ajustar holgura de válvulas cada 4.000 km.' },
  { key: 'sincronizacion', component: 'sincronizacion', action: 'ajustar', intervalKm: 4000, notes: 'Revisar y ajustar el ralentí cada 4.000 km.' },
  { key: 'frenos', component: 'frenos', action: 'inspeccionar', intervalKm: 4000, notes: 'Desgaste de bandas y sistema de frenos en cada revisión (cada 4.000 km).' },
  { key: 'llantas', component: 'llantas', action: 'inspeccionar', intervalKm: 4000, notes: 'Desgaste y estado de llantas en cada revisión (cada 4.000 km). La presión, revísala seguido.' },
].map((p) => ({ ...p, source: 'externa', sourceRef: EXT, verification: 'externa', notes: `${p.notes} ${extNote}` }))

export function minaviSeed() {
  return {
    vehicle: { id: MINAVI_ID, type: 'moto', name: 'Mi chiquita', make: 'Honda', model: 'Navi 110', year: 2021, plate: '', registeredAt: null, color: '', fuelType: 'Gasolina corriente', distanceUnit: 'km', specs: { transmision: 'Automática (CVT con correa)' }, notes: '', archived: false },
    services: [
      { key: 's1', id: 'svc_minavi_1', date: '2026-10-15', status: 'realizado', items: [{ component: 'bateria', action: 'recargar', detail: 'Recarga de batería' }], description: 'Recarga de batería', notes: 'Kilometraje, costo, taller y detalles: pendientes.' },
      { key: 's2', id: 'svc_minavi_2', date: '2026-10-16', status: 'realizado', items: [{ component: 'aceite', action: 'reemplazar', detail: 'Cambio de aceite' }, { component: 'filtro_aire', action: 'reemplazar', detail: 'Cambio del filtro de aire' }], description: 'Cambio de aceite y del filtro de aire', notes: 'Tipo de aceite, repuestos, costo, kilometraje y taller: pendientes.' },
      { key: 's3', id: 'svc_minavi_3', date: '2026-10-17', intakeDate: '2026-10-17', status: 'por_confirmar', items: [{ component: 'bujia', action: 'reemplazar', detail: 'Cambio de bujía (previsto)' }, { component: 'sincronizacion', action: 'ajustar', detail: 'Sincronización (prevista)' }], description: 'Entró al taller para cambio de bujía y sincronización', expectedNote: 'Entrega estimada: lunes 19 o martes 20 de octubre de 2026', expectedDate: '2026-10-19', notes: 'Falta confirmar qué se hizo, cuándo la entregaron, kilometraje, costo y taller.' },
    ],
  }
}
