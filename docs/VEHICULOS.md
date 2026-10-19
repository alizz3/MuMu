# Garaje (módulo de vehículos) — arquitectura

El Garaje vive dentro de MuMu, pero está separado para poder convertirse en una app propia sin rehacerlo.

## Dónde está cada cosa

| Capa | Archivo | Qué hace |
|---|---|---|
| Modelo | `src/modules/vehicles/model.js` | Entidades, catálogos (tipos de vehículo, componentes, acciones, documentos, gastos), carga inicial y sugerencias de plan. Sin dependencias de MuMu. |
| Lógica | `src/modules/vehicles/logic.js` | Funciones puras: km actual, distancias, estado de cada plan, documentos, alertas, gastos, consumo y exportación. Reciben el garaje y no tocan la interfaz ni la base de datos. |
| Datos | `src/modules/vehicles/actions.js` | La única puerta de escritura: validaciones, crear y editar registros, renovaciones, carga inicial idempotente y tareas enlazadas. |
| Archivos | `src/modules/vehicles/files.js` + `api/_routes/vfiles.js` | Subida y descarga privada por partes, y copia del manual oficial de Honda. |
| Vaquita | `src/modules/vehicles/assistant.js` | Respuestas sin IA con los datos guardados, acciones con confirmación y resumen para la IA. |
| Interfaz | `src/views/garaje.vue`, `src/modules/vehicles/GarageSheet.vue` | Vista de MuMu: lista, ficha y formularios. |

## Datos

Todo el garaje es una colección de MuMu: `state.vehicles`, guardada en Firestore en `users/{uid}/data/vehicles`. Tiene las mismas reglas de acceso que el resto de tus datos: solo tus dos cuentas autorizadas pueden leerla o escribirla.

Cada entidad es una lista con `id` estable, y todas, menos los talleres y las categorías, tienen `vehicleId`:

- `vehicles`: tipo (`moto`, `carro`, `camioneta`, `otro`), nombre, marca, modelo, año, placa, matrícula, `specs` (campos propios del tipo; por ejemplo, la transmisión de una moto), `owner` (reservado para cuando haya acceso compartido) y `archived`.
- `readings`: lecturas del odómetro. Una corrección justificada se guarda con `correction` y `correctionNote`, y nunca se borra el historial.
- `services`: visitas al taller. Pueden tener varios trabajos (`items`: componente + acción), estado (`realizado`, `programado`, `por_confirmar`), km, taller (`shopId`), mecánico, costos y archivos.
- `plans`: plan por componente y acción, con intervalo en km y/o meses, próxima revisión manual, aviso anticipado, fuente (`verification`: `manual`, `usuario`, `externa`, `sugerencia`) y si genera tarea.
- `documents`: SOAT, RTM y otros. Al renovar, el anterior queda con `status: 'reemplazado'` y se enlaza con `replacedBy` y `renewedFrom`.
- `expenses`: gastos. Los de combustible, mantenimiento y renovación se crean solos y se enlazan con `fuelId`, `serviceId` o `docId`, sin duplicarse.
- `fuel`: tanqueadas (cantidad, unidad L o gal, km, si se llenó el tanque).
- `files`: metadatos de los archivos. El contenido no está en esta colección.
- `shops`: talleres (nombre, mecánico, ubicación, enlace de mapa, teléfono).
- `categories`: componentes propios.
- `seeded`: marcas de la carga inicial, para que no se repita ni pise tus cambios.

## Archivos privados

Los archivos se guardan en Firestore en `secrets/_vfiles/{uid}/{id}/p/{n}`, en partes de 700 KB. Las reglas prohíben que el navegador lea `/secrets`, así que solo el servidor puede servirlos, y únicamente con tu sesión (`/api/vfiles`).

El navegador arma el archivo en tu equipo, sin enlaces públicos. El límite es de 25 MB por archivo, y las fotos se achican antes de subirse.

El botón "Guardar copia" del manual hace que el servidor descargue el PDF oficial. Solo acepta los dominios de Honda.

## Recordatorios

Cada aviso real tiene una sola tarea de MuMu, identificada por `task.vref.key`. Los avisos son tres: mantenimiento próximo o vencido, documento por vencer o vencido, y trabajo por confirmar.

Estas tareas aparecen en la agenda, se sincronizan con Google Tasks y llegan a los recordatorios del celular como cualquier otra tarea. Si el aviso deja de aplicar (registraste el trabajo, renovaste o borraste el plan), la tarea se quita. Desde la tarea, "Abrir en Garaje" lleva al registro.

No hay temporizadores del navegador: el cálculo se repite al abrir MuMu, cuando cambian los datos y cada hora.

## Fuentes de los intervalos

- **Manual oficial**: https://motos.honda.com.co/manuales/manual-navi.pdf. Se puede guardar una copia, pero sus intervalos todavía no se han extraído ni verificado.
- **Sugerencias cargadas**: vienen de una fuente externa (maintenanceschedule.com) que dice citar el manual de la Honda Navi, sin indicar mercado ni año. Por eso entran como "por confirmar" y **sin activar**: no generan avisos hasta que las revises.
- **RTM**: según el ABC de la RUNT (Ley 769 de 2002 y sus modificaciones), la primera revisión de una moto es a los 2 años de la matrícula y después es anual. En el Garaje esto es solo una guía: la fecha que cuenta es la de tu certificado.

## Exportar o migrar

- En **Ficha → Exportar hoja de vida (JSON)** se descarga un vehículo con todas sus entidades (formato `mumu.vehicles`, `schema` 1).
- **Configuración → Descargar respaldo** incluye el garaje completo.

Hoy **no existe** una API pública ni una sincronización con otra app. Para una app propia se puede hacer de dos formas:

1. **Migración controlada**: importar el JSON exportado o la colección `users/{uid}/data/vehicles`.
2. **API autenticada nueva**: reutilizar `logic.js` y `actions.js` tal cual (no dependen de la interfaz) y crear rutas como `/api/vehicles/...` con `requireUser`.

Para compartir con familiares (por ejemplo, el carro de tu papá), el campo `owner` y el `vehicleId` en cada registro permiten mover cada vehículo a su propio documento con permisos por persona, sin cambiar la lógica.
