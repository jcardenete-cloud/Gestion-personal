import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Save,
  Users,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const formatHours = (hours) => hours.toLocaleString('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const isActiveEmployee = (employee) =>
  String(employee?.ACTIVO ?? '').trim().toUpperCase() === 'S';

const toDateString = (date) => date.toISOString().slice(0, 10);

const parseMonth = (value) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Selecciona un mes válido.');
  return { year: Number(match[1]), month: Number(match[2]) };
};

const toIsoDate = (value, fieldName = 'fecha') => {
  if (value === null || value === undefined || value === '') return null;
  const date = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      toDateString(new Date(`${date}T00:00:00Z`)) !== date) {
    throw new Error(`El valor de ${fieldName} "${value}" no es una fecha válida.`);
  }
  return date;
};

const getVacationDates = (vacations, refPer, firstDay, lastDay) => {
  const days = new Set();
  vacations
    .filter((vacation) => String(vacation.REF_PER) === String(refPer))
    .forEach((vacation) => {
      const start = toIsoDate(vacation.FECHA_DESDE, 'FECHA_DESDE de vacaciones');
      const end = toIsoDate(vacation.FECHA_HASTA, 'FECHA_HASTA de vacaciones');
      if (!start || !end || start > end) {
        throw new Error(`Hay un periodo de vacaciones con fechas no válidas para el empleado ${refPer}.`);
      }
      const clippedStart = start < firstDay ? firstDay : start;
      const clippedEnd = end > lastDay ? lastDay : end;
      if (clippedStart > clippedEnd) return;

      const current = new Date(`${clippedStart}T00:00:00Z`);
      const final = new Date(`${clippedEnd}T00:00:00Z`);
      while (current <= final) {
        days.add(toDateString(current));
        current.setUTCDate(current.getUTCDate() + 1);
      }
    });
  return days;
};

const getEmployeeSchedule = (assignmentRows, employees, manualSelections) => {
  const peopleByRef = new Map(employees.map((person) => [String(person.REF_PER), person]));
  return assignmentRows.map((assignment) => {
    const linkedEmployee = peopleByRef.get(String(assignment.REF_PER));
    const selectedEmployee = peopleByRef.get(manualSelections[String(assignment.REF_PER)]);
    const employee = isActiveEmployee(linkedEmployee) && linkedEmployee?.PERFIL && linkedEmployee?.NOMBRE
      ? linkedEmployee
      : isActiveEmployee(selectedEmployee) ? selectedEmployee : null;
    return { assignment, employee: employee || null };
  });
};

const getPlanningSummary = ({
  assignmentRows,
  employees,
  manualSelections,
  vacations,
  holidays,
  config,
  monthValue,
}) => {
  if (!assignmentRows) return null;
  const scheduledEmployees = getEmployeeSchedule(assignmentRows, employees, manualSelections);
  if (scheduledEmployees.some(({ employee }) => !employee)) return null;

  const refs = scheduledEmployees.map(({ employee }) => String(employee.REF_PER));
  if (new Set(refs).size !== refs.length) {
    return { error: 'Un empleado está asociado a más de una asignación del encargo. Revisa las asociaciones manuales.' };
  }

  const { year, month } = parseMonth(monthValue);
  const settings = config[0];
  const hoursPerWeek = Number(settings?.HOURS_PER_WEEK);
  const summerHoursPerWeek = Number(settings?.HOURS_PER_WEEK_SUMMER);
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek < 0 ||
      !Number.isFinite(summerHoursPerWeek) || summerHoursPerWeek < 0) {
    return { error: 'Los valores hours_per_week y hours_per_week_summer de la tabla config no son válidos.' };
  }

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = toDateString(new Date(Date.UTC(year, month, 0)));
  const holidayDatesByLocation = new Map();
  holidays.forEach((holiday) => {
    if (Number(holiday.YEAR) !== year) return;
    const date = toIsoDate(holiday.FECHA, 'FECHA del festivo');
    const locationKey = holiday.REF_UBI == null ? '*' : String(holiday.REF_UBI);
    const dates = holidayDatesByLocation.get(locationKey) || new Set();
    dates.add(date);
    holidayDatesByLocation.set(locationKey, dates);
  });
  const nationalHolidays = holidayDatesByLocation.get('*') || new Set();

  const employeeRows = scheduledEmployees.map(({ assignment, employee }) => {
    const holidaysForEmployee = new Set([
      ...nationalHolidays,
      ...(holidayDatesByLocation.get(String(employee.REF_UBI)) || []),
    ]);
    const vacationDates = getVacationDates(vacations, employee.REF_PER, firstDay, lastDay);
    const assignmentStart = toIsoDate(assignment.ALTA, 'ALTA de la asignación');
    const assignmentEnd = toIsoDate(assignment.BAJA, 'BAJA de la asignación');
    if (assignmentStart && assignmentEnd && assignmentStart > assignmentEnd) {
      throw new Error(`La asignación del empleado ${employee.REF_PER} tiene ALTA posterior a BAJA.`);
    }
    const assignmentPercentage = assignment.PORCENTAJE == null || assignment.PORCENTAJE === ''
      ? 100
      : Number(assignment.PORCENTAJE);
    if (!Number.isFinite(assignmentPercentage) || assignmentPercentage < 0 || assignmentPercentage > 100) {
      throw new Error(`El porcentaje de asignación del empleado ${employee.REF_PER} debe estar entre 0 y 100.`);
    }
    let workingDays = 0;
    let vacationDays = 0;
    let hours = 0;

    const date = new Date(`${firstDay}T00:00:00Z`);
    const finalDate = new Date(`${lastDay}T00:00:00Z`);
    while (date <= finalDate) {
      const isoDate = toDateString(date);
      const weekday = date.getUTCDay();
      const weekdayWorkday = weekday !== 0 && weekday !== 6;
      const holiday = holidaysForEmployee.has(isoDate);
      let bridge = false;
      if (weekday === 1) {
        const nextDay = new Date(date);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        bridge = holidaysForEmployee.has(toDateString(nextDay));
      } else if (weekday === 5) {
        const previousDay = new Date(date);
        previousDay.setUTCDate(previousDay.getUTCDate() - 1);
        bridge = holidaysForEmployee.has(toDateString(previousDay));
      }
      const assignedOnDate = (!assignmentStart || isoDate >= assignmentStart) &&
        (!assignmentEnd || isoDate <= assignmentEnd);

      if (weekdayWorkday && !holiday && !bridge && assignedOnDate) {
        if (vacationDates.has(isoDate)) {
          vacationDays += 1;
        } else {
          workingDays += 1;
          const isSummerPeriod = isoDate >= `${year}-06-15` && isoDate <= `${year}-09-15`;
          hours += ((isSummerPeriod ? summerHoursPerWeek : hoursPerWeek) / 5) *
            (assignmentPercentage / 100);
        }
      }
      date.setUTCDate(date.getUTCDate() + 1);
    }

    return {
      refPer: employee.REF_PER,
      name: [employee.NOMBRE, employee.APELLIDO1, employee.APELLIDO2].filter(Boolean).join(' '),
      perfil: String(employee.PERFIL).trim(),
      porcentaje: assignmentPercentage,
      workingDays,
      vacationDays,
      horas: Math.round((hours + Number.EPSILON) * 100) / 100,
    };
  });

  const byProfile = new Map();
  employeeRows.forEach((employee) => {
    const profileKey = normalize(employee.perfil);
    const item = byProfile.get(profileKey) || { perfil: employee.perfil, horas: 0, empleados: 0 };
    item.horas += employee.horas;
    item.empleados += 1;
    byProfile.set(profileKey, item);
  });

  return {
    year,
    month,
    firstDay,
    lastDay,
    employees: employeeRows,
    profiles: [...byProfile.values()]
      .map((item) => ({ ...item, horas: Math.round((item.horas + Number.EPSILON) * 100) / 100 }))
      .sort((a, b) => a.perfil.localeCompare(b.perfil, 'es')),
  };
};

const PlanificacionPage = () => {
  const { isReadOnly } = useAuth();
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [config, setConfig] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [activeTab, setActiveTab] = useState('calculation');
  const [consultationCode, setConsultationCode] = useState('');
  const [savedPlanning, setSavedPlanning] = useState([]);
  const [consultationMonth, setConsultationMonth] = useState(currentMonth);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationError, setConsultationError] = useState('');
  const [monthValue, setMonthValue] = useState(currentMonth);
  const [assignmentRows, setAssignmentRows] = useState(null);
  const [manualSelections, setManualSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataErrorMessage, setDataErrorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [assignmentResponse, employeeResponse, vacationResponse, holidayResponse, configResponse] =
          await Promise.all([
            api.getEncargos(),
            api.getPersonal(),
            api.getVacaciones(),
            api.getFestivos(),
            api.getPlanningConfig(),
          ]);
        if (!active) return;
        if (configResponse.data.length !== 1) {
          throw new Error('La tabla config debe contener exactamente una fila con los parámetros horarios.');
        }
        setAssignments(assignmentResponse.data);
        setEmployees(employeeResponse.data);
        setVacations(vacationResponse.data);
        setHolidays(holidayResponse.data);
        setConfig(configResponse.data);
      } catch (error) {
        if (active) setDataErrorMessage(`No se pudieron cargar los datos de planificación: ${error.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeTab !== 'consultation' || !consultationCode) {
      setSavedPlanning([]);
      setConsultationLoading(false);
      setConsultationError('');
      return undefined;
    }

    let active = true;
    setSavedPlanning([]);
    setConsultationLoading(true);
    setConsultationError('');
    api.getPlanificacion(consultationCode)
      .then((response) => {
        if (active) setSavedPlanning(response.data);
      })
      .catch((error) => {
        if (active) setConsultationError(`No se pudo cargar la planificación guardada: ${error.message}`);
      })
      .finally(() => {
        if (active) setConsultationLoading(false);
      });

    return () => { active = false; };
  }, [activeTab, consultationCode]);

  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) =>
      String(a.CODIGOPR).localeCompare(String(b.CODIGOPR), 'es', { numeric: true })
    ),
    [assignments]
  );
  const selectedAssignment = useMemo(
    () => sortedAssignments.find((item) => String(item.CODIGOPR) === selectedCode),
    [sortedAssignments, selectedCode]
  );
  const activeProjects = useMemo(
    () => sortedAssignments.filter((item) =>
      item.FIN_REAL === null || item.FIN_REAL === undefined || item.FIN_REAL === ''
    ),
    [sortedAssignments]
  );
  const consultationProject = useMemo(
    () => activeProjects.find((item) => String(item.CODIGOPR) === consultationCode),
    [activeProjects, consultationCode]
  );
  const planningMonths = useMemo(() => {
    const months = new Set([currentMonth]);
    savedPlanning.forEach((row) => {
      const monthKey = `${row.ANIO}-${String(row.MES).padStart(2, '0')}`;
      if (monthKey <= currentMonth) months.add(monthKey);
    });
    return [...months].sort();
  }, [savedPlanning, currentMonth]);
  const previousPlanningMonth = [...planningMonths]
    .reverse()
    .find((month) => month < consultationMonth);
  const nextPlanningMonth = planningMonths.find((month) => month > consultationMonth);
  const consultationRows = savedPlanning
    .filter((row) => `${row.ANIO}-${String(row.MES).padStart(2, '0')}` === consultationMonth)
    .sort((a, b) => String(a.PERFIL).localeCompare(String(b.PERFIL), 'es'));
  const consultationTotal = consultationRows.reduce((total, row) => total + Number(row.HORAS || 0), 0);
  const unresolvedRows = useMemo(() => {
    if (!assignmentRows) return [];
    const employeeMap = new Map(employees.map((person) => [String(person.REF_PER), person]));
    return assignmentRows.filter((assignment) => {
      const employee = employeeMap.get(String(assignment.REF_PER));
      return !employee?.PERFIL || !employee?.NOMBRE;
    });
  }, [assignmentRows, employees]);
  const result = useMemo(
    () => {
      try {
        return getPlanningSummary({
          assignmentRows,
          employees,
          manualSelections,
          vacations,
          holidays,
          config,
          monthValue,
        });
      } catch (error) {
        return { error: error.message };
      }
    },
    [assignmentRows, employees, manualSelections, vacations, holidays, config, monthValue]
  );

  const handleCalculate = async () => {
    if (!selectedAssignment) {
      setErrorMessage('Selecciona un encargo.');
      return;
    }
    try {
      parseMonth(monthValue);
    } catch (error) {
      setErrorMessage(error.message);
      return;
    }
    setCalculating(true);
    setErrorMessage('');
    setSuccessMessage('');
    setAssignmentRows(null);
    setManualSelections({});
    try {
      const response = await api.getAssignments(selectedAssignment.CODIGOPR);
      if (response.data.length === 0) {
        throw new Error('El encargo seleccionado no tiene empleados asignados.');
      }
      const activeRefs = new Set(
        employees.filter(isActiveEmployee).map((employee) => String(employee.REF_PER))
      );
      const activeAssignments = response.data.filter(
        (assignment) =>
          activeRefs.has(String(assignment.REF_PER)) &&
          (assignment.BAJA === null || assignment.BAJA === undefined || assignment.BAJA === '')
      );
      if (activeAssignments.length === 0) {
        throw new Error('El encargo no tiene empleados activos (ACTIVO = S) y sin fecha de baja asignados.');
      }
      setAssignmentRows(activeAssignments);
    } catch (error) {
      setErrorMessage(`No se pudo preparar la planificación: ${error.message}`);
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!result || result.error || !selectedAssignment || isReadOnly) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.savePlanificacion(result.profiles.map(({ perfil, horas }) => ({
        codigopr: String(selectedAssignment.CODIGOPR),
        anio: result.year,
        mes: result.month,
        perfil,
        horas,
      })));
      setSuccessMessage(
        `Planificación guardada para ${selectedAssignment.CODIGOPR}, ${String(result.month).padStart(2, '0')}/${result.year}. Si ya existía, se ha actualizado.`
      );
    } catch (error) {
      setErrorMessage(`No se pudo guardar la planificación: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectionChange = (refPer, employeeRef) => {
    setManualSelections((current) => {
      const updated = { ...current };
      if (employeeRef) updated[String(refPer)] = employeeRef;
      else delete updated[String(refPer)];
      return updated;
    });
    setSuccessMessage('');
  };

  const peopleByRef = new Map(employees.map((person) => [String(person.REF_PER), person]));
  const candidateEmployees = assignmentRows
    ? [...new Map(assignmentRows
      .map((assignment) => peopleByRef.get(String(assignment.REF_PER)))
      .filter((person) => isActiveEmployee(person) && person?.PERFIL && person?.NOMBRE)
      .map((person) => [String(person.REF_PER), person])).values()]
      .sort((a, b) =>
      `${a.APELLIDO1 || ''} ${a.APELLIDO2 || ''} ${a.NOMBRE || ''}`.localeCompare(
        `${b.APELLIDO1 || ''} ${b.APELLIDO2 || ''} ${b.NOMBRE || ''}`,
        'es'
      )
    )
    : [];
  const mappedEmployeeIds = new Set([
    ...(assignmentRows || [])
      .filter((assignment) => {
        const person = peopleByRef.get(String(assignment.REF_PER));
        return isActiveEmployee(person) && person?.PERFIL && person?.NOMBRE;
      })
      .map((assignment) => String(assignment.REF_PER)),
    ...Object.values(manualSelections),
  ]);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Planificación</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Calcula las horas laborables del equipo, descontando festivos y vacaciones registradas.
        </p>
      </div>

      {dataErrorMessage && (
        <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{dataErrorMessage}</span>
        </div>
      )}

      <div role="tablist" aria-label="Vistas de planificación" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-card)', marginBottom: '1.25rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'calculation'}
          onClick={() => setActiveTab('calculation')}
          style={{
            padding: '0.8rem 1rem',
            border: 'none',
            borderBottom: activeTab === 'calculation' ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'calculation' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}
        >
          <CalendarRange size={16} /> Calcular planificación
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'consultation'}
          onClick={() => setActiveTab('consultation')}
          style={{
            padding: '0.8rem 1rem',
            border: 'none',
            borderBottom: activeTab === 'consultation' ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'consultation' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}
        >
          <CalendarDays size={16} /> Planificación guardada
        </button>
      </div>

      {activeTab === 'calculation' && (
        <>
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
            Encargo (ordenado por código)
            <select
              value={selectedCode}
              onChange={(event) => {
                setSelectedCode(event.target.value);
                setAssignmentRows(null);
                setManualSelections({});
                setSuccessMessage('');
              }}
              disabled={loading || calculating || saving}
              style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
            >
              <option value="">{loading ? 'Cargando encargos…' : 'Selecciona un encargo'}</option>
              {sortedAssignments.map((assignment) => (
                <option key={assignment.CODIGOPR} value={String(assignment.CODIGOPR)}>
                  {assignment.CODIGOPR} — {assignment.NOMBRE}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 600 }}>
            Mes
            <input
              type="month"
              value={monthValue}
              onChange={(event) => {
                setMonthValue(event.target.value);
                setAssignmentRows(null);
                setManualSelections({});
                setSuccessMessage('');
              }}
              disabled={loading || calculating || saving}
              style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
            />
          </label>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCalculate}
          disabled={loading || calculating || saving || !selectedCode || !monthValue}
          style={{ marginTop: '1rem' }}
        >
          <CalendarRange size={17} />
          {calculating ? 'Calculando…' : 'Calcular planificación'}
        </button>
        {loading && <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>Cargando vacaciones, festivos y parámetros horarios…</p>}
      </section>

      {assignmentRows && unresolvedRows.length > 0 && (
        <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Asociar empleados</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No se pudo asociar automáticamente a todos los empleados asignados. Selecciona el empleado correcto para cada asignación.
          </p>
          {candidateEmployees.length === 0 && (
            <p role="alert" style={{ color: '#b42318', marginBottom: '1rem' }}>
              No hay otros empleados identificados en las asignaciones de este encargo para resolver estas asociaciones.
            </p>
          )}
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {unresolvedRows.map((assignment) => (
              <label key={assignment.REF_PER} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(260px, 2fr)', gap: '0.8rem', alignItems: 'center' }}>
                <span>
                  Asignación {assignment.REF_PER ?? '(sin referencia)'}
                  {assignment.NOMBRE && ` — ${assignment.NOMBRE} ${assignment.APELLIDO1 || ''}`}
                </span>
                <select
                  value={manualSelections[String(assignment.REF_PER)] || ''}
                  onChange={(event) => handleSelectionChange(assignment.REF_PER, event.target.value)}
                  disabled={calculating || saving || candidateEmployees.length === 0}
                  style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                >
                  <option value="">Selecciona un empleado asignado</option>
                  {candidateEmployees.map((employee) => {
                    const employeeId = String(employee.REF_PER);
                    const selectedForThis = manualSelections[String(assignment.REF_PER)] === employeeId;
                    const alreadyMapped = mappedEmployeeIds.has(employeeId) && !selectedForThis;
                    return (
                      <option key={employeeId} value={employeeId} disabled={alreadyMapped}>
                        {[employee.NOMBRE, employee.APELLIDO1, employee.APELLIDO2].filter(Boolean).join(' ')} — {employee.PERFIL}
                      </option>
                    );
                  })}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {result && !result.error && (
        <>
          <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>
                  Encargo {selectedAssignment?.CODIGOPR} — {selectedAssignment?.NOMBRE}
                </h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  {String(result.month).padStart(2, '0')}/{result.year}
                </p>
              </div>
              {!isReadOnly && (
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  <Save size={17} />
                  {saving ? 'Guardando…' : 'Guardar planificación'}
                </button>
              )}
            </div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Users size={18} /> Horas por empleado
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    {['Empleado', 'Perfil', '% asignación', 'Días laborables', 'Vacaciones descontadas', 'Horas planificadas'].map((heading) => (
                      <th key={heading} style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.employees.map((employee) => (
                    <tr key={employee.refPer}>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{employee.name}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{employee.perfil}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{employee.porcentaje}%</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{employee.workingDays}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{employee.vacationDays}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{formatHours(employee.horas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Total de horas por perfil</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    {['Perfil', 'Empleados', 'Horas planificadas'].map((heading) => (
                      <th key={heading} style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.profiles.map((profile) => (
                    <tr key={normalize(profile.perfil)}>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{profile.perfil}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{profile.empleados}</td>
                      <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{formatHours(profile.horas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
        </>
      )}

      {activeTab === 'consultation' && (
        <>
          <section className="glass-card" style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem', maxWidth: '600px', fontWeight: 600 }}>
              Proyecto activo
              <select
                value={consultationCode}
                onChange={(event) => {
                  setConsultationCode(event.target.value);
                  setConsultationMonth(currentMonth);
                }}
                disabled={loading || consultationLoading}
                style={{ padding: '0.65rem', border: '1px solid var(--border-card)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
              >
                <option value="">{loading ? 'Cargando proyectos…' : 'Selecciona un proyecto activo'}</option>
                {activeProjects.map((project) => (
                  <option key={project.CODIGOPR} value={String(project.CODIGOPR)}>
                    {project.CODIGOPR} — {project.NOMBRE}
                  </option>
                ))}
              </select>
            </label>
            {!loading && !dataErrorMessage && activeProjects.length === 0 && (
              <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>
                No hay proyectos activos disponibles.
              </p>
            )}
          </section>

          {consultationError && (
            <div role="alert" className="glass-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem', color: '#b42318' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{consultationError}</span>
            </div>
          )}

          {consultationCode && (
            <section className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>
                    {consultationProject?.CODIGOPR} — {consultationProject?.NOMBRE}
                  </h3>
                  <p style={{ color: 'var(--text-muted)' }}>Resumen mensual de horas planificadas por perfil</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setConsultationMonth(previousPlanningMonth)}
                    disabled={!previousPlanningMonth || consultationLoading}
                    aria-label="Ver mes anterior con planificación"
                  >
                    <ChevronLeft size={18} /> Anterior
                  </button>
                  <strong style={{ minWidth: '140px', textAlign: 'center', textTransform: 'capitalize' }}>
                    {new Date(`${consultationMonth}-01T00:00:00`).toLocaleDateString('es-ES', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setConsultationMonth(nextPlanningMonth)}
                    disabled={!nextPlanningMonth || consultationLoading}
                    aria-label="Ver mes siguiente con planificación"
                  >
                    Siguiente <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {consultationLoading ? (
                <p style={{ color: 'var(--text-muted)' }}>Cargando planificación guardada…</p>
              ) : consultationRows.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>
                  No hay planificación guardada para este proyecto en este mes.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        {['Perfil', 'Horas planificadas'].map((heading) => (
                          <th key={heading} style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {consultationRows.map((row) => (
                        <tr key={row.PERFIL}>
                          <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{row.PERFIL}</td>
                          <td style={{ padding: '0.7rem', borderBottom: '1px solid var(--border-card)' }}>{formatHours(Number(row.HORAS))}</td>
                        </tr>
                      ))}
                      <tr>
                        <th style={{ padding: '0.7rem', borderTop: '2px solid var(--border-card)' }}>Total</th>
                        <th style={{ padding: '0.7rem', borderTop: '2px solid var(--border-card)' }}>{formatHours(consultationTotal)}</th>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default PlanificacionPage;
