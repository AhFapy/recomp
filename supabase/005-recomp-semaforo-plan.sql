/* Recomp 005 · día en semáforo, entreno del plan del entrenador y ajustes sin datos personales en el código.
   Aplicada como migración recomp_005_semaforo_plan. Sin borrar datos. */
alter table public.recomp_dias
  add column if not exists pasos integer check (pasos between 0 and 100000),
  add column if not exists sueno smallint check (sueno between 1 and 3),
  add column if not exists dieta smallint check (dieta between 1 and 3),
  add column if not exists nota text check (length(nota) <= 280),
  add column if not exists descanso boolean not null default false,
  add column if not exists extras jsonb not null default '[]'::jsonb check (jsonb_typeof(extras) = 'array'),
  add column if not exists entreno jsonb check (entreno is null or jsonb_typeof(entreno) = 'object');

alter table public.recomp_objetivos add column if not exists plan_semana text;

/* El Sheet del plan de cada persona va en recomp_config con clave 'plan_sheet:<profile_id>' (no en el repo):
   insert into recomp_config values ('plan_sheet:<profile_id>', '<id del Sheet>') on conflict (clave) do update set valor = excluded.valor;

   recomp_ajustes(): perfiles de la app (clave, id, nombre, si tienen plan), solo con la llave.
   Ver la definición en la base; los IDs no se copian aquí. */
