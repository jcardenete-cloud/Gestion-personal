/**
 * api.js — Capa de acceso a datos via Supabase JS SDK.
 *
 * Mantiene la misma interfaz que el api.js original (axios + Flask)
 * para que las páginas existentes no necesiten cambios.
 *
 * Todas las funciones devuelven { data: [...] } para compatibilidad
 * con el patrón response.data que usan las páginas.
 */
import { supabase, table, normalizeKeys, throwIfError, SCHEMA } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return { data };
};

const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

const getSession = () => supabase.auth.getSession();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte un objeto con claves en MAYÚSCULAS a minúsculas para Supabase */
const lower = (obj) => {
  if (!obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k.toLowerCase()] = v;
  return out;
};

/** Aplica filtros a un builder de Supabase */
const applyFilters = (builder, filters) => {
  if (!filters) return builder;
  for (const [key, val] of Object.entries(filters)) {
    const k = key.toLowerCase();
    if (val === null || val === undefined) builder = builder.is(k, null);
    else if (Array.isArray(val)) builder = builder.in(k, val);
    else builder = builder.eq(k, val);
  }
  return builder;
};

/**
 * SELECT genérico con filtros opcionales y normalización de claves a MAYÚSCULAS.
 */
const selectAll = async (tableName, filters = null, order = null) => {
  let builder = table(tableName).select('*');
  builder = applyFilters(builder, filters);
  if (order) builder = builder.order(order.toLowerCase());
  const { data, error } = await builder;
  throwIfError({ error });
  return { data: normalizeKeys(data || []) };
};

/** INSERT — acepta un objeto o array de objetos */
const insertRows = async (tableName, rows) => {
  const payload = Array.isArray(rows)
    ? rows.map(lower)
    : [lower(rows)];
  const { data, error } = await table(tableName).insert(payload).select();
  throwIfError({ error });
  return { data: normalizeKeys(data || []) };
};

/** UPDATE con filtros */
const updateRow = async (tableName, updates, filters) => {
  let builder = table(tableName).update(lower(updates));
  builder = applyFilters(builder, filters);
  const { data, error } = await builder.select();
  throwIfError({ error });
  return { data: normalizeKeys(data || []) };
};

/** DELETE con filtros */
const deleteRow = async (tableName, filters) => {
  let builder = table(tableName).delete();
  builder = applyFilters(builder, filters);
  const { error } = await builder;
  throwIfError({ error });
  return { data: { status: 'success' } };
};

/** DELETE ALL (sin filtros) */
const deleteAll = async (tableName) => {
  // Supabase requiere al menos un filtro; usamos neq en la PK con un valor imposible
  // Alternativa: usar una condición que siempre sea verdadera via RPC o gte
  const { error } = await table(tableName).delete().gte('id', -1);
  // Si la tabla no tiene 'id', usamos un fallback seguro para las tablas conocidas
  if (error) {
    // Intentar con la clave primaria correcta de cada tabla
    const pkMap = {
      vacaciones: 'id_vacacion',
      personal_proyectos: 'ref_per',
      lista_personal: 'ref_per',
      encargos: 'codigopr',
      festivos: 'id_festivo',
      ubicacion: 'ref_ubi',
    };
    const pk = pkMap[tableName.toLowerCase()];
    if (pk) {
      const { error: e2 } = await table(tableName).delete().gte(pk, -999999);
      if (e2) throw new Error(e2.message);
    } else {
      throw new Error(error.message);
    }
  }
  return { data: { status: 'success' } };
};

// ─────────────────────────────────────────────────────────────────────────────
// ENCARGOS
// ─────────────────────────────────────────────────────────────────────────────

const getEncargos = () => selectAll('ENCARGOS');

const createEncargo = (data) => insertRows('ENCARGOS', data);

const updateEncargo = (data) =>
  updateRow('ENCARGOS', data, { CODIGOPR: data.CODIGOPR });

const deleteEncargo = (id) =>
  deleteRow('ENCARGOS', { CODIGOPR: id });

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL
// ─────────────────────────────────────────────────────────────────────────────

const getPersonal = () => selectAll('LISTA_PERSONAL');

const createPersonal = (data) => insertRows('LISTA_PERSONAL', data);

const updatePersonal = (data) =>
  updateRow('LISTA_PERSONAL', data, { REF_PER: data.REF_PER });

const deletePersonal = (id) =>
  deleteRow('LISTA_PERSONAL', { REF_PER: id });

const bulkUpdatePersonalLocation = async (ref_pers, new_location) => {
  const results = await Promise.all(
    ref_pers.map((ref_per) =>
      updateRow('LISTA_PERSONAL', { REF_UBI: new_location }, { REF_PER: ref_per })
    )
  );
  return { data: { status: 'success', message: `Ubicación actualizada para ${ref_pers.length} personas` } };
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL_PROYECTOS (Asignaciones)
// ─────────────────────────────────────────────────────────────────────────────

const getAssignments = async (codigopr) => {
  let builder = table('PERSONAL_PROYECTOS').select('*');
  if (codigopr) builder = builder.eq('codigopr', codigopr);
  const { data: assignments, error } = await builder;
  throwIfError({ error });

  // JOIN manual con LISTA_PERSONAL (replicando la lógica del backend Python)
  const { data: personal } = await getPersonal();
  const personalMap = {};
  (personal || []).forEach((p) => { personalMap[String(p.REF_PER)] = p; });

  const result = normalizeKeys(assignments || []).map((a) => {
    const person = personalMap[String(a.REF_PER)];
    if (person) {
      return {
        ...a,
        NOMBRE: person.NOMBRE,
        APELLIDO1: person.APELLIDO1,
        APELLIDO2: person.APELLIDO2,
        PERFIL: person.PERFIL,
      };
    }
    return a;
  });
  return { data: result };
};

const createAssignment = (data) => insertRows('PERSONAL_PROYECTOS', data);

const updateAssignment = (data) =>
  updateRow('PERSONAL_PROYECTOS', data, {
    REF_PER: data.REF_PER,
    CODIGOPR: data.CODIGOPR,
  });

const deleteAssignment = (ref_per, codigopr) =>
  deleteRow('PERSONAL_PROYECTOS', { REF_PER: ref_per, CODIGOPR: codigopr });

// ─────────────────────────────────────────────────────────────────────────────
// UBICACION
// ─────────────────────────────────────────────────────────────────────────────

const getUbicacion = () => selectAll('UBICACION', null, 'REF_UBI');

const createUbicacion = (data) => insertRows('UBICACION', data);

const updateUbicacion = (data) =>
  updateRow('UBICACION', data, { REF_UBI: data.REF_UBI });

const deleteUbicacion = (id) =>
  deleteRow('UBICACION', { REF_UBI: id });

// ─────────────────────────────────────────────────────────────────────────────
// VACACIONES
// ─────────────────────────────────────────────────────────────────────────────

const getVacaciones = async (ref_per, year, origen_fichero, codigopr) => {
  const { data: vacations, error } = await table('VACACIONES').select('*');
  throwIfError({ error });

  let rows = normalizeKeys(vacations || []);

  // Filtros (replicando la lógica de filtrado del backend)
  if (ref_per) rows = rows.filter((r) => String(r.REF_PER) === String(ref_per));
  if (year) rows = rows.filter((r) => r.FECHA_DESDE && String(r.FECHA_DESDE).startsWith(String(year)));
  if (origen_fichero) rows = rows.filter((r) => String(r.ORIGEN_FICHERO) === String(origen_fichero));
  if (codigopr) {
    const { data: proyectos } = await selectAll('PERSONAL_PROYECTOS', { CODIGOPR: codigopr });
    const refPers = new Set((proyectos || []).map((p) => String(p.REF_PER)));
    rows = rows.filter((r) => refPers.has(String(r.REF_PER)));
  }

  // JOIN con LISTA_PERSONAL
  const { data: personal } = await getPersonal();
  const personalMap = {};
  (personal || []).forEach((p) => { personalMap[String(p.REF_PER)] = p; });

  const result = rows.map((vac) => {
    const person = personalMap[String(vac.REF_PER)];
    if (person) {
      return {
        ...vac,
        NOMBRE: person.NOMBRE,
        APELLIDO1: person.APELLIDO1,
        APELLIDO2: person.APELLIDO2,
        PERFIL: person.PERFIL,
        USUARIO: person.USUARIO,
      };
    }
    return vac;
  });
  return { data: result };
};

const getVacacionesFicheros = async () => {
  const { data, error } = await table('VACACIONES').select('origen_fichero');
  throwIfError({ error });
  const values = [...new Set((data || []).map((r) => r.origen_fichero).filter(Boolean))].sort();
  return { data: values.map(v => ({ ORIGEN_FICHERO: v })) };
};

const importVacaciones = async (rows) => {
  const payload = rows.map((r) => ({
    ref_per: parseInt(r.ref_per),
    duracion: r.duracion != null ? parseFloat(r.duracion) : null,
    fecha_desde: r.fecha_desde ? String(r.fecha_desde).split('T')[0] : null,
    fecha_hasta: r.fecha_hasta ? String(r.fecha_hasta).split('T')[0] : null,
    particion_num: r.particion_num != null ? parseInt(r.particion_num) : null,
    origen_fichero: r.origen_fichero || 'Carga manual',
  }));
  const { data, error } = await table('VACACIONES').insert(payload).select();
  throwIfError({ error });
  return { data: { status: 'success', message: `${payload.length} periodos de vacaciones importados correctamente` } };
};

const updateVacacion = async (id, data) => {
  const payload = {
    duracion: data.duracion != null && data.duracion !== '' ? parseFloat(data.duracion) : null,
    fecha_desde: data.fecha_desde ? String(data.fecha_desde).split('T')[0] : null,
    fecha_hasta: data.fecha_hasta ? String(data.fecha_hasta).split('T')[0] : null,
    particion_num: data.particion_num != null && data.particion_num !== '' ? parseInt(data.particion_num) : null,
    origen_fichero: data.origen_fichero,
  };
  return updateRow('VACACIONES', payload, { ID_VACACION: parseInt(id) });
};

const deleteVacacion = (id) =>
  deleteRow('VACACIONES', { ID_VACACION: parseInt(id) });

const deleteVacacionesPorFichero = (filename) =>
  deleteRow('VACACIONES', { ORIGEN_FICHERO: filename });

// ─────────────────────────────────────────────────────────────────────────────
// FESTIVOS
// ─────────────────────────────────────────────────────────────────────────────

const getFestivos = async (year, ref_ubi) => {
  const filters = {};
  if (year) filters.YEAR = parseInt(year);
  if (ref_ubi) filters.REF_UBI = parseInt(ref_ubi);
  return selectAll('FESTIVOS', filters);
};

const createFestivo = (data) =>
  insertRows('FESTIVOS', {
    YEAR: parseInt(data.year),
    REF_UBI: data.ref_ubi != null ? parseInt(data.ref_ubi) : null,
    FECHA: data.fecha,
    DESCRIPCION: data.descripcion,
  });

const updateFestivo = (data) => {
  const id = data.id_festivo || data.id;
  return updateRow(
    'FESTIVOS',
    {
      YEAR: data.year != null ? parseInt(data.year) : null,
      REF_UBI: data.ref_ubi != null ? parseInt(data.ref_ubi) : null,
      FECHA: data.fecha,
      DESCRIPCION: data.descripcion,
    },
    { ID_FESTIVO: parseInt(id) }
  );
};

const deleteFestivo = (id) =>
  deleteRow('FESTIVOS', { ID_FESTIVO: parseInt(id) });

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP / SINCRONIZACIÓN (ahora 100% en cliente)
// ─────────────────────────────────────────────────────────────────────────────

const exportBackup = async () => {
  const tables = ['UBICACION', 'ENCARGOS', 'LISTA_PERSONAL', 'PERSONAL_PROYECTOS', 'VACACIONES', 'FESTIVOS'];
  const backupData = {};
  for (const t of tables) {
    try {
      const { data } = await selectAll(t);
      backupData[t] = data;
    } catch (e) {
      console.warn(`No se pudo exportar ${t}:`, e.message);
      backupData[t] = [];
    }
  }
  return {
    data: {
      status: 'success',
      timestamp: new Date().toISOString(),
      data: backupData,
    },
  };
};

const importBackup = async (payload) => {
  const backupData = payload.data;
  const insertOrder = ['UBICACION', 'ENCARGOS', 'LISTA_PERSONAL', 'PERSONAL_PROYECTOS', 'VACACIONES', 'FESTIVOS'];
  const deleteOrder = ['VACACIONES', 'PERSONAL_PROYECTOS', 'LISTA_PERSONAL', 'ENCARGOS', 'FESTIVOS', 'UBICACION'];

  // 1. Vaciar tablas en orden inverso
  for (const t of deleteOrder) {
    try { await deleteAll(t); } catch (e) { console.warn(`No se pudo vaciar ${t}:`, e.message); }
  }

  // 2. Insertar datos en orden correcto
  const inserted_counts = {};
  for (const t of insertOrder) {
    if (backupData[t] && backupData[t].length > 0) {
      try {
        await insertRows(t, backupData[t]);
        inserted_counts[t] = backupData[t].length;
      } catch (e) {
        console.warn(`No se pudo importar ${t}:`, e.message);
      }
    }
  }

  return { data: { status: 'success', message: 'Datos importados con éxito', inserted_counts } };
};

// ─────────────────────────────────────────────────────────────────────────────
// APP_USUARIOS (tabla de usuarios de la aplicación con roles)
// ─────────────────────────────────────────────────────────────────────────────

const getAppUsuarios = () => selectAll('APP_USUARIOS', null, 'id');

const getAppUsuarioByEmail = async (email) => {
  const { data, error } = await table('APP_USUARIOS')
    .select('*')
    .ilike('email', email.trim())
    .maybeSingle();
  // maybeSingle devuelve null si no existe, sin lanzar error
  if (error) throwIfError({ error });
  return { data: data ? normalizeKeys([data])[0] : null };
};

const createAppUsuario = (data) => insertRows('APP_USUARIOS', data);

const updateAppUsuario = (id, data) => updateRow('APP_USUARIOS', data, { ID: id });

const deleteAppUsuario = (id) => deleteRow('APP_USUARIOS', { ID: id });

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA / QUERY (sin soporte en cliente)
// ─────────────────────────────────────────────────────────────────────────────

const getSchema = async () => {
  // Devuelve un schema estático conocido para la UI de QueryPage
  return {
    data: {
      LISTA_PERSONAL: ['REF_PER', 'NOMBRE', 'APELLIDO1', 'APELLIDO2', 'PERFIL', 'REF_UBI', 'USUARIO', 'INCORPORACION', 'BAJA', 'F_CONTRATO'],
      ENCARGOS: ['CODIGOPR', 'DENOMINACION', 'INICIO', 'FIN', 'FIN_REAL', 'ESTADO'],
      PERSONAL_PROYECTOS: ['REF_PER', 'CODIGOPR', 'ALTA', 'BAJA'],
      UBICACION: ['REF_UBI', 'A_LUGAR'],
      VACACIONES: ['ID_VACACION', 'REF_PER', 'FECHA_DESDE', 'FECHA_HASTA', 'DURACION', 'PARTICION_NUM', 'ORIGEN_FICHERO'],
      FESTIVOS: ['ID_FESTIVO', 'YEAR', 'REF_UBI', 'FECHA', 'DESCRIPCION'],
    },
  };
};

const runQuery = async (_sql) => {
  throw new Error('La ejecución de SQL arbitrario no está disponible en la versión web directa de Supabase.');
};

// ─────────────────────────────────────────────────────────────────────────────
// URL helpers (mantenidos por compatibilidad, ya no funcionales)
// ─────────────────────────────────────────────────────────────────────────────
const getApiUrl = () => import.meta.env.VITE_SUPABASE_URL || '';
const setApiUrl = () => {}; // no-op

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const api = {
  // Auth
  login,
  logout,
  getSession,
  getApiUrl,

  // App Usuarios (roles)
  getAppUsuarios,
  getAppUsuarioByEmail,
  createAppUsuario,
  updateAppUsuario,
  deleteAppUsuario,
  setApiUrl,

  // Encargos
  getEncargos,
  createEncargo,
  updateEncargo,
  deleteEncargo,

  // Personal
  getPersonal,
  createPersonal,
  updatePersonal,
  deletePersonal,
  bulkUpdatePersonalLocation,

  // Asignaciones
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,

  // Ubicación
  getUbicacion,
  createUbicacion,
  updateUbicacion,
  deleteUbicacion,

  // Vacaciones
  getVacaciones,
  getVacacionesFicheros,
  importVacaciones,
  updateVacacion,
  deleteVacacion,
  deleteVacacionesPorFichero,

  // Festivos
  getFestivos,
  createFestivo,
  updateFestivo,
  deleteFestivo,

  // Backup/Sync
  exportBackup,
  importBackup,

  // Schema/Query
  getSchema,
  runQuery,
};

export default api;
