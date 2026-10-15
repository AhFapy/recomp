/*
  Recomp · tablas de la app de hábitos (app aparte del panel, misma base).

  Cada fila es de una persona y solo la ve y la toca ella: ni el otro socio
  ni un manager. Además, solo entran org_admins (Javi y Ahmed): cualquier
  otro usuario del panel con sesión no ve ni escribe nada aquí. Esa segunda
  condición va como RESTRICTIVE para que se combine con AND y no se pueda
  abrir sumando otra policy permisiva por error (regla 10 del panel).

  Sin vistas: la app lee las tablas directamente, así no hay nada que
  pueda saltarse la RLS (regla 8).
*/

create table if not exists public.recomp_objetivos (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  fecha_inicio date not null,
  peso_inicial numeric(5,1) not null check (peso_inicial between 30 and 300),
  peso_objetivo numeric(5,1) not null check (peso_objetivo between 30 and 300),
  fecha_objetivo date not null check (fecha_objetivo > fecha_inicio),
  prot_obj integer check (prot_obj between 50 and 400),
  kcal_obj integer check (kcal_obj between 1000 and 5000),
  updated_at timestamptz not null default now()
);

/* Un día por persona. `comidas` guarda lo elegido de las cartas con sus
   macros copiadas: si la carta cambia, el histórico no se mueve. */
create table if not exists public.recomp_dias (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fecha date not null,
  hechos text[] not null default '{}',
  comidas jsonb not null default '[]'::jsonb check (jsonb_typeof(comidas) = 'array'),
  peso numeric(5,1) check (peso between 30 and 300),
  whoop smallint check (whoop between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (profile_id, fecha)
);

create table if not exists public.recomp_mediciones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fecha date not null,
  peso numeric(5,1) not null check (peso between 30 and 300),
  grasa_pct numeric(4,1),
  musculo_kg numeric(5,1),
  visceral numeric(5,1),
  created_at timestamptz not null default now()
);
create index if not exists recomp_mediciones_persona on public.recomp_mediciones (profile_id, fecha);

do $$
declare t text;
begin
  foreach t in array array['recomp_objetivos','recomp_dias','recomp_mediciones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy %I on public.%I for all to authenticated
                     using (profile_id = (select auth.uid()))
                     with check (profile_id = (select auth.uid()))$p$, t || '_propias', t);
    execute format($p$create policy %I on public.%I as restrictive for all to authenticated
                     using ((select public.is_org_admin()))
                     with check ((select public.is_org_admin()))$p$, t || '_solo_socios', t);
  end loop;
end $$;
