# Jabner

Panel personal de Javi y Ahmed (lo profesional va en el panel de Trud). HTML estático + Supabase (proyecto Trud Sales). Sin login: se abre una vez desde el enlace privado (#k=...) y el navegador guarda la llave (`recomp_config`, clave `llave`).

- `index.html`: inicio con los módulos.
- `recomp.html`: gimnasio y nutrición (tablas `recomp_*`).
- `habitos.html`: la cartulina, mente/cuerpo/alma/objetivos (`jabner_habitos`, `jabner_habitos_log`).
- `finanzas.html`: gastos e ingresos (`jabner_movimientos`).
- `jabner.css`, `jabner.js`: base común.
- `supabase/functions/jabner-whatsapp`: webhook para apuntar movimientos desde WhatsApp vía GHL.

## WhatsApp (GHL)

Workflow en GHL: disparador "Customer replied" (canal WhatsApp) → acción Custom Webhook POST a
`https://wuilmkfwxcexsepdcpdn.supabase.co/functions/v1/jabner-whatsapp`
con cabecera `x-jabner-secret` (valor en `recomp_config`, clave `wa_secreto`) y cuerpo
`{"phone": "{{contact.phone}}", "message": "{{message.body}}"}`.
Devuelve `{ ok, respuesta }`; se puede mapear `respuesta` a un mensaje de WhatsApp de vuelta.
Solo se aceptan los números de `jabner_telefonos`.

Despliegue: Vercel, sin build (Framework: Other).
