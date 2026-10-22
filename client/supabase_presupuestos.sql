-- Mantiene un presupuesto vigente por encargo; una nueva carga sustituye la anterior.
create table if not exists jcf.presupuestos_encargo (
  codigopr text primary key,
  encargo_nombre text,
  archivo_origen text not null,
  duracion_meses numeric(8, 2),
  partidas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(partidas) = 'array'),
  total_directo numeric(14, 2) not null default 0,
  porcentaje_costes_indirectos numeric(8, 6),
  costes_indirectos numeric(14, 2) not null default 0,
  porcentaje_gastos_generales numeric(8, 6),
  gastos_generales numeric(14, 2) not null default 0,
  total_presupuesto numeric(14, 2) not null default 0,
  fecha_carga timestamptz not null default now()
);

comment on column jcf.presupuestos_encargo.partidas is
  'Partidas y líneas de totales del Excel, en el orden original, como array JSON.';

alter table jcf.presupuestos_encargo enable row level security;

drop policy if exists "Authenticated users can manage presupuestos_encargo"
  on jcf.presupuestos_encargo;
create policy "Authenticated users can manage presupuestos_encargo"
  on jcf.presupuestos_encargo
  for all
  to authenticated
  using (true)
  with check (true);

grant usage on schema jcf to authenticated;
grant select, insert, update on jcf.presupuestos_encargo to authenticated;
