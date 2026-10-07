# MuMu 🐮🌸

Mi sistema operativo personal: agenda + segundo cerebro + asistente + hábitos + universidad + aprendizaje + vida + Dios + finanzas conectadas + la casita de la vaquita (con Leo y Negra).

> El nombre es provisional: se cambia en `src/config/brand.js` o desde **Configuración → Apariencia**, sin tocar nada más.

## Cómo está armado

```
src/
  config/      brand.js (nombre, dueña, app de finanzas) · nav.js (secciones)
  store/       seed.js (datos iniciales) · index.js (estado + guardado) · actions.js (TODA acción que cambia datos)
  engine/      planner.js (disponibilidad + "¿Qué hago ahora?") · game.js (monedas, rachas flexibles, misiones, vaquita)
               insights.js (analítica + "Mi propio método") · notify.js (avisos) · decor.js (casita) · time.js
  services/    firebase.js (login opcional) · sync.js (Firestore) · api.js (cliente del backend)
  components/  art.js (vaquita, Leo, Negra en SVG) · Sheets.vue (formularios) · Assistant.vue · TaskRow.vue · ui.js
  views/       una vista por sección (home, agenda, tareas, enfoque, universidad, cerebro, experimentos, casa, …)
api/           funciones serverless de Vercel (Google OAuth, Gmail, Calendar, Classroom, Tu Aula, IA, finanzas, cron)
firestore.rules
```

**Las tres capas:** fuentes de datos (`api/` + registro manual) → motor (`src/engine/`) → interfaz (`src/views/`).
Todo pasa por `store/actions.js`, por eso los módulos están conectados: completar una tarea mueve el proyecto y el objetivo, da monedas, cambia a la vaquita y alimenta la analítica; una sesión de "5 minutos" registra sola el experimento de *Atomic Habits*, etc.

## Correr en tu compu

```bash
npm install
npm run dev          # solo frontend, "modo local" (datos en el navegador)
npx vercel dev       # frontend + /api (necesita las variables del .env)
```

`npm run build:preview` genera un único HTML para vista previa (modo local, sin backend).

## Modo local vs. modo completo

| | Modo local | Desplegada en Vercel + Firebase |
|---|---|---|
| Todos los módulos, motor, vaquita, casita | ✅ | ✅ |
| Datos | en el navegador | en tu Firestore (celular y compu) |
| Google (Gmail, Calendar, Classroom), Tu Aula, IA, finanzas | — | ✅ |

## Configuración (una sola vez)

1. **Firebase** (puedes reutilizar el flujo que hiciste en Maletica): crea un proyecto, activa *Authentication → Google* y *Firestore*. Copia la config web a `VITE_FIREBASE_*`. Publica `firestore.rules`:
   `npx firebase deploy --only firestore:rules`
2. **Cuenta de servicio**: Firebase → Configuración → Cuentas de servicio → Generar clave. Conviértela a base64 (`base64 -w0 archivo.json`) y ponla en `FIREBASE_SERVICE_ACCOUNT`. Borra el archivo `.json` después; **nunca lo subas a GitHub** (ya está en `.gitignore`).
3. **Google Cloud** (mismo proyecto de Firebase): habilita *Gmail API*, *Google Calendar API* y *Google Classroom API*. Crea un *ID de cliente OAuth (aplicación web)* con URI de redirección `https://TU-APP.vercel.app/api/google/callback`. En la pantalla de consentimiento déjala en modo *Prueba* y agrega tus dos correos (personal y universitario) como usuarios de prueba.
   - Si tu cuenta de la universidad es Google Workspace y el administrador bloquea apps externas, Gmail/Classroom de esa cuenta no se podrán conectar: la app te mostrará el error de Google tal cual.
4. **Vercel**: importa el repo, agrega las variables de `.env.example` en *Settings → Environment Variables* (las del servidor NUNCA van en el código). `ALLOWED_EMAILS` = tu correo: nadie más puede usar el backend.
5. Opcional: `ANTHROPIC_API_KEY` para conversar libremente con la vaquita (el motor de recomendaciones funciona sin IA).

## Tu Aula (Moodle) — qué es real y qué no

No existe una "API de Tu Aula" aparte: Tu Aula es Moodle, y Moodle trae dos vías oficiales. La app intenta ambas, sin inventar endpoints ni hacer scraping:

1. **Usuario y contraseña → servicio web móvil de Moodle** (`/login/token.php?service=moodle_mobile_app`, el mismo que usa la app oficial "Moodle"). La contraseña viaja por HTTPS al servidor, se usa **una vez** para obtener un token y se descarta; solo se guarda el token **cifrado (AES-256-GCM)** en una ruta de Firestore que el navegador no puede leer. Con eso se leen cursos, tareas (`mod_assign_get_assignments`), próximas actividades (`core_calendar_get_action_events_by_timesort`) y avisos (foro de noticias).
   - ⚠️ Funciona **solo si** la universidad tiene habilitado el acceso desde apps móviles y si entras a Tu Aula con usuario/contraseña propios de Moodle. Si entras con "Iniciar sesión con Google" (SSO), esta vía no sirve.
2. **Enlace de calendario iCal** (Tu Aula → Calendario → Exportar calendario → Obtener URL). No requiere contraseña; trae entregas y fechas (no anuncios).

Qué hace la sincronización: lo nuevo → crea tarea con materia, fecha, duración estimada y objetivo "Graduarme"; si cambia la fecha → actualiza la tarea y la marca; si cambia el contenido → la marca como cambiada; al acercarse la fecha → sube la prioridad; y el motor busca bloques libres antes de la entrega.

**Frecuencia:** se revisa al abrir la app (si pasaron más de 3 h), con el botón "Revisar ahora" y con un cron diario de Vercel (6 a. m. Bogotá). El plan gratuito de Vercel solo permite cron diario; en Pro puedes poner `0 */4 * * *` en `vercel.json`.

**Lo que necesita tu intervención:** pegar la dirección de Tu Aula y elegir el método en *Configuración → Integraciones*. **No me pases contraseñas por chat**: escríbelas solo en ese formulario de tu app desplegada.

## Lo que una web no puede hacer (y no se finge)

- Aparecer encima de TikTok o leer tu tiempo de pantalla: se registra a mano (Bienestar digital) + "¿Qué venías a hacer?". Queda listo para una futura app nativa.
- Notificaciones: dentro de la app y del navegador (con permiso). Push con la app cerrada requiere PWA + service worker (pendiente: pregúntame antes de volverla instalable).
- Platzi: no tiene API pública de progreso → registro manual conectado a objetivos y proyectos.
- MuMu Finanzas: el puente existe (`/api/finance/summary`), falta la otra app. Contrato en `docs/INTEGRACION-FINANZAS.md`.

## Seguridad

- Cero secretos en el frontend: tokens de Google/Moodle cifrados en `secrets/` (bloqueado por reglas), claves solo en variables de entorno.
- OAuth de Google con scopes mínimos de solo lectura; escribir en Calendar es un permiso aparte y opcional. Desconectar revoca el acceso en Google.
- Backend restringido a `ALLOWED_EMAILS`, validación de entradas, rate limiting por IP, HTTPS/HSTS y cabeceras de seguridad (`vercel.json`). Los logs nunca incluyen cuerpos de petición.

## Checklist de lanzamiento (pendientes)

Ya cubierto: secretos en servidor, auth + reglas por usuario, validación en servidor, rate limiting, HTTPS/HSTS, contraste y etiquetas ARIA básicas, favicon, adaptable a celular, `noindex` (es personal).
Pendiente para revisar juntas: política de privacidad corta, banner de cookies (solo si agregas analítica), PageSpeed, página 404 (no aplica con rutas por `#`), Open Graph, PWA (preguntar antes).
