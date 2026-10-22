alter table jcf.mediciones
  add column if not exists importe numeric(14, 2) check (importe >= 0);

comment on column jcf.mediciones.importe is
  'Importe mensual por perfil calculado como suma de horas individuales por tarifa asignada; NULL para mediciones antiguas sin importe.';
