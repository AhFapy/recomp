# Recomp

App de hábitos, comida y peso de Javi y Ahmed. HTML estático + Supabase (proyecto Trud Sales, tablas `recomp_*`). Sin login: se abre una vez desde el enlace privado (#k=...) y el navegador guarda la llave. La llave vive en `recomp_config` (ver `supabase/002-sin-login.sql`).

- `index.html`: toda la app.
- `supabase/001-recomp.sql`: tablas y RLS (ya aplicada).
- Despliegue: Vercel, sin build (Framework: Other, sin comando de build).
