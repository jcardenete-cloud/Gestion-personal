alter table jcf.planificacion
  add column if not exists importe numeric(14, 2) check (importe >= 0);

comment on column jcf.planificacion.importe is
  'Importe mensual planificado por perfil, calculado como suma de horas individuales por tarifa asignada; NULL para planificaciones antiguas sin importe.';
