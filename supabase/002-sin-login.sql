/*
  Recomp sin inicio de sesión.

  Javi y Ahmed no quieren entrar con email y contraseña, y les da igual
  ver lo del otro. Pero la página es pública y la clave anon va dentro de
  ella, así que abrir las tablas a anon sin más dejaría pesos y datos de
  salud a cualquiera que encuentre la URL.

  La puerta es una clave en la cabecera x-recomp-key. Llega en el enlace
  privado (#k=...), el navegador la guarda y la manda en cada petición.
  La clave vive en recomp_config, que nadie lee por la API: solo la
  función recomp_llave_ok(), que corre como su dueño. Y anon solo puede
  tocar filas de los dos socios (Ahmed y Javi, por id: anon no puede leer
  profiles, así que una subconsulta ahí no devolvería nada).

  Para cambiar la clave: update recomp_config set valor='...' where clave='llave';
  y mandar el enlace nuevo.
*/
create table if not exists public.recomp_config (clave text primary key, valor text not null);
alter table public.recomp_config enable row level security;
revoke all on public.recomp_config from anon, authenticated;
insert into public.recomp_config values ('llave', '<<LLAVE>>') on conflict (clave) do nothing;

create or replace function public.recomp_llave_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (current_setting('request.headers', true)::json ->> 'x-recomp-key')
      = (select valor from recomp_config where clave = 'llave'),
    false)
$$;
revoke all on function public.recomp_llave_ok() from public;
grant execute on function public.recomp_llave_ok() to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['recomp_objetivos','recomp_dias','recomp_mediciones'] loop
    execute format('grant select, insert, update, delete on public.%I to anon', t);
    execute format($p$create policy %I on public.%I for all to anon
                     using ((select public.recomp_llave_ok()) and profile_id in ('bd37f81a-6f8d-4009-8128-0873c15067c6'::uuid, 'edb503a9-65ce-49f8-9fcc-26ae76e1b359'::uuid))
                     with check ((select public.recomp_llave_ok()) and profile_id in ('bd37f81a-6f8d-4009-8128-0873c15067c6'::uuid, 'edb503a9-65ce-49f8-9fcc-26ae76e1b359'::uuid))$p$,
                   t || '_enlace_privado', t);
  end loop;
end $$;
