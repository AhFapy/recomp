/* Recomp · el "¿cómo estás hoy?" del día (1 fatal … 5 genial). */
alter table public.recomp_dias add column if not exists animo smallint check (animo between 1 and 5);
