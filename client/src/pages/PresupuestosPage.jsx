import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api';
import { useAuth } from '../AuthContext';

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value ?? '').trim().replace(/[€\s]/g, '');
  if (!text || text.startsWith('=')) return null;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const findBudgetTable = (workbook) => {
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
    }),
  }));
  const findHeader = ({ rows }) => rows.findIndex((row) => {
    const headers = row.map(normalize);
    return headers.includes('codigo') &&
      headers.includes('ud') &&
      headers.includes('resumen') &&
      headers.includes('precio unidad') &&
      headers.includes('unidades') &&
      headers.includes('importe');
  });
  const preferredSheet = sheets.find(({ name }) => normalize(name) === 'help');
  const source = preferredSheet && findHeader(preferredSheet) >= 0
    ? preferredSheet
    : sheets.find((sheet) => findHeader(sheet) >= 0);

  if (!source) {
    throw new Error('No se encontró una tabla con las columnas Código, Ud, Resumen, Precio Unidad, Unidades e Importe.');
  }

  return { ...source, headerIndex: findHeader(source) };
};

const parseBudget = (workbook, assignment) => {
  const { rows, headerIndex } = findBudgetTable(workbook);
  const headers = rows[headerIndex].map(normalize);
  const columns = {
    codigo: headers.indexOf('codigo'),
    unidad: headers.indexOf('ud'),
    resumen: headers.indexOf('resumen'),
    precio: headers.indexOf('precio unidad'),
    unidades: headers.indexOf('unidades'),
    importe: headers.indexOf('importe'),
    detalle: headers.indexOf('detalle'),
  };
  const detailIndex = columns.detalle >= 0 ? columns.detalle : columns.importe + 1;

  for (const row of rows.slice(0, headerIndex)) {
    const title = String(row[0] ?? '').trim();
    const titleCode = title.match(/^([^-]+)\s*-/)?.[1]?.trim();
    if (titleCode && titleCode !== String(assignment.CODIGOPR).trim()) {
      throw new Error(`El Excel parece corresponder al encargo ${titleCode}, no al encargo seleccionado ${assignment.CODIGOPR}.`);
    }
  }

  const lines = [];
  let totalCount = 0;
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const codigo = String(row[columns.codigo] ?? '').trim();
    const resumen = String(row[columns.resumen] ?? '').trim();
    const unidad = String(row[columns.unidad] ?? '').trim();
    if (!codigo && !resumen && !unidad) return;

    let tipo = 'partida';
    const normalizedDescription = normalize(resumen);
    if (normalizedDescription === 'total') {
      totalCount += 1;
      tipo = totalCount === 1 ? 'subtotal' : 'total_presupuesto';
    } else if (normalizedDescription.includes('costes indirectos')) {
      tipo = 'costes_indirectos';
    } else if (normalizedDescription.includes('gastos generales')) {
      tipo = 'gastos_generales';
    } else if (!codigo) {
      tipo = 'otro';
    }

    const precioUnidad = parseNumber(row[columns.precio]);
    const unidades = parseNumber(row[columns.unidades]);
    let importe = parseNumber(row[columns.importe]);
    if (importe === null && tipo === 'partida' &&
        precioUnidad !== null && unidades !== null) {
      importe = precioUnidad * unidades;
    }

    lines.push({
      orden: index + 1,
      tipo,
      codigo: codigo || null,
      unidad: unidad || null,
      resumen,
      precio_unidad: precioUnidad,
      unidades,
      importe,
      detalle: String(row[detailIndex] ?? '').trim() || null,
    });
  });

  if (lines.length === 0) {
    throw new Error('La hoja no contiene partidas o totales para importar.');
  }

  const directLineTotal = lines
    .filter((line) => line.tipo === 'partida')
    .reduce((total, line) => total + (line.importe || 0), 0);
  const subtotalLine = lines.find((line) => line.tipo === 'subtotal');
  const totalDirecto = subtotalLine?.importe ?? directLineTotal;
  const indirectLine = lines.find((line) => line.tipo === 'costes_indirectos');
  const generalLine = lines.find((line) => line.tipo === 'gastos_generales');
  const indirectRate = indirectLine?.precio_unidad ?? null;
  const generalRate = generalLine?.precio_unidad ?? null;
  const costesIndirectos = indirectLine?.importe ??
    (indirectRate === null ? 0 : totalDirecto * indirectRate);
  const gastosGenerales = generalLine?.importe ??
    (generalRate === null ? 0 : (totalDirecto + costesIndirectos) * generalRate);
  const totalPresupuesto = [...lines].reverse()
    .find((line) => line.tipo === 'total_presupuesto')?.importe ??
    (totalDirecto + costesIndirectos + gastosGenerales);
  const durationIndex = headers.indexOf('meses');
  const durationMonths = durationIndex >= 0
    ? parseNumber(rows[headerIndex][durationIndex + 1])
    : null;

  return {
    codigopr: String(assignment.CODIGOPR),
    encargo_nombre: assignment.NOMBRE || null,
    duracion_meses: durationMonths,
    partidas: lines,
    total_directo: totalDirecto,
    porcentaje_costes_indirectos: indirectRate,
    costes_indirectos: costesIndirectos,
    porcentaje_gastos_generales: generalRate,
    gastos_generales: gastosGenerales,
    total_presupuesto: totalPresupuesto,
  };
};

const formatNumber = (value) => value == null
  ? '—'
  : Number(value).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatCurrency = (value) => value == null
  ? '—'
  : `${formatNumber(value)} €`;

const PresupuestosPage = () => {
  const { isReadOnly } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [savedBudget, setSavedBudget] = useState(null);
  const [draft, setDraft] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.getEncargos()
      .then(({ data }) => {
        if (active) setAssignments(data);
      })
      .catch((error) => {
        if (active) setErrorMessage(`No se pudieron cargar los encargos: ${error.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedCode) {
      setSavedBudget(null);
      return undefined;
    }
    let active = true;
    setBudgetLoading(true);
    setSavedBudget(null);
    setErrorMessage('');
    api.getPresupuestoEncargo(selectedCode)
      .then(({ data }) => {
        if (active) setSavedBudget(data[0] || null);
      })
      .catch((error) => {
        if (active) setErrorMessage(`No se pudo consultar el presupuesto: ${error.message}`);
      })
      .finally(() => {
        if (active) setBudgetLoading(false);
      });
    return () => { active = false; };
  }, [selectedCode]);

  const selectedAssignment = assignments.find(
    (assignment) => String(assignment.CODIGOPR) === selectedCode
  );

  const handleAssignmentChange = (event) => {
    setSelectedCode(event.target.value);
    setDraft(null);
    setFileName('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setDraft(null);
    setFileName('');
    setErrorMessage('');
    setSuccessMessage('');
    if (!file) return;
    if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      setErrorMessage('Selecciona un fichero Excel con extensión .xlsx, .xls o .xlsm.');
      event.target.value = '';
      return;
    }
    if (!selectedAssignment) {
      setErrorMessage('Selecciona primero el encargo al que corresponde el presupuesto.');
      event.target.value = '';
      return;
    }

    setProcessing(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setDraft(parseBudget(workbook, selectedAssignment));
      setFileName(file.name);
    } catch (error) {
      setErrorMessage(`No se pudo procesar el Excel: ${error.message}`);
      event.target.value = '';
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !selectedAssignment || isReadOnly) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await api.savePresupuestoEncargo({
        ...draft,
        archivo_origen: fileName,
      });
      setSavedBudget(response.data[0] || { ...draft, archivo_origen: fileName });
      setDraft(null);
      setFileName('');
      setSuccessMessage(`Presupuesto del encargo ${selectedCode} guardado correctamente. La carga sustituye el presupuesto anterior.`);
    } catch (error) {
      setErrorMessage(`No se pudo guardar el presupuesto: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const budget = draft
    ? {
      ...draft,
      PARTIDAS: draft.partidas,
      DURACION_MESES: draft.duracion_meses,
      TOTAL_DIRECTO: draft.total_directo,
      PORCENTAJE_COSTES_INDIRECTOS: draft.porcentaje_costes_indirectos,
      COSTES_INDIRECTOS: draft.costes_indirectos,
      PORCENTAJE_GASTOS_GENERALES: draft.porcentaje_gastos_generales,
      GASTOS_GENERALES: draft.gastos_generales,
      TOTAL_PRESUPUESTO: draft.total_presupuesto,
    }
    : savedBudget;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Presupuestos por encargo</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Carga y consulta las partidas, importes y totales del presupuesto de cada encargo.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div role="status" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1rem', color: '#16794b' }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'grid', gap: '0.45rem', maxWidth: '680px', fontWeight: 600 }}>
          Encargo
          <select
            value={selectedCode}
            onChange={handleAssignmentChange}
            disabled={loading || budgetLoading || processing || saving}
            style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
          >
            <option value="">{loading ? 'Cargando encargos…' : 'Selecciona un encargo'}</option>
            {assignments.map((assignment) => (
              <option key={assignment.CODIGOPR} value={String(assignment.CODIGOPR)}>
                {assignment.CODIGOPR} — {assignment.NOMBRE}
              </option>
            ))}
          </select>
        </label>

        {selectedAssignment && !isReadOnly && (
          <div style={{ marginTop: '1.25rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
              Hoja Excel del presupuesto
              <input
                key={selectedCode}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileChange}
                disabled={processing || saving}
                style={{ maxWidth: '100%', fontWeight: 400 }}
              />
            </label>
            {fileName && (
              <p style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginTop: '0.75rem', color: 'var(--text-muted)' }}>
                <FileSpreadsheet size={17} /> {fileName}
                {processing && <span>— procesando…</span>}
              </p>
            )}
          </div>
        )}

        {isReadOnly && (
          <p style={{ marginTop: '0.9rem', color: 'var(--text-muted)' }}>
            Tu perfil permite consultar presupuestos, pero no cargar ni modificar datos.
          </p>
        )}
      </section>

      {budgetLoading && (
        <section className="glass-card" role="status">Consultando presupuesto…</section>
      )}
      {selectedAssignment && !budgetLoading && !budget && !draft && (
        <section className="glass-card" style={{ color: 'var(--text-muted)' }}>
          Este encargo todavía no tiene un presupuesto cargado.
        </section>
      )}

      {budget && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>
                {selectedAssignment?.CODIGOPR} — {selectedAssignment?.NOMBRE}
              </h3>
              <p style={{ color: 'var(--text-muted)' }}>
                {draft ? 'Vista previa del Excel' : `Archivo: ${savedBudget?.ARCHIVO_ORIGEN || 'sin información'}`}
                {budget.DURACION_MESES != null && ` · Duración: ${budget.DURACION_MESES} meses`}
              </p>
            </div>
            {draft && !isReadOnly && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Upload size={17} /> : <Save size={17} />}
                {saving ? 'Guardando…' : 'Guardar presupuesto'}
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem', marginTop: '1.25rem' }}>
            {[
              ['Costes directos', budget.TOTAL_DIRECTO],
              [`Costes indirectos${budget.PORCENTAJE_COSTES_INDIRECTOS == null ? '' : ` (${formatNumber(budget.PORCENTAJE_COSTES_INDIRECTOS * 100)}%)`}`, budget.COSTES_INDIRECTOS],
              [`Gastos generales${budget.PORCENTAJE_GASTOS_GENERALES == null ? '' : ` (${formatNumber(budget.PORCENTAJE_GASTOS_GENERALES * 100)}%)`}`, budget.GASTOS_GENERALES],
              ['Total presupuesto', budget.TOTAL_PRESUPUESTO],
            ].map(([label, value], index) => (
              <div key={label} style={{ padding: '0.9rem', border: '1px solid var(--border-card)', borderRadius: '10px', background: index === 3 ? 'var(--glass2-bg)' : 'transparent' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{label}</div>
                <strong style={{ fontSize: '1.1rem', color: index === 3 ? 'var(--primary)' : 'var(--text-main)' }}>
                  {formatCurrency(value)}
                </strong>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', marginTop: 0 }}>
              <thead>
                <tr>
                  {['Código', 'Ud', 'Resumen / detalle', 'Precio unidad', 'Unidades', 'Importe'].map((heading) => (
                    <th key={heading} style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(budget.PARTIDAS || []).map((line) => {
                  const isTotal = line.tipo === 'subtotal' || line.tipo === 'total_presupuesto';
                  const isAdditionalCost = line.tipo === 'costes_indirectos' || line.tipo === 'gastos_generales';
                  return (
                    <tr key={`${line.orden}-${line.codigo || line.tipo}`}>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{line.codigo || '—'}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{line.unidad || '—'}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>
                        <strong>{line.resumen}</strong>
                        {line.detalle && <span style={{ display: 'block', color: 'var(--text-muted)' }}>{line.detalle}</span>}
                      </td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)', textAlign: 'right' }}>
                        {isAdditionalCost && line.precio_unidad != null
                          ? `${formatNumber(line.precio_unidad * 100)}%`
                          : formatCurrency(line.precio_unidad)}
                      </td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)', textAlign: 'right' }}>{formatNumber(line.unidades)}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)', textAlign: 'right', fontWeight: isTotal ? 700 : 400 }}>
                        {formatCurrency(line.importe)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default PresupuestosPage;
