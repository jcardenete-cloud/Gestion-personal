import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Save,
  Search,
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

const formatHours = (hours) => Number(hours).toLocaleString('es-ES', {
  useGrouping: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (amount) => amount == null
  ? '—'
  : Number(amount).toLocaleString('es-ES', {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';

const shiftMonth = (value, offset) => {
  const [year, month] = value.split('-').map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
};

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (value) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
};

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

const parseWorkbook = (workbook, projectAssignment, employees, assignedEmployees) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('El libro de Excel no contiene ninguna hoja.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const projectTitle = String(rows[2]?.[0] ?? '').trim();
  const projectCode = projectTitle.match(/^([^-]+)\s*-/)?.[1]?.trim();
  if (!projectCode || projectCode !== String(projectAssignment.CODIGOPR).trim()) {
    throw new Error(`No se pudo validar el encargo indicado en el fichero "${projectTitle || 'sin identificar'}".`);
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
    codigopr: String(projectAssignment.CODIGOPR),
    encargoNombre: projectAssignment.NOMBRE,
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
    const assignment = parsedData.assignedEmployees.find(
      (candidate) => String(candidate.REF_PER) === String(employee.REF_PER)
    );
    const profileKey = normalize(profile);
    const aggregate = aggregates.get(profileKey) || {
      perfil: profile,
      horas: 0,
      empleados: 0,
      importe: 0,
      tarifasIncompletas: 0,
    };
    aggregate.horas += record.hours;
    aggregate.empleados += 1;
    const tariff = assignment?.TARIFA == null || assignment.TARIFA === ''
      ? null
      : Number(assignment.TARIFA);
    if (tariff === null || !Number.isFinite(tariff)) {
      aggregate.tarifasIncompletas += 1;
    } else {
      aggregate.importe += record.hours * tariff;
    }
    aggregates.set(profileKey, aggregate);
  }

  return {
    anio: parsedData.anio,
    mes: parsedData.mes,
    importedCount: parsedData.records.length,
    aggregates: [...aggregates.values()]
      .map((item) => ({
        ...item,
        horas: Math.round((item.horas + Number.EPSILON) * 100) / 100,
        importe: item.tarifasIncompletas > 0
          ? null
          : Math.round((item.importe + Number.EPSILON) * 100) / 100,
      }))
      .sort((a, b) => a.perfil.localeCompare(b.perfil, 'es')),
  };
};

const MedicionesPage = () => {
  const { isReadOnly } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [consultationCode, setConsultationCode] = useState('');
  const [consultationSearch, setConsultationSearch] = useState('');
  const [consultationRows, setConsultationRows] = useState([]);
  const [consultationAnchorMonth] = useState(getCurrentMonth);
  const [consultationStartMonth, setConsultationStartMonth] = useState(
    () => shiftMonth(getCurrentMonth(), -2)
  );
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationError, setConsultationError] = useState('');
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

  const unresolvedRecords = useMemo(
    () => parsedData?.records.filter((record) => !record.employee) || [],
    [parsedData]
  );
  const result = useMemo(
    () => buildMeasurementResult(parsedData, manualSelections),
    [parsedData, manualSelections]
  );
  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) =>
      String(a.CODIGOPR ?? '').localeCompare(
        String(b.CODIGOPR ?? ''),
        'es',
        { numeric: true, sensitivity: 'base' }
      )
    ),
    [assignments]
  );
  const filteredAssignments = useMemo(() => {
    const search = normalize(consultationSearch);
    return sortedAssignments.filter((assignment) => !search || normalize(
      `${assignment.CODIGOPR ?? ''} ${assignment.NOMBRE ?? ''}`
    ).includes(search));
  }, [sortedAssignments, consultationSearch]);
  const consultationMonths = useMemo(
    () => [0, 1, 2].map((offset) => shiftMonth(consultationStartMonth, offset)),
    [consultationStartMonth]
  );
  const consultationSummary = useMemo(() => {
    const hoursByProfileMonth = new Map();
    const profileNames = new Map();
    const availableMonths = [];

    consultationRows.forEach((row) => {
      const year = Number(row.ANIO);
      const month = Number(row.MES);
      const hours = Number(row.HORAS);
      const profile = String(row.PERFIL ?? '').trim();
      if (!Number.isInteger(year) || !Number.isInteger(month) ||
          month < 1 || month > 12 || !Number.isFinite(hours) || !profile) return;

      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const profileKey = normalize(profile);
      availableMonths.push(monthKey);
      profileNames.set(profileKey, profileNames.get(profileKey) || profile);
      const profileMonths = hoursByProfileMonth.get(profileKey) || new Map();
      profileMonths.set(monthKey, (profileMonths.get(monthKey) || 0) + hours);
      hoursByProfileMonth.set(profileKey, profileMonths);
    });

    const minMonth = availableMonths.length ? [...availableMonths].sort()[0] : null;
    const maxMonth = availableMonths.length ? [...availableMonths].sort().at(-1) : null;
    const profiles = [...profileNames.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const totals = consultationMonths.map((month) => profiles.reduce(
      (total, profile) => total + (hoursByProfileMonth.get(profile.key)?.get(month) || 0),
      0
    ));

    return {
      profiles,
      hoursByProfileMonth,
      totals,
      canGoBack: Boolean(minMonth && minMonth < consultationMonths[0]),
      canGoForward: Boolean(
        (maxMonth && maxMonth > consultationMonths[2]) ||
        consultationMonths[0] < shiftMonth(consultationAnchorMonth, -2)
      ),
    };
  }, [consultationAnchorMonth, consultationRows, consultationMonths]);

  useEffect(() => {
    if (activeTab !== 'consultation' || !consultationCode) {
      setConsultationRows([]);
      setConsultationLoading(false);
      setConsultationError('');
      return undefined;
    }

    let active = true;
    setConsultationRows([]);
    setConsultationLoading(true);
    setConsultationError('');
    api.getMedicionesEncargo(consultationCode)
      .then(({ data }) => {
        if (active) setConsultationRows(data);
      })
      .catch((error) => {
        if (active) setConsultationError(`No se pudieron cargar las mediciones del encargo: ${error.message}`);
      })
      .finally(() => {
        if (active) setConsultationLoading(false);
      });

    return () => { active = false; };
  }, [activeTab, consultationCode]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setParsedData(null);
    setManualSelections({});
    setErrorMessage('');
    setSuccessMessage('');
    setFileName(file?.name || '');
    if (!file) return;
    if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      setErrorMessage('Selecciona un fichero Excel con extensión .xlsx, .xls o .xlsm.');
      event.target.value = '';
      setFileName('');
      return;
    }

    setProcessing(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('El libro de Excel no contiene ninguna hoja.');
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
      const projectTitle = String(rows[2]?.[0] ?? '').trim();
      const projectCode = projectTitle.match(/^([^-]+)\s*-/)?.[1]?.trim();
      if (!projectCode) {
        throw new Error(`No se encontró un código de encargo válido en la hoja ("${projectTitle || 'sin identificar'}").`);
      }
      const projectAssignment = assignments.find(
        (assignment) => String(assignment.CODIGOPR).trim() === projectCode
      );
      if (!projectAssignment) {
        throw new Error(`El encargo ${projectCode} indicado en la hoja no existe en la base de datos.`);
      }
      const assignmentResponse = await api.getAssignments(projectAssignment.CODIGOPR);
      setParsedData(parseWorkbook(
        workbook,
        projectAssignment,
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

  const handleSave = async () => {
    if (!result || result.error || !parsedData || isReadOnly) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const records = result.aggregates.map(({ perfil, horas }) => ({
        codigopr: parsedData.codigopr,
        anio: result.anio,
        mes: result.mes,
        perfil,
        horas,
      }));
      await api.saveMediciones(records);
      setSuccessMessage(
        `Se han guardado ${records.length} perfiles del encargo ${parsedData.codigopr} para ${String(result.mes).padStart(2, '0')}/${result.anio}. Si ya existían, sus valores se han actualizado.`
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
          Carga mediciones desde Excel o consulta las horas guardadas por encargo y mes.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones de mediciones" style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-card)', marginBottom: '1.25rem' }}>
        {[
          { id: 'upload', label: 'Cargar mediciones' },
          { id: 'consultation', label: 'Consultar por encargo' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'upload' && errorMessage && (
        <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}
      {activeTab === 'upload' && successMessage && (
        <div role="status" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1rem', color: '#16794b' }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}
      {activeTab === 'upload' && result?.error && (
        <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{result.error}</span>
        </div>
      )}
      {activeTab === 'upload' && result && !result.error &&
        result.aggregates.some((item) => item.tarifasIncompletas > 0) && (
          <div role="status" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#9a6700' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>
              Hay {result.aggregates.reduce((count, item) => count + item.tarifasIncompletas, 0)} empleado(s) sin tarifa asignada en este encargo. El importe de su categoría se muestra como —.
            </span>
          </div>
        )}

      {activeTab === 'upload' && (
        <>
      <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr)', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
            Hoja de horas
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400 }}>
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileChange}
                disabled={loading || processing || saving}
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
                    Fila {record.id} · {formatHours(record.hours)} h
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
                Encargo {parsedData.codigopr} — {parsedData.encargoNombre}
              </h3>
              <p style={{ marginBottom: '0.3rem' }}>
                {String(result.mes).padStart(2, '0')}/{result.anio}
              </p>
              <p style={{ color: 'var(--text-muted)' }}>
                {result.importedCount} empleados asociados · {result.aggregates.length} perfiles
              </p>
            </div>
            <p style={{ fontWeight: 600 }}>
              Total horas: {formatHours(result.aggregates.reduce((sum, item) => sum + item.horas, 0))} h
              <br />
              Importe total: {formatCurrency(result.aggregates.some((item) => item.importe === null)
                ? null
                : result.aggregates.reduce((sum, item) => sum + item.importe, 0))}
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  {['Perfil', 'Empleados', 'Horas H.MES', 'Importe'].map((heading) => (
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
                      {formatHours(item.horas)}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-card)' }}>
                      {formatCurrency(item.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
        </>
      )}

      {activeTab === 'consultation' && (
        <>
          {errorMessage && (
            <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
          <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 680px)', gap: '1rem' }}>
              <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
                Buscar encargo por código o nombre
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={17} style={{ position: 'absolute', left: '0.7rem', color: 'var(--text-muted)' }} />
                  <input
                    type="search"
                    value={consultationSearch}
                    onChange={(event) => setConsultationSearch(event.target.value)}
                    placeholder="Escribe el código o el nombre del encargo"
                    disabled={loading || consultationLoading}
                    style={{ width: '100%', padding: '0.65rem 0.65rem 0.65rem 2.2rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                  />
                </span>
              </label>
              <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
                Encargo
                <select
                  value={consultationCode}
                  onChange={(event) => setConsultationCode(event.target.value)}
                  disabled={loading || consultationLoading}
                  style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                >
                  <option value="">{loading ? 'Cargando encargos…' : 'Selecciona un encargo'}</option>
                  {filteredAssignments.map((assignment) => (
                    <option key={assignment.CODIGOPR} value={String(assignment.CODIGOPR)}>
                      {assignment.CODIGOPR} — {assignment.NOMBRE}
                    </option>
                  ))}
                  {!loading && filteredAssignments.length === 0 && (
                    <option value="" disabled>No hay encargos que coincidan con la búsqueda</option>
                  )}
                </select>
              </label>
            </div>
          </section>

          {consultationError && (
            <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{consultationError}</span>
            </div>
          )}

          {consultationCode && (
            <section className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>
                    Encargo {consultationCode} — {assignments.find(
                      (assignment) => String(assignment.CODIGOPR) === consultationCode
                    )?.NOMBRE}
                  </h3>
                  <p style={{ color: 'var(--text-muted)' }}>
                    Mediciones por perfil · {formatMonth(consultationMonths[0])} – {formatMonth(consultationMonths[2])}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setConsultationStartMonth((month) => shiftMonth(month, -3))}
                    disabled={consultationLoading || !consultationSummary.canGoBack}
                    aria-label="Ver mediciones de meses anteriores"
                  >
                    <ChevronLeft size={18} /> Meses anteriores
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setConsultationStartMonth((month) => shiftMonth(month, 3))}
                    disabled={consultationLoading || !consultationSummary.canGoForward}
                    aria-label="Ver mediciones de meses siguientes"
                  >
                    Meses siguientes <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {consultationLoading ? (
                <p role="status" style={{ color: 'var(--text-muted)' }}>Cargando mediciones guardadas…</p>
              ) : (
                <>
                  {consultationSummary.profiles.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      No hay mediciones guardadas para este encargo; los totales se muestran como cero.
                    </p>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', textAlign: 'left', marginTop: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>Perfil</th>
                          {consultationMonths.map((month) => (
                            <th key={month} style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)', textTransform: 'capitalize' }}>
                                <span style={{ display: 'block', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' }}>
                                  {formatMonth(month)}
                                </span>
                              </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {consultationSummary.profiles.map((profile) => {
                          const profileMonths = consultationSummary.hoursByProfileMonth.get(profile.key);
                          return (
                            <tr key={profile.key}>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{profile.name}</td>
                              {consultationMonths.map((month) => (
                                <td key={month} style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatHours(profileMonths.get(month) || 0)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        <tr>
                          <th style={{ padding: '0.7rem', borderTop: '2px solid var(--border-card)' }}>Total</th>
                          {consultationSummary.totals.map((total, index) => (
                            <th key={consultationMonths[index]} style={{ padding: '0.7rem', borderTop: '2px solid var(--border-card)', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                              {formatHours(total)}
                            </th>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                    Se muestran el mes actual y los dos anteriores. Los meses sin mediciones aparecen con 0,00 horas.
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default MedicionesPage;
