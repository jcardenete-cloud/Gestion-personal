alter table jcf.personal_proyectos
  add column if not exists tarifa numeric(14, 2);

comment on column jcf.personal_proyectos.tarifa is
  'Precio por unidad del presupuesto aplicado a la persona en el encargo; admite NULL si no hay tarifa seleccionada.';
