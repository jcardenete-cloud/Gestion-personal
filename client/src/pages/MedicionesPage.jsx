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

const parseWorkbook = (workbook, selectedAssignment, employees, assignedEmployees) => {
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
  const records = [];

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
    const hours = parseHours(row[hoursIndex]);
    if (hours === null || hours < 0) {
      throw new Error(`Las horas H.MES de "${employeeName}" no son válidas.`);
    }
    records.push({
      id: headerIndex + index + 2,
      name: employeeName,
      hours,
      employee: uniqueCandidates.length === 1 ? uniqueCandidates[0] : null,
    });
  });

  if (year === undefined || records.length === 0) {
    throw new Error('No se encontraron filas de empleados con horas para importar.');
  }

  return {
    anio: year,
    mes: month,
    records,
    assignedEmployees: [...new Map(assignedEmployees.map((employee) => [
      String(employee.REF_PER),
      employee,
    ])).values()],
  };
};

const buildMeasurementResult = (parsedData, manualSelections) => {
  if (!parsedData) return null;

  const aggregates = new Map();
  for (const record of parsedData.records) {
    const employee = record.employee || parsedData.assignedEmployees.find(
      (candidate) => String(candidate.REF_PER) === manualSelections[record.id]
    );
    if (!employee) return null;

    const profile = String(employee.PERFIL ?? '').trim();
    if (!profile) {
      return { error: `El empleado seleccionado para "${record.name}" no tiene perfil asignado en la base de datos.` };
    }
    const profileKey = normalize(profile);
    const aggregate = aggregates.get(profileKey) || { perfil: profile, horas: 0, empleados: 0 };
    aggregate.horas += record.hours;
    aggregate.empleados += 1;
    aggregates.set(profileKey, aggregate);
  }

  return {
    anio: parsedData.anio,
    mes: parsedData.mes,
    importedCount: parsedData.records.length,
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
  const [inforFilter, setInforFilter] = useState('S');
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [manualSelections, setManualSelections] = useState({});
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

  const openAssignments = useMemo(
    () => assignments.filter((item) => {
      const isOpen = item.FIN_REAL === null || item.FIN_REAL === undefined || item.FIN_REAL === '';
      const infor = String(item.INFOR || '').trim().toUpperCase();
      const matchesInfor = inforFilter === 'BOTH' ||
        (inforFilter === 'S' ? infor === 'S' : infor !== 'S');
      return isOpen && matchesInfor;
    }),
    [assignments, inforFilter]
  );
  const selectedAssignment = useMemo(
    () => openAssignments.find((item) => String(item.CODIGOPR) === selectedCode),
    [openAssignments, selectedCode]
  );
  const unresolvedRecords = useMemo(
    () => parsedData?.records.filter((record) => !record.employee) || [],
    [parsedData]
  );
  const result = useMemo(
    () => buildMeasurementResult(parsedData, manualSelections),
    [parsedData, manualSelections]
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setParsedData(null);
    setManualSelections({});
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
      const assignmentResponse = await api.getAssignments(selectedAssignment.CODIGOPR);
      setParsedData(parseWorkbook(
        workbook,
        selectedAssignment,
        employees,
        assignmentResponse.data
      ));
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
    setParsedData(null);
    setManualSelections({});
    setFileName('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleInforFilterChange = (event) => {
    setInforFilter(event.target.value);
    setSelectedCode('');
    setParsedData(null);
    setManualSelections({});
    setFileName('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSave = async () => {
    if (!result || result.error || !selectedAssignment || isReadOnly) return;
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
      {result?.error && (
        <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{result.error}</span>
        </div>
      )}

      <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
            Tipo de gestión (INFOR)
            <select
              value={inforFilter}
              onChange={handleInforFilterChange}
              disabled={loading || processing || saving}
              style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
            >
              <option value="S">Gestión directa</option>
              <option value="N">No gestión directa</option>
              <option value="BOTH">Todos</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
            Encargo
            <select
              value={selectedCode}
              onChange={handleAssignmentChange}
              disabled={loading || processing || saving}
              style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
            >
              <option value="">{loading ? 'Cargando encargos…' : 'Selecciona un encargo'}</option>
              {openAssignments.map((assignment) => (
                <option key={assignment.CODIGOPR} value={String(assignment.CODIGOPR)}>
                  {assignment.CODIGOPR} — {assignment.NOMBRE}
                </option>
              ))}
            </select>
            {!loading && openAssignments.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                No hay encargos abiertos para este filtro.
              </span>
            )}
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
        {!isReadOnly && result && !result.error && (
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

      {parsedData && unresolvedRecords.length > 0 && (
        <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Asociar empleados</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No se pudo identificar de forma única a {unresolvedRecords.length} empleado(s) del Excel. Selecciona para cada fila a la persona asignada a este encargo.
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Resueltas: {unresolvedRecords.filter((record) => manualSelections[record.id]).length} de {unresolvedRecords.length}
          </p>
          {parsedData.assignedEmployees.length === 0 && (
            <div role="alert" style={{ marginBottom: '1rem', color: '#b42318' }}>
              Este encargo no tiene empleados asignados disponibles para resolver las coincidencias.
            </div>
          )}
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {unresolvedRecords.map((record) => (
              <label key={record.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(260px, 2fr)', gap: '0.8rem', alignItems: 'center' }}>
                <span>
                  <strong>{record.name}</strong>
                  <span style={{ display: 'block', color: 'var(--text-muted)' }}>
                    Fila {record.id} · {record.hours.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h
                  </span>
                </span>
                <select
                  value={manualSelections[record.id] || ''}
                  onChange={(event) => {
                    const selectedRef = event.target.value;
                    setManualSelections((current) => {
                      const updated = { ...current };
                      if (selectedRef) updated[record.id] = selectedRef;
                      else delete updated[record.id];
                      return updated;
                    });
                    setSuccessMessage('');
                  }}
                  disabled={processing || saving || parsedData.assignedEmployees.length === 0}
                  style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                >
                  <option value="">Selecciona un empleado asignado</option>
                  {parsedData.assignedEmployees.map((employee) => (
                    <option key={employee.REF_PER} value={String(employee.REF_PER)}>
                      {[employee.NOMBRE, employee.APELLIDO1, employee.APELLIDO2].filter(Boolean).join(' ')}
                      {employee.PERFIL ? ` — ${employee.PERFIL}` : ' — Sin perfil'}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {result && !result.error && (
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
