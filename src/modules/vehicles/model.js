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
  { id: 'filtro_tamiz', name: 'Filtro tamiz del aceite', types: ['moto'] },
  { id: 'respiradero', name: 'Respiradero del cárter' },
  { id: 'combustible_sis', name: 'Sistema de combustible (tubería y filtro)' },
  { id: 'acelerador', name: 'Acelerador y estrangulador' },
  { id: 'aire_aux', name: 'Sistema auxiliar de aire (AI)', types: ['moto'] },
  { id: 'embrague', name: 'Zapatas del embrague', types: ['moto'] },
  { id: 'variador', name: 'Variador (rodillos y rampa)', types: ['moto'] },
  { id: 'arranque', name: 'Pedal o pata de arranque', types: ['moto'] },
  { id: 'suspension', name: 'Suspensión' },
  { id: 'direccion', name: 'Dirección (cojinetes)' },
  { id: 'tornilleria', name: 'Tuercas, pernos y sujeciones' },
  { id: 'luces', name: 'Luces, faro y bocina' },
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

// Programa de mantenimiento VERIFICADO en el manual del propietario oficial de Honda para la NAVI
// (NVA110 / NVA110B, Honda Motor Co., 2023, código 35K74G000), "Programa de mantenimiento", págs. 46-47.
// Ese manual cubre Latinoamérica (Colombia no aparece en su lista de destinos, pero es el mismo modelo).
// Leyenda del manual: I = inspeccionar (limpiar, ajustar, lubricar o reemplazar si hace falta), R = reemplazar, C = limpiar.
// "A lecturas más altas del cuentakilómetros, repita a los intervalos establecidos" (nota *1).
export const NAVI_MANUAL_REF = 'Manual del propietario Honda NAVI (NVA110), Honda Motor Co., 2023 · Programa de mantenimiento'
const M = (key, component, action, o, notes, page = 'Págs. 46-47') => ({ key, component, action, ...o, notes, page, source: 'manual', sourceRef: NAVI_MANUAL_REF, verification: 'manual' })
export const NAVI_MANUAL_PLANS = [
  M('aceite', 'aceite', 'reemplazar', { firstKm: 1000, intervalKm: 4000, intervalMonths: 12 }, 'Reemplazar a los 1.000 km y luego cada 4.000 km, o cada año (lo que pase primero). Revisar el nivel antes de usarla. Aceite Honda 4T SAE 10W-30, API SJ o superior, JASO MB · 0,70 L al drenar (0,80 L si se limpia el filtro tamiz).'),
  M('filtro_tamiz', 'filtro_tamiz', 'limpiar', { intervalKm: 12000 }, 'Limpiar el filtro tamiz del aceite a los 12.000 y 24.000 km.'),
  M('bujia_insp', 'bujia', 'inspeccionar', { firstKm: 4000, intervalKm: 8000 }, 'Inspeccionar a los 4.000, 12.000 y 20.000 km. Bujía NGK MR7C-9N, separación 0,8–0,9 mm.'),
  M('bujia', 'bujia', 'reemplazar', { intervalKm: 8000 }, 'Reemplazar a los 8.000, 16.000 y 24.000 km.'),
  M('valvulas', 'valvulas', 'inspeccionar', { firstKm: 1000, intervalKm: 4000 }, 'Holgura de las válvulas: a los 1.000 km y luego cada 4.000 km. Nivel intermedio: mejor en el concesionario.'),
  M('filtro_aire', 'filtro_aire', 'reemplazar', { intervalKm: 16000 }, 'Reemplazar a los 16.000 km. Más seguido si andas en zonas húmedas o con polvo.'),
  M('respiradero', 'respiradero', 'limpiar', { intervalKm: 4000, intervalMonths: 12 }, 'Limpiar cada 4.000 km y en la revisión anual. Más seguido con lluvia o a máxima aceleración.'),
  M('ralenti', 'sincronizacion', 'inspeccionar', { firstKm: 1000, intervalKm: 4000, intervalMonths: 12 }, 'Velocidad de ralentí: a los 1.000 km, luego cada 4.000 km y anual. Valor: 1.700 ± 100 rpm.'),
  M('correa_insp', 'correa', 'inspeccionar', { intervalKm: 8000 }, 'Correa de transmisión: inspeccionar a los 8.000 y 16.000 km.'),
  M('correa', 'correa', 'reemplazar', { intervalKm: 24000 }, 'Correa de transmisión: reemplazar a los 24.000 km.'),
  M('transmision', 'transmision', 'reemplazar', { intervalMonths: 24 }, 'Aceite de transmisión: reemplazar cada 2 años (requiere conocimientos de mecánica). Capacidad: 0,10 L al drenar.'),
  M('frenos', 'frenos', 'inspeccionar', { firstKm: 1000, intervalKm: 4000, intervalMonths: 12 }, 'Sistema de frenos a los 1.000 km y cada 4.000 km; desgaste de zapatas cada 4.000 km; también anual y antes de usarla.', 'Págs. 46-47 (ver págs. 48 y 70)'),
  M('llantas', 'llantas', 'inspeccionar', { intervalKm: 4000, intervalMonths: 12 }, 'Ruedas y neumáticos cada 4.000 km y anual (revisarlos antes de usarla). Presión en frío: delantera 150 kPa; trasera 200 kPa solo piloto, 250 kPa con pasajero.', 'Págs. 46-47 (ver pág. 54)'),
  M('combustible', 'combustible_sis', 'inspeccionar', { intervalKm: 4000, intervalMonths: 12 }, 'Tubería del combustible cada 4.000 km y anual; limpiar la pantalla del filtro tamiz del combustible cada 4.000 km.'),
  M('acelerador', 'acelerador', 'inspeccionar', { intervalKm: 4000, intervalMonths: 12 }, 'Funcionamiento del acelerador y del estrangulador cada 4.000 km y anual.'),
  M('suspension', 'suspension', 'inspeccionar', { intervalKm: 4000, intervalMonths: 12 }, 'Suspensión cada 4.000 km y anual.'),
  M('luces', 'luces', 'inspeccionar', { intervalKm: 4000, intervalMonths: 12 }, 'Reglaje del faro cada 4.000 km y anual; luces y bocina antes de usarla.'),
  M('tornilleria', 'tornilleria', 'inspeccionar', { firstKm: 1000, intervalKm: 8000, intervalMonths: 12 }, 'Tuercas, pernos y elementos de sujeción a los 1.000 km, luego cada 8.000 km y anual.'),
  M('direccion', 'direccion', 'inspeccionar', { firstKm: 1000, intervalKm: 12000, intervalMonths: 12 }, 'Cojinetes del cabezal de la dirección a los 1.000 km, luego cada 12.000 km y anual. Nivel técnico: hágalo en el concesionario.'),
  M('embrague', 'embrague', 'inspeccionar', { intervalKm: 8000 }, 'Desgaste de las zapatas del embrague a los 8.000, 16.000 y 24.000 km. Nivel técnico: en el concesionario.'),
  M('aire_aux', 'aire_aux', 'inspeccionar', { intervalKm: 16000 }, 'Sistema auxiliar de suministro de aire: inspeccionar a los 16.000 km. Su filtro (AI): limpiar a los 12.000 y 24.000 km.'),
]
// Datos de servicio del mismo manual (pág. 94)
export const NAVI_SPECS = {
  aceite: 'Honda 4T SAE 10W-30, API SJ o superior, JASO MB · 0,70 L al drenar (0,80 L con filtro tamiz)',
  bujia: 'NGK MR7C-9N · separación 0,8–0,9 mm',
  llantas: 'Del. 90/90-12 54J · Tras. 90/100-10 53J · sin cámara (tubeless)',
  presion: 'En frío · Sola: del. 150 kPa (22 psi), tras. 200 kPa (29 psi) · Con pasajero: del. 150 kPa (22 psi), tras. 250 kPa (36 psi)',
  marcasLlantas: 'Originales: MRF Zapper-FG / Zapper · TVS Conta 350 / Conta 350M · CEAT Zoom-Hi / Zoom-D (del. / tras.)',
  etiquetaLlantas: 'Debajo del asiento (etiqueta "Información sobre neumáticos")',
  combustible: 'Gasolina sin plomo RON 91 o más (hasta 10 % etanol) · tanque 3,5 L',
  ralenti: '1.700 ± 100 rpm',
  aceiteTransmision: '0,10 L al drenar (0,12 L tras desmontar)',
  bateria: 'Exenta de mantenimiento (12 V-3 Ah; la referencia cambia según el país)',
}
export const SPEC_LABELS = { linea: 'Línea', cilindraje: 'Cilindraje', potencia: 'Potencia', servicio: 'Servicio', motor: 'N.º de motor', vin: 'VIN / chasis', organismo: 'Organismo de tránsito', transmision: 'Transmisión', aceite: 'Aceite del motor', bujia: 'Bujía', llantas: 'Llantas', presion: 'Presión de llantas', marcasLlantas: 'Marcas de llantas', etiquetaLlantas: 'Dónde está la etiqueta', combustible: 'Combustible', ralenti: 'Ralentí', aceiteTransmision: 'Aceite de transmisión', bateria: 'Batería' }

export function minaviSeed() {
  return {
    vehicle: { id: MINAVI_ID, type: 'moto', name: 'Mi chiquita', make: 'Honda', model: 'Navi 110', year: 2022, plate: '', registeredAt: null, color: '', fuelType: 'Gasolina corriente', distanceUnit: 'km', specs: { transmision: 'Automática V-Matic (CVT con correa)' }, notes: '', archived: false },
    services: [
      { key: 's1', id: 'svc_minavi_1', date: '2026-10-15', status: 'realizado', items: [{ component: 'bateria', action: 'recargar', detail: 'Recarga de batería' }], description: 'Recarga de batería', notes: 'Kilometraje, costo, taller y detalles: pendientes.' },
      { key: 's2', id: 'svc_minavi_2', date: '2026-10-16', status: 'realizado', items: [{ component: 'aceite', action: 'reemplazar', detail: 'Cambio de aceite' }, { component: 'filtro_aire', action: 'reemplazar', detail: 'Cambio del filtro de aire' }], description: 'Cambio de aceite y del filtro de aire', notes: 'Tipo de aceite, repuestos, costo, kilometraje y taller: pendientes.' },
      { key: 's3', id: 'svc_minavi_3', date: '2026-10-17', intakeDate: '2026-10-17', status: 'por_confirmar', items: [{ component: 'bujia', action: 'reemplazar', detail: 'Cambio de bujía (previsto)' }, { component: 'sincronizacion', action: 'ajustar', detail: 'Sincronización (prevista)' }], description: 'Entró al taller para cambio de bujía y sincronización', expectedNote: 'Entrega estimada: lunes 19 o martes 20 de octubre de 2026', expectedDate: '2026-10-19', notes: 'Falta confirmar qué se hizo, cuándo la entregaron, kilometraje, costo y taller.' },
    ],
  }
}

// Guías sencillas: para qué sirve cada revisión y qué mirar (sin saber de mecánica)
export const MANUAL_DRIVE_ID = '1NIyfG9Alm3Qnc2Yyc0XksC6ZJbVCYruj'
export const GUIDES = {
  llantas: { why: 'Una llanta con poca presión, gastada o cortada hace que la moto pierda agarre y estabilidad.', check: ['Presión en frío (antes de rodar): del. 22 psi, tras. 29 psi (36 con pasajero)', 'Labrado: que no llegue a los testigos de desgaste (las marquitas dentro de las ranuras)', 'Sin grietas, cortes, chichones ni clavos', 'Desgaste parejo (no más gastada de un lado)', 'Válvula sin fugas (que no pierda aire en unos días)'] },
  aceite: { why: 'El aceite lubrica y enfría el motor. Poco o viejo, el motor se desgasta rápido.', check: ['Moto derecha, motor frío: el nivel entre las marcas de la varilla', 'Color: ámbar está bien; muy negro o espeso, toca cambiarlo', 'Sin manchas de aceite debajo de la moto'] },
  frenos: { why: 'Que la moto frene derecho y a tiempo.', check: ['Las manijas no llegan hasta el manubrio al frenar', 'Indicador de desgaste de las zapatas dentro del límite', 'Sin ruidos raros ni vibración al frenar', 'Luz de freno prende con cada manija'] },
  bujia: { why: 'Da la chispa para encender. Gastada: arranca mal y gasta más gasolina.', check: ['Pídele al mecánico que la revise: color y separación (0,8–0,9 mm)', 'Referencia correcta: NGK MR7C-9N'] },
  filtro_aire: { why: 'Evita que entre polvo al motor. Sucio: pierde fuerza y gasta más.', check: ['Pídele al mecánico que lo saque y lo mire a contraluz', 'Si está muy sucio o roto, se cambia (no se lava)'] },
  correa: { why: 'Transmite la fuerza del motor a la rueda. Si se rompe, la moto no anda.', check: ['Pídele al mecánico revisar grietas y ancho de la correa', 'Ruidos o tirones al acelerar'] },
  bateria: { why: 'Da la energía para arrancar y para las luces.', check: ['Arranca con el botón sin quedarse sin fuerza', 'Bornes limpios y apretados (sin polvo blanco o verde)', 'Si se descarga seguido, que revisen la carga (regulador)'] },
  luces: { why: 'Que te vean y veas, y no te pongan un comparendo.', check: ['Farola (alta y baja)', 'Direccionales de los dos lados', 'Luz de freno con cada manija', 'Pito'] },
  suspension: { why: 'Absorbe los huecos y mantiene la llanta pegada al piso.', check: ['Al empujar la moto hacia abajo, sube suave (no rebota)', 'Sin aceite en las barras de adelante'] },
  tornilleria: { why: 'Que nada se afloje con la vibración.', check: ['Tornillos de ruedas, manubrio y escape firmes', 'Nada suena suelto al pasar huecos'] },
  direccion: { why: 'Que el manubrio gire suave y la moto vaya derecha.', check: ['El manubrio gira suave de lado a lado, sin trabarse', 'Sin juego al frenar adelante'] },
}
