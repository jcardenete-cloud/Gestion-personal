import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Save, Upload } from 'lucide-react';
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

const parseInteger = (value, fieldName) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`El valor de ${fieldName} no es válido.`);
  }
  return parsed;
};

const parseHours = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getEmployeeKeys = (employee) => {
  const firstName = employee.NOMBRE || '';
  const surname1 = employee.APELLIDO1 || '';
  const surname2 = employee.APELLIDO2 || '';
  return [
    normalize(`${surname1} ${surname2}, ${firstName}`),
    normalize(`${surname1}, ${firstName}`),
  ].filter(Boolean);
};

const parseWorkbook = (workbook, selectedAssignment, employees) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('El libro de Excel no contiene ninguna hoja.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const projectTitle = String(rows[2]?.[0] ?? '').trim();
  const projectCode = projectTitle.match(/^([^-]+)\s*-/)?.[1]?.trim();
  if (!projectCode || projectCode !== String(selectedAssignment.CODIGOPR).trim()) {
    throw new Error(
      `El fichero indica el encargo "${projectTitle || 'sin identificar'}" y no coincide con el seleccionado (${selectedAssignment.CODIGOPR}).`
    );
  }

  const headerIndex = rows.findIndex((row) => {
    const columns = row.map(normalize);
    return columns.includes('ano') &&
      columns.includes('mes') &&
      columns.includes('nombre') &&
      columns.includes('h mes');
  });
  if (headerIndex < 0) {
    throw new Error('No se encontraron las columnas AÑO, MES, NOMBRE y H.MES.');
  }

  const headers = rows[headerIndex].map(normalize);
  const yearIndex = headers.indexOf('ano');
  const monthIndex = headers.indexOf('mes');
  const nameIndex = headers.indexOf('nombre');
  const hoursIndex = headers.indexOf('h mes');
  const employeeMap = new Map();
  employees.forEach((employee) => {
    getEmployeeKeys(employee).forEach((key) => {
      const matches = employeeMap.get(key) || [];
      matches.push(employee);
      employeeMap.set(key, matches);
    });
  });

  let year;
  let month;
  const unmatched = [];
  const aggregates = new Map();
  let importedCount = 0;

  rows.slice(headerIndex + 1).forEach((row, index) => {
    const employeeName = String(row[nameIndex] ?? '').trim();
    if (!employeeName || normalize(employeeName) === 'total') return;

    const rowYear = parseInteger(row[yearIndex], 'AÑO');
    const rowMonth = parseInteger(row[monthIndex], 'MES');
    if (rowMonth < 1 || rowMonth > 12) {
      throw new Error(`El mes ${rowMonth} de la fila ${headerIndex + index + 2} no es válido.`);
    }
    if (year === undefined) {
      year = rowYear;
      month = rowMonth;
    } else if (year !== rowYear || month !== rowMonth) {
      throw new Error('El fichero contiene más de un mes o año; importa un único periodo cada vez.');
    }

    const candidates = employeeMap.get(normalize(employeeName)) || [];
    const uniqueCandidates = [...new Map(candidates.map((employee) => [
      String(employee.REF_PER),
      employee,
    ])).values()];
    if (uniqueCandidates.length !== 1) {
      unmatched.push({
        name: employeeName,
        reason: uniqueCandidates.length ? 'coincidencia ambigua' : 'no encontrado',
      });
      return;
    }

    const hours = parseHours(row[hoursIndex]);
    if (hours === null || hours < 0) {
      throw new Error(`Las horas H.MES de "${employeeName}" no son válidas.`);
    }
    const profile = String(uniqueCandidates[0].PERFIL ?? '').trim();
    if (!profile) {
      throw new Error(`El empleado "${employeeName}" no tiene perfil asignado en la base de datos.`);
    }

    const profileKey = normalize(profile);
    const aggregate = aggregates.get(profileKey) || { perfil: profile, horas: 0, empleados: 0 };
    aggregate.horas += hours;
    aggregate.empleados += 1;
    aggregates.set(profileKey, aggregate);
    importedCount += 1;
  });

  if (year === undefined || importedCount === 0) {
    throw new Error('No se encontraron filas de empleados con horas para importar.');
  }
  if (unmatched.length) {
    const names = unmatched.slice(0, 8).map(({ name, reason }) => `${name} (${reason})`).join(', ');
    const suffix = unmatched.length > 8 ? ` y ${unmatched.length - 8} más` : '';
    throw new Error(
      `${unmatched.length} empleado(s) no se pudieron asociar de forma unívoca al personal: ${names}${suffix}. No se han calculado mediciones.`
    );
  }

  return {
    anio: year,
    mes: month,
    importedCount,
    aggregates: [...aggregates.values()]
      .map((item) => ({ ...item, horas: Math.round((item.horas + Number.EPSILON) * 100) / 100 }))
      .sort((a, b) => a.perfil.localeCompare(b.perfil, 'es')),
  };
};

const MedicionesPage = () => {
  const { isReadOnly } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [assignmentResponse, employeeResponse] = await Promise.all([
          api.getEncargos(),
          api.getPersonal(),
        ]);
        if (!active) return;
        setAssignments(assignmentResponse.data);
        setEmployees(employeeResponse.data);
      } catch (error) {
        if (active) setErrorMessage(`No se pudieron cargar encargos y empleados: ${error.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, []);

  const selectedAssignment = useMemo(
    () => assignments.find((item) => String(item.CODIGOPR) === selectedCode),
    [assignments, selectedCode]
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setResult(null);
    setErrorMessage('');
    setSuccessMessage('');
    setFileName(file?.name || '');
    if (!file) return;
    if (!selectedAssignment) {
      setErrorMessage('Selecciona primero el encargo al que pertenece el fichero.');
      event.target.value = '';
      setFileName('');
      return;
    }
    if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      setErrorMessage('Selecciona un fichero Excel con extensión .xlsx, .xls o .xlsm.');
      event.target.value = '';
      setFileName('');
      return;
    }

    setProcessing(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setResult(parseWorkbook(workbook, selectedAssignment, employees));
    } catch (error) {
      setErrorMessage(`No se pudo procesar el fichero: ${error.message}`);
      setFileName('');
      event.target.value = '';
    } finally {
      setProcessing(false);
    }
  };

  const handleAssignmentChange = (event) => {
    setSelectedCode(event.target.value);
    setResult(null);
    setFileName('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSave = async () => {
    if (!result || !selectedAssignment || isReadOnly) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const records = result.aggregates.map(({ perfil, horas }) => ({
        codigopr: String(selectedAssignment.CODIGOPR),
        anio: result.anio,
        mes: result.mes,
        perfil,
        horas,
      }));
      await api.saveMediciones(records);
      setSuccessMessage(
        `Se han guardado ${records.length} perfiles para ${String(result.mes).padStart(2, '0')}/${result.anio}. Si ya existían, sus valores se han actualizado.`
      );
    } catch (error) {
      setErrorMessage(`No se pudieron guardar las mediciones: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Mediciones por perfil</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Selecciona un encargo y carga el Excel de horas para obtener el total mensual por perfil.
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
            Encargo
            <select
              value={selectedCode}
              onChange={handleAssignmentChange}
              disabled={loading || processing || saving}
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
          <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
            Hoja de horas
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400 }}>
              <input
                key={selectedCode}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileChange}
                disabled={!selectedAssignment || loading || processing || saving}
                style={{ maxWidth: '100%' }}
              />
            </span>
          </label>
        </div>
        {fileName && (
          <p style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginTop: '1rem', color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={17} /> {fileName}
            {processing && <span>— procesando…</span>}
          </p>
        )}
        {!isReadOnly && result && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: '1rem' }}>
            {saving ? <Upload size={17} /> : <Save size={17} />}
            {saving ? 'Guardando…' : 'Guardar mediciones'}
          </button>
        )}
        {isReadOnly && (
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            Tu perfil permite consultar el resumen, pero no guardar mediciones.
          </p>
        )}
      </section>

      {result && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>
                {String(result.mes).padStart(2, '0')}/{result.anio} — {selectedAssignment?.NOMBRE}
              </h3>
              <p style={{ color: 'var(--text-muted)' }}>
                {result.importedCount} empleados asociados · {result.aggregates.length} perfiles
              </p>
            </div>
            <p style={{ fontWeight: 600 }}>
              Total: {result.aggregates.reduce((sum, item) => sum + item.horas, 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  {['Perfil', 'Empleados', 'Horas H.MES'].map((heading) => (
                    <th key={heading} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-card)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.aggregates.map((item) => (
                  <tr key={normalize(item.perfil)}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-card)' }}>{item.perfil}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-card)' }}>{item.empleados}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-card)' }}>
                      {item.horas.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default MedicionesPage;
