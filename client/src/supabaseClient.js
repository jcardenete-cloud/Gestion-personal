import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son obligatorias. ' +
    'Crea un archivo .env.local con esas variables para desarrollo local.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SCHEMA = 'jcf';

/**
 * Devuelve un builder de query para una tabla del schema jcf.
 * Uso: table('LISTA_PERSONAL').select('*')
 */
export const table = (tableName) =>
  supabase.schema(SCHEMA).from(tableName.toLowerCase());

/**
 * Normaliza las claves de un array de filas a MAYÚSCULAS,
 * para mantener compatibilidad con el código existente que espera REF_PER, NOMBRE, etc.
 */
export const normalizeKeys = (rows) => {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const normalized = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.toUpperCase()] = v;
    }
    return normalized;
  });
};

/**
 * Lanza un error legible si la respuesta de Supabase contiene un error.
 */
export const throwIfError = ({ error }) => {
  if (error) throw new Error(error.message || JSON.stringify(error));
};
