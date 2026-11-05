# Jabner

Panel personal de Javi y Ahmed (lo profesional va en el panel de Trud). HTML estático + Supabase (proyecto Trud Sales). Sin login ni llave: abre directamente en jabner.vercel.app (decisión de Ahmed). Las tablas solo aceptan filas de los dos socios.

- `index.html`: la app entera en una pantalla, con el armazón del panel de Trud (barra lateral, barra inferior en móvil). Secciones: Hoy, Cuerpo, Hábitos y Finanzas.
- `recomp.js`, `recomp-logica.js`, `recomp-cartas.js`: gimnasio y nutrición (tablas `recomp_*`). Plan de entreno vía edge function `recomp-plan`; comida en texto libre vía `recomp-comida` (necesita el secreto `ANTHROPIC_API_KEY` en Supabase).
- `habitos.js`: la cartulina (`jabner_habitos`, `jabner_habitos_log`). `finanzas.js`: gastos e ingresos (`jabner_movimientos`).
- `conclusiones.js`: conclusiones por reglas a partir de todo lo apuntado. `inicio.js`: arranque y cifras de arriba.
- `jabner.css`, `recomp.css`, `jabner.js`: base común (tokens de `globals.css` del panel).
- `supabase/functions/jabner-whatsapp`: webhook para apuntar movimientos desde WhatsApp vía GHL.

## WhatsApp (GHL)

Workflow en GHL: disparador "Customer replied" (canal WhatsApp) → acción Custom Webhook POST a
`https://wuilmkfwxcexsepdcpdn.supabase.co/functions/v1/jabner-whatsapp`
con cabecera `x-jabner-secret` (valor en `recomp_config`, clave `wa_secreto`) y cuerpo
`{"phone": "{{contact.phone}}", "message": "{{message.body}}"}`.
Devuelve `{ ok, respuesta }`; se puede mapear `respuesta` a un mensaje de WhatsApp de vuelta.
Solo se aceptan los números de `jabner_telefonos`.

Despliegue: Vercel, sin build (Framework: Other). Todo el JS va en archivos y `vercel.json` pone una CSP estricta; supabase-js y las fuentes se sirven desde la propia web.

Pruebas: `python3 tests/run.py` (Playwright). Sirve la web con las cabeceras de Vercel, imita Supabase en memoria y comprueba Recomp a 320, 375 y 1440 px con el reloj fijo.
