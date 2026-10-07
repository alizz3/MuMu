# Contrato MuMu ↔ MuMu Finanzas

MuMu no guarda movimientos financieros. Solo pide un **resumen** a MuMu Finanzas, servidor a servidor.

## Lo que MuMu Finanzas debe exponer

`GET {FINANCE_API_URL}/api/summary`

Cabeceras que envía MuMu:
- `Authorization: Bearer {FINANCE_API_KEY}` (clave compartida, solo en variables de entorno de ambas apps)
- `X-User-Email: correo@...` (para elegir el usuario)

Respuesta:
```json
{
  "summary": {
    "month": "Octubre 2026",
    "income": 1200000,
    "expenses": 820000,
    "balance": 380000,
    "debts": 0,
    "nextPayments": [{ "name": "Plan de celular", "amount": 55000, "due": "2026-10-13" }],
    "goal": { "name": "Fondo de emergencia", "progress": 22 }
  }
}
```

## Al revés (Finance → OS)

Para que MuMu Finanzas cree tareas en MuMu (ej. "Pagar X"), puede escribir en el buzón del usuario
`users/{uid}/data/inbox` con `{ source: 'finance', items: [...] }` usando la misma cuenta de servicio de Firebase,
o exponer un endpoint equivalente. (Pendiente: hoy el buzón solo procesa `aula`/`classroom`; agregar el caso `finance` en `src/services/sync.js` cuando exista la app.)
