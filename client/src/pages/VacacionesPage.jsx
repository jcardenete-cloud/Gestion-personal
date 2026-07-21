import React, { useEffect, useState, useRef, useMemo, createPortal } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Upload, Calendar, AlertTriangle, CheckCircle2, Trash2, Filter, 
    ArrowUp, ArrowDown, ArrowUpDown, Plus, Search, FileSpreadsheet, 
    Info, CalendarRange, Clock, AlertCircle, X, ChevronRight, Download, Edit
} from 'lucide-react';
import api from '../api';
import { normalizeString } from '../utils';
import * as XLSX from 'xlsx';
import { useAuth } from '../AuthContext';

const VacacionesPage = () => {
    const { isReadOnly } = useAuth();
    const canManage = !isReadOnly;
    const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'history', 'calendar', 'festivos'
    
    // Available today tab state
    const [availableTabVacations, setAvailableTabVacations] = useState([]);
    const [availableTabLoading, setAvailableTabLoading] = useState(false);
    const [availableSearchText, setAvailableSearchText] = useState('');
    const [allAssignments, setAllAssignments] = useState([]);
    const [availableProjectFilter, setAvailableProjectFilter] = useState('');

    // Master data
    const [nationalFestivos, setNationalFestivos] = useState(new Set());
    const [festivosByRef, setFestivosByRef] = useState({});
    // Festivos tab state
    const [festivosTabYear, setFestivosTabYear] = useState(new Date().getFullYear());
    const [festivosTabRefUbi, setFestivosTabRefUbi] = useState('');
    const [festivosList, setFestivosList] = useState([]);
    const [festivosLoading, setFestivosLoading] = useState(false);
    const [festivosForm, setFestivosForm] = useState({ fecha: '', descripcion: '', ref_ubi: '' });
    const [festivosEditingId, setFestivosEditingId] = useState(null);
    const [festivosCopyFromYear, setFestivosCopyFromYear] = useState(new Date().getFullYear() - 1);
    const [festivosCopyToYear, setFestivosCopyToYear] = useState(new Date().getFullYear());
    const [festivosCopyLoading, setFestivosCopyLoading] = useState(false);
    const [festivosSortConfig, setFestivosSortConfig] = useState({ key: 'FECHA', direction: 'asc' });
    const [personalList, setPersonalList] = useState([]);
    const [userMap, setUserMap] = useState({}); // clean_username -> employee
    const [locations, setLocations] = useState([]);
    
    // Excel upload state
    const [excelRows, setExcelRows] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    
    // Loaded vacations state (History tab)
    const [loadedVacaciones, setLoadedVacaciones] = useState([]);
    const [filesList, setFilesList] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // Filters and sorting
    const [projects, setProjects] = useState([]);
    // Multi-select filter: arrays of REF_PER (numbers)
    const [historyFilterUsers, setHistoryFilterUsers] = useState([]); // multi-select employees
    const [historyFilterFile, setHistoryFilterFile] = useState('');
    const [historyFilterYear, setHistoryFilterYear] = useState('');
    // History: search text for adding employees to filter
    const [historyUserSearch, setHistoryUserSearch] = useState('');
    const [historyUserSearchOpen, setHistoryUserSearchOpen] = useState(false);
    // Calendar multi-select employees
    const [calendarFilterUsers, setCalendarFilterUsers] = useState([]); // multi-select employees
    const [calendarFilterProject, setCalendarFilterProject] = useState('');
    const [projectAssignments, setProjectAssignments] = useState([]);
    const [calendarUserSearch, setCalendarUserSearch] = useState('');
    const [calendarUserSearchOpen, setCalendarUserSearchOpen] = useState(false);
    const [calendarProjectSearch, setCalendarProjectSearch] = useState('');
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear().toString());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarOnlyWithVacations, setCalendarOnlyWithVacations] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [sortConfig, setSortConfig] = useState({ key: 'FECHA_CARGA', direction: 'desc' });
    const [currentYearVacations, setCurrentYearVacations] = useState([]);
    const [noVacationsLoading, setNoVacationsLoading] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [editingVacationId, setEditingVacationId] = useState(null);
    const [editingVacationData, setEditingVacationData] = useState({
        DURACION: '',
        FECHA_DESDE: '',
        FECHA_HASTA: '',
        PARTICION_NUM: '',
        ORIGEN_FICHERO: ''
    });
    const currentYear = new Date().getFullYear().toString();
    
    // Ref for file input
    const fileInputRef = useRef(null);
    const historyUserInputRef = useRef(null);
    const calendarUserInputRef = useRef(null);
    const calendarProjectInputRef = useRef(null);

    const FloatingSuggestionList = ({ open, anchorRef, children, maxHeight = '220px' }) => {
        const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

        useEffect(() => {
            if (!open || !anchorRef?.current || typeof window === 'undefined') return;

            const updatePosition = () => {
                const rect = anchorRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }, [open, anchorRef]);

        if (!open || typeof document === 'undefined') return null;

        return createPortal(
            <div
                style={{
                    position: 'fixed',
                    top: position.top,
                    left: position.left,
                    width: position.width,
                    zIndex: 2147483647,
                    background: '#ffffff',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    borderRadius: '8px',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.35)',
                    maxHeight,
                    overflowY: 'auto',
                    marginTop: '2px',
                    opacity: 1,
                    isolation: 'isolate',
                    pointerEvents: 'auto'
                }}
            >
                {children}
            </div>,
            document.body
        );
    };

    // Initial Load
    const loadMasterData = async () => {
        try {
            const [resPersonal, resUbicacion, resEncargos] = await Promise.all([
                api.getPersonal(),
                api.getUbicacion(),
                api.getEncargos()
            ]);
            setPersonalList(resPersonal.data);
            setLocations(resUbicacion.data);
            setProjects(resEncargos.data);
            
            // Build username mapping
            const map = {};
            resPersonal.data.forEach(p => {
                if (p.USUARIO) {
                    const cleanDbUser = p.USUARIO.split('@')[0].trim().toLowerCase();
                    map[cleanDbUser] = p;
                }
            });
            setUserMap(map);
        } catch (err) {
            console.error("Error loading master data:", err);
        }
    };

    const loadHistory = async ({ projectFilter = '', refPer = '', year = '' } = {}) => {
        const isCalendarTab = activeTab === 'calendar';
        if (isCalendarTab) {
            setCalendarLoading(true);
        } else {
            setHistoryLoading(true);
        }
        try {
            const [resVacaciones, resFicheros] = await Promise.all([
                api.getVacaciones(refPer || null, year || null, null, projectFilter),
                api.getVacacionesFicheros()
            ]);
            setLoadedVacaciones(resVacaciones.data);
            setFilesList(resFicheros.data);
        } catch (err) {
            console.error("Error loading vacations history:", err);
        } finally {
            setHistoryLoading(false);
            setCalendarLoading(false);
        }
    };

    const loadNoVacations = async () => {
        setNoVacationsLoading(true);
        try {
            const res = await api.getVacaciones(null, currentYear);
            setCurrentYearVacations(res.data);
        } catch (err) {
            console.error("Error loading current year vacations:", err);
        } finally {
            setNoVacationsLoading(false);
        }
    };

    const loadAvailableToday = async () => {
        setAvailableTabLoading(true);
        try {
            const [resVacaciones, resAssignments] = await Promise.all([
                api.getVacaciones(null, currentYear),
                api.getAssignments()
            ]);
            setAvailableTabVacations(resVacaciones.data || []);
            setAllAssignments(resAssignments.data || []);
        } catch (err) {
            console.error("Error loading vacations and assignments for availability:", err);
        } finally {
            setAvailableTabLoading(false);
        }
    };

    const loadFestivosForCalendar = async (year) => {
        try {
            const res = await api.getFestivos(year, null);
            const national = new Set();
            const byRef = {};
            (res.data || []).forEach(f => {
                const dateStr = (f.FECHA || f.fecha || '').split('T')[0];
                if (!dateStr) return;
                if (f.REF_UBI === null || f.REF_UBI === undefined || f.REF_UBI === '') {
                    national.add(dateStr);
                } else {
                    if (!byRef[f.REF_UBI]) byRef[f.REF_UBI] = new Set();
                    byRef[f.REF_UBI].add(dateStr);
                }
            });
            setNationalFestivos(national);
            setFestivosByRef(byRef);
        } catch (err) {
            console.error('Error loading festivos for calendar:', err);
        }
    };

    const loadFestivosTab = async () => {
        setFestivosLoading(true);
        try {
            const res = await api.getFestivos(festivosTabYear, festivosTabRefUbi || null);
            setFestivosList(res.data || []);
        } catch (err) {
            console.error('Error loading festivos tab', err);
            setFestivosList([]);
        } finally {
            setFestivosLoading(false);
        }
    };

    const handleFestivoSave = async () => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        if (!festivosForm.fecha) { alert('Seleccione una fecha'); return; }
        try {
            const payload = {
                year: Number(festivosTabYear),
                ref_ubi: festivosForm.ref_ubi || null,
                fecha: festivosForm.fecha,
                descripcion: festivosForm.descripcion
            };
            if (festivosEditingId) {
                await api.updateFestivo({ id_festivo: festivosEditingId, ...payload });
                setFestivosEditingId(null);
            } else {
                await api.createFestivo(payload);
            }
            setFestivosForm({ fecha: '', descripcion: '', ref_ubi: '' });
            loadFestivosTab();
            if (String(festivosTabYear) === String(calendarYear)) {
                loadFestivosForCalendar(calendarYear);
            }
        } catch (err) {
            console.error('Error saving festivo', err);
            alert('Error al guardar festivo');
        }
    };

    const handleFestivoCopy = async () => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        if (festivosCopyFromYear === festivosCopyToYear) {
            alert('El año origen y destino no pueden ser iguales');
            return;
        }
        if (!window.confirm(`¿Copiar todos los festivos de ${festivosCopyFromYear} a ${festivosCopyToYear}?`)) {
            return;
        }
        setFestivosCopyLoading(true);
        try {
            const res = await api.getFestivos(festivosCopyFromYear, null);
            const festivos = res.data || [];
            if (festivos.length === 0) {
                alert(`No hay festivos en el año ${festivosCopyFromYear}`);
                setFestivosCopyLoading(false);
                return;
            }
            let copiados = 0;
            for (const f of festivos) {
                const oldDateStr = (f.FECHA || f.fecha || '').split('T')[0];
                if (!oldDateStr) continue;
                const [year, month, day] = oldDateStr.split('-');
                const newDateStr = `${festivosCopyToYear}-${month}-${day}`;
                try {
                    await api.createFestivo({
                        year: festivosCopyToYear,
                        ref_ubi: f.REF_UBI || null,
                        fecha: newDateStr,
                        descripcion: f.DESCRIPCION || f.descripcion || ''
                    });
                    copiados++;
                } catch (e) {
                    console.error('Error copying festivo:', e);
                }
            }
            alert(`Se copiaron ${copiados} festivos a ${festivosCopyToYear}`);
            setFestivosTabYear(festivosCopyToYear);
            loadFestivosTab();
            if (String(festivosCopyToYear) === String(calendarYear)) {
                loadFestivosForCalendar(calendarYear);
            }
        } catch (err) {
            console.error('Error copying festivos:', err);
            alert('Error al copiar festivos');
        } finally {
            setFestivosCopyLoading(false);
        }
    };

    const handleFestivoEdit = (item) => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        setFestivosEditingId(item.ID_FESTIVO || item.id_festivo);
        setFestivosForm({
            fecha: (item.FECHA || item.fecha || '').split('T')[0],
            descripcion: item.DESCRIPCION || item.descripcion || '',
            ref_ubi: item.REF_UBI != null ? String(item.REF_UBI) : ''
        });
    };

    const handleFestivoDelete = async (id) => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        if (!window.confirm('¿Eliminar este festivo?')) return;
        try {
            await api.deleteFestivo(id);
            loadFestivosTab();
            loadFestivosForCalendar(calendarYear);
        } catch (err) {
            console.error('Error deleting festivo', err);
            alert('Error al eliminar');
        }
    };

    const handleFestivosSort = (key) => {
        let direction = 'asc';
        if (festivosSortConfig && festivosSortConfig.key === key && festivosSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setFestivosSortConfig({ key, direction });
    };

    const sortedFestivos = useMemo(() => {
        if (!festivosList) return [];
        let sortableItems = [...festivosList];
        if (festivosSortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[festivosSortConfig.key] || a[festivosSortConfig.key.toLowerCase()] || '';
                let bValue = b[festivosSortConfig.key] || b[festivosSortConfig.key.toLowerCase()] || '';
                
                if (festivosSortConfig.key === 'REF_UBI') {
                    aValue = a.REF_UBI != null ? (locations.find(u => String(u.REF_UBI) === String(a.REF_UBI))?.A_LUGAR || a.REF_UBI) : 'Nacional';
                    bValue = b.REF_UBI != null ? (locations.find(u => String(u.REF_UBI) === String(b.REF_UBI))?.A_LUGAR || b.REF_UBI) : 'Nacional';
                }

                if (aValue < bValue) return festivosSortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return festivosSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [festivosList, festivosSortConfig, locations]);

    // Export calendar view to Excel with colors
    const handleExportCalendar = async () => {
        if (calendarEmployees.length === 0) {
            alert('No hay empleados para exportar con los filtros actuales.');
            return;
        }
        try {
            // Dynamic import to keep initial bundle small
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Gestión Personal';
            workbook.created = new Date();
            const ws = workbook.addWorksheet('Calendario Vacaciones', {
                views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }]
            });

            const allDays = calendarMonths.flatMap(m => m.days);

            // Column widths
            ws.getColumn(1).width = 30;
            // Widths for up to 6 partitions (18 columns total: Días, Desde, Hasta per partition)
            for (let p = 1; p <= 6; p++) {
                const baseCol = 2 + (p - 1) * 3;
                ws.getColumn(baseCol).width = 6.0;      // Días
                ws.getColumn(baseCol + 1).width = 11.0;  // Desde
                ws.getColumn(baseCol + 2).width = 11.0;  // Hasta
            }
            // Widths for calendar days (starting at col 20)
            for (let i = 20; i <= allDays.length + 19; i++) {
                ws.getColumn(i).width = 3.0;
            }

            // Shared styles helpers
            const mkFill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
            const hairBorder = { style: 'hair', color: { argb: 'FFD1D5DB' } };
            const thinBorder = { style: 'thin', color: { argb: 'FF94A3B8' } };

            // === ROW 1: Month headers ===
            const monthRow = ws.getRow(1);
            monthRow.height = 16;
            const nameHeader = monthRow.getCell(1);
            nameHeader.value = 'Empleado';
            nameHeader.style = {
                font: { bold: true, size: 9, color: { argb: 'FF1E293B' } },
                fill: mkFill('FFE2E8F0'),
                alignment: { vertical: 'middle', horizontal: 'center' },
                border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
            };

            let colOffset = 2;

            // Add partition headers in ROW 1
            for (let p = 1; p <= 6; p++) {
                const startCol = colOffset;
                const endCol = colOffset + 2; // Merge 3 cells (Días, Desde, Hasta)
                ws.mergeCells(1, startCol, 1, endCol);
                
                // Style all cells in the merged range to guarantee borders are visible
                for (let col = startCol; col <= endCol; col++) {
                    const cell = monthRow.getCell(col);
                    cell.style = {
                        font: { bold: true, size: 9, color: { argb: 'FF1E293B' } },
                        fill: mkFill('FFE2E8F0'),
                        alignment: { vertical: 'middle', horizontal: 'center' },
                        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                    };
                }
                const pCell = monthRow.getCell(startCol);
                pCell.value = `Partición ${p}`;
                colOffset += 3;
            }

            for (const month of calendarMonths) {
                const startCol = colOffset;
                const endCol = colOffset + month.days.length - 1;
                if (month.days.length > 1) {
                    ws.mergeCells(1, startCol, 1, endCol);
                }
                const monthLabel = new Date(Number(month.monthYear), month.monthIndex, 1)
                    .toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                
                // Style all cells in the merged range
                for (let col = startCol; col <= endCol; col++) {
                    const cell = monthRow.getCell(col);
                    cell.style = {
                        font: { bold: true, size: 9, color: { argb: 'FF1E293B' } },
                        fill: mkFill('FFE2E8F0'),
                        alignment: { vertical: 'middle', horizontal: 'center' },
                        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                    };
                }
                const mCell = monthRow.getCell(startCol);
                mCell.value = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
                colOffset += month.days.length;
            }

            // === ROW 2: Day numbers ===
            const dayRow = ws.getRow(2);
            dayRow.height = 13;
            dayRow.getCell(1).style = { 
                fill: mkFill('FFE2E8F0'), 
                border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder } 
            };

            colOffset = 2;

            // Add Días/Desde/Hasta in ROW 2
            for (let p = 1; p <= 6; p++) {
                const cDias = dayRow.getCell(colOffset);
                cDias.value = 'Días';
                cDias.style = {
                    font: { bold: true, size: 8, color: { argb: 'FF1E293B' } },
                    fill: mkFill('FFF1F5F9'),
                    alignment: { vertical: 'middle', horizontal: 'center' },
                    border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                };
                colOffset++;

                const cDesde = dayRow.getCell(colOffset);
                cDesde.value = 'Desde';
                cDesde.style = {
                    font: { bold: true, size: 8, color: { argb: 'FF1E293B' } },
                    fill: mkFill('FFF1F5F9'),
                    alignment: { vertical: 'middle', horizontal: 'center' },
                    border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                };
                colOffset++;

                const cHasta = dayRow.getCell(colOffset);
                cHasta.value = 'Hasta';
                cHasta.style = {
                    font: { bold: true, size: 8, color: { argb: 'FF1E293B' } },
                    fill: mkFill('FFF1F5F9'),
                    alignment: { vertical: 'middle', horizontal: 'center' },
                    border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                };
                colOffset++;
            }

            for (const month of calendarMonths) {
                for (const day of month.days) {
                    const isWE = [0, 6].includes(day.weekday);
                    const dCell = dayRow.getCell(colOffset);
                    dCell.value = day.number;
                    dCell.style = {
                        font: { bold: true, size: 7, color: { argb: isWE ? 'FFEF4444' : 'FF64748B' } },
                        fill: mkFill(isWE ? 'FFFCE8E8' : 'FFF1F5F9'),
                        alignment: { vertical: 'middle', horizontal: 'center' },
                        border: { top: thinBorder, bottom: thinBorder, left: { style: 'hair', color: { argb: 'FFD1D5DB' } }, right: { style: 'hair', color: { argb: 'FFD1D5DB' } } }
                    };
                    colOffset++;
                }
            }

            // === ROWS 3+: Employees ===
            calendarEmployees.forEach((person, rowIdx) => {
                const row = ws.getRow(rowIdx + 3);
                row.height = 13;

                const nameCell = row.getCell(1);
                nameCell.value = `${person.APELLIDO1 || ''} ${person.APELLIDO2 || ''}, ${person.NOMBRE || ''}`.trim();
                nameCell.style = {
                    font: { bold: false, size: 8, color: { argb: 'FF1E293B' } },
                    fill: mkFill(rowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'),
                    alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
                    border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                };

                const vacations = calendarVacationsByPerson[person.REF_PER] || [];
                const personFestivos = person.REF_UBI != null
                    ? new Set([...nationalFestivos, ...(festivosByRef[person.REF_UBI] || [])])
                    : nationalFestivos;

                colOffset = 2;

                // Append partitions first
                const sortedVacations = [...vacations].sort((a, b) => {
                    const d1 = new Date(a.FECHA_DESDE);
                    const d2 = new Date(b.FECHA_DESDE);
                    return d1 - d2;
                });

                const rowBgArgb = rowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

                for (let p = 0; p < 6; p++) {
                    const vac = sortedVacations[p];
                    const cDias = row.getCell(colOffset);
                    const cDesde = row.getCell(colOffset + 1);
                    const cHasta = row.getCell(colOffset + 2);

                    if (vac) {
                        cDias.value = vac.DURACION != null ? Number(vac.DURACION) : '';
                        cDesde.value = formatDateStr(vac.FECHA_DESDE);
                        cHasta.value = formatDateStr(vac.FECHA_HASTA);
                    } else {
                        cDias.value = '';
                        cDesde.value = '';
                        cHasta.value = '';
                    }

                    cDias.style = {
                        font: { size: 8, color: { argb: 'FF1E293B' } },
                        fill: mkFill(rowBgArgb),
                        alignment: { vertical: 'middle', horizontal: 'center' },
                        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                    };
                    cDesde.style = {
                        font: { size: 8, color: { argb: 'FF1E293B' } },
                        fill: mkFill(rowBgArgb),
                        alignment: { vertical: 'middle', horizontal: 'center' },
                        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                    };
                    cHasta.style = {
                        font: { size: 8, color: { argb: 'FF1E293B' } },
                        fill: mkFill(rowBgArgb),
                        alignment: { vertical: 'middle', horizontal: 'center' },
                        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
                    };
                    colOffset += 3;
                }

                // Calendar days
                for (const month of calendarMonths) {
                    for (const day of month.days) {
                        const isWeekend = [0, 6].includes(day.weekday);
                        const isVacation = vacations.some(v => isDateInRange(day.iso, v.FECHA_DESDE, v.FECHA_HASTA));
                        const isHoliday = personFestivos.has(day.iso) && !isWeekend;

                        let isBridge = false;
                        if (!isWeekend && !isHoliday) {
                            if (day.weekday === 1) {
                                const tue = new Date(day.iso); tue.setDate(tue.getDate() + 1);
                                isBridge = personFestivos.has(tue.toISOString().split('T')[0]);
                            }
                            if (day.weekday === 5) {
                                const thu = new Date(day.iso); thu.setDate(thu.getDate() - 1);
                                isBridge = personFestivos.has(thu.toISOString().split('T')[0]);
                            }
                        }

                        let bgArgb;
                        if (isWeekend)        bgArgb = 'FFFCE8E8'; // rojo claro
                        else if (isHoliday)   bgArgb = 'FFD4EBFD'; // azul claro
                        else if (isBridge)    bgArgb = 'FFE8E3FE'; // lila claro
                        else if (isVacation)  bgArgb = 'FFBBF7D0'; // verde claro
                        else                  bgArgb = rowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

                        const cell = row.getCell(colOffset);
                        cell.value = '';
                        cell.style = {
                            fill: mkFill(bgArgb),
                            border: { top: thinBorder, bottom: thinBorder, left: { style: 'hair', color: { argb: 'FFD1D5DB' } }, right: { style: 'hair', color: { argb: 'FFD1D5DB' } } }
                        };
                        colOffset++;
                    }
                }
            });

            // === Legend sheet ===
            const legendWs = workbook.addWorksheet('Leyenda');
            legendWs.getColumn(1).width = 28;
            legendWs.getColumn(2).width = 16;
            [
                { label: 'Tipo de día', argb: null, header: true },
                { label: 'Día de vacaciones', argb: 'FFBBF7D0' },
                { label: 'Día festivo entre semana', argb: 'FFD4EBFD' },
                { label: 'Puente', argb: 'FFE8E3FE' },
                { label: 'Fin de semana', argb: 'FFFCE8E8' },
                { label: 'Día laboral', argb: 'FFFFFFFF' },
            ].forEach((item, i) => {
                const lr = legendWs.getRow(i + 1);
                lr.height = 20;
                lr.getCell(1).value = item.label;
                lr.getCell(1).font = { bold: !!item.header, size: 10 };
                if (!item.header) {
                    lr.getCell(2).fill = mkFill(item.argb);
                    lr.getCell(2).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                }
            });

            // Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const mNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
            a.download = `calendario_vacaciones_${mNames[calendarMonth]}_${calendarYear}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error al exportar calendario:', err);
            alert('Error al generar el Excel: ' + err.message);
        }
    };

    useEffect(() => {
        loadMasterData();
        loadHistory();
        loadFestivosForCalendar(calendarYear);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab === 'calendar') {
            // Load all for selected year/project; employee multi-filter is applied client-side
            loadHistory({ projectFilter: calendarFilterProject, year: calendarYear });
        }
    }, [activeTab, calendarFilterProject, calendarYear]);

    useEffect(() => {
        loadFestivosForCalendar(calendarYear);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calendarYear]);

    useEffect(() => {
        if (activeTab === 'festivos') {
            loadFestivosTab();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, festivosTabYear, festivosTabRefUbi]);

    // Load assignments when a project filter is selected (calendar tab)
    useEffect(() => {
        let cancelled = false;
        const loadAssignments = async () => {
            if (!calendarFilterProject) {
                setProjectAssignments([]);
                return;
            }
            try {
                const res = await api.getAssignments(calendarFilterProject);
                if (!cancelled) setProjectAssignments(res.data || []);
            } catch (err) {
                console.error('Error loading project assignments:', err);
                if (!cancelled) setProjectAssignments([]);
            }
        };
        loadAssignments();
        return () => { cancelled = true; };
    }, [calendarFilterProject]);

    // Helper: add a person to a multi-select filter array (no duplicates)
    const addPersonToFilter = (refPer, setter) => {
        setter(prev => prev.includes(refPer) ? prev : [...prev, refPer]);
    };

    // Helper: remove a person from a multi-select filter array
    const removePersonFromFilter = (refPer, setter) => {
        setter(prev => prev.filter(r => r !== refPer));
    };

    // Helper: get employees from an encargo and add all to filter
    const addEncargoPeopleToFilter = async (codigopr, setter) => {
        if (!codigopr) return;
        try {
            const res = await api.getAssignments(codigopr);
            const refs = (res.data || []).map(a => a.REF_PER).filter(Boolean);
            setter(prev => {
                const set = new Set(prev);
                refs.forEach(r => set.add(r));
                return Array.from(set);
            });
        } catch (err) {
            console.error('Error loading encargo assignments:', err);
        }
    };

    // Filtered (only active) and sorted personal list for dropdowns
    const activePersonalList = useMemo(() => {
        return personalList
            .filter(p => p.ACTIVO === 'S')
            .sort((a, b) => {
                const a1 = (a.APELLIDO1 || '').toLowerCase();
                const b1 = (b.APELLIDO1 || '').toLowerCase();
                if (a1 !== b1) return a1.localeCompare(b1);
                const a2 = (a.APELLIDO2 || '').toLowerCase();
                const b2 = (b.APELLIDO2 || '').toLowerCase();
                if (a2 !== b2) return a2.localeCompare(b2);
                const an = (a.NOMBRE || '').toLowerCase();
                const bn = (b.NOMBRE || '').toLowerCase();
                return an.localeCompare(bn);
            });
    }, [personalList]);

    // Clean username helper
    const cleanUsername = (str) => {
        if (!str) return '';
        return String(str).split('@')[0].trim().toLowerCase();
    };

    // Format YYYY-MM-DD date string to DD/MM/YYYY
    const formatDateStr = (dateStr) => {
        if (!dateStr) return '-';
        const cleanDate = String(dateStr).split('T')[0];
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const getMonthDays = (year, month) => {
        const days = [];
        const totalDays = new Date(Number(year), month + 1, 0).getDate();
        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`);
            days.push({
                number: d,
                weekday: dateObj.getDay(),
                iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            });
        }
        return days;
    };

    const normalizeVacationDate = (dateStr) => {
        if (!dateStr) return null;
        const clean = String(dateStr).split('T')[0];
        return new Date(`${clean}T00:00:00`);
    };

    const isDateInRange = (dateKey, from, to) => {
        const date = normalizeVacationDate(dateKey);
        const start = normalizeVacationDate(from);
        const end = normalizeVacationDate(to);
        if (!date || !start || !end) return false;
        return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
    };

    const calendarMonths = useMemo(() => {
        const months = [];
        for (let offset = 0; offset < 3; offset++) {
            const monthIndex = (Number(calendarMonth) + offset) % 12;
            const yearOffset = Math.floor((Number(calendarMonth) + offset) / 12);
            const monthYear = String(Number(calendarYear) + yearOffset);
            months.push({
                monthIndex,
                monthYear,
                days: getMonthDays(monthYear, monthIndex)
            });
        }
        return months;
    }, [calendarYear, calendarMonth]);

    const calendarDays = useMemo(() => calendarMonths.flatMap(m => m.days), [calendarMonths]);

    const calendarEmployees = useMemo(() => {
        let list = activePersonalList;
        // If project filter is set, limit to persons assigned to that project
        if (calendarFilterProject) {
            const assignedRefs = new Set((projectAssignments || []).map(a => a.REF_PER));
            list = list.filter(person => assignedRefs.has(person.REF_PER));
        }
        // If checkbox enabled, keep only employees that have vacations loaded for the selected year
        if (calendarOnlyWithVacations) {
            const refsWithVac = new Set((loadedVacaciones || []).map(v => v.REF_PER));
            list = list.filter(person => refsWithVac.has(person.REF_PER));
        }
        // Multi-select employee filter
        if (calendarFilterUsers.length > 0) {
            const selectedSet = new Set(calendarFilterUsers);
            return list.filter(person => selectedSet.has(person.REF_PER));
        }
        return list;
    }, [activePersonalList, calendarFilterUsers, calendarFilterProject, projectAssignments, calendarOnlyWithVacations, loadedVacaciones]);

    const calendarVacationsByPerson = useMemo(() => {
        const grouped = {};
        const filtered = calendarFilterUsers.length > 0
            ? loadedVacaciones.filter(item => calendarFilterUsers.includes(item.REF_PER))
            : loadedVacaciones;
        filtered.forEach(item => {
            const refPer = item.REF_PER;
            if (!grouped[refPer]) grouped[refPer] = [];
            grouped[refPer].push(item);
        });
        return grouped;
    }, [loadedVacaciones, calendarFilterUsers]);

    const selectedMonthLabel = useMemo(() => {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${monthNames[calendarMonth]} ${calendarYear}`;
    }, [calendarMonth, calendarYear]);

    // Helper: Map ref_ubi to city name
    const getLocationCity = (refUbi) => {
        if ([1, 2, 5, 8, 9, 10, 14].includes(refUbi)) return 'sevilla';
        if (refUbi === 7) return 'huelva';
        if (refUbi === 11) return 'merida';
        if (refUbi === 18) return 'malaga';
        return null;
    };

    // Helper: Get Spanish holidays for a city in a given year as Set of ISO dates
    const getHolidaysByCity = (city, year) => {
        const holidays = [];
        const yearNum = Number(year);

        // National holidays (all cities)
        holidays.push(`${year}-01-01`, `${year}-01-06`, `${year}-05-01`, `${year}-08-15`, `${year}-10-12`, `${year}-11-01`, `${year}-12-25`);

        // Easter (Viernes Santo = Good Friday, Lunes de Pascua = Easter Monday)
        // For 2026: Viernes Santo = 10-04, Lunes de Pascua = 13-04
        if (yearNum === 2026) {
            holidays.push('2026-04-10', '2026-04-13');
        } else if (yearNum === 2025) {
            holidays.push('2025-04-18', '2025-04-21');
        } else if (yearNum === 2027) {
            holidays.push('2027-04-02', '2027-04-05');
        }

        // Local holidays by city (examples)
        if (city === 'sevilla') {
            // Corpus Christi varies; for 2026 = 28-05
            holidays.push(`${year}-02-28`); // Example local holiday
        } else if (city === 'huelva') {
            // Additional local holidays for Huelva if any
        } else if (city === 'merida') {
            // Additional local holidays for Mérida if any
        } else if (city === 'malaga') {
            // Additional local holidays for Málaga if any
        }

        return new Set(holidays);
    };

    // Date parser helper for Excel cell values
    const parseExcelDateJS = (val) => {
        if (!val) return null;
        
        let dateObj = null;
        if (val instanceof Date) {
            dateObj = val;
        } else if (typeof val === 'number') {
            try {
                dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
            } catch(e) {
                return null;
            }
        }
        
        if (dateObj) {
            try {
                // Evitamos desfases de zona horaria (que pueden restar un día al convertir a ISO en UTC)
                // sumando 12 horas para asegurar que caiga siempre en el centro del día correcto.
                const adjustedDate = new Date(dateObj.getTime() + 12 * 60 * 60 * 1000);
                return adjustedDate.toISOString().split('T')[0];
            } catch(e) {
                return null;
            }
        }
        const valStr = String(val).trim();
        if (!valStr) return null;
        
        // ISO datetime (e.g., 2026-07-13T22:00:44.000Z)
        if (valStr.includes('T')) {
            const isoDate = valStr.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
        }
        
        // YYYY-MM-DD HH:MM:SS
        if (valStr.includes(' ')) {
            const part = valStr.split(' ')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
        }
        
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(valStr)) {
            return valStr;
        }
        
        // DD/MM/YYYY or DD-MM-YYYY
        let m = valStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
        if (m) {
            let [_, d, month, y] = m;
            if (y.length === 3 && y.startsWith('20')) {
                y = '2026';
            } else if (y.length === 2) {
                y = '20' + y;
            }
            return `${y.padStart(4, '0')}-${month.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        // Typo: DD/MMYYYY (like 30/072026)
        m = valStr.match(/^(\d{1,2})\/(\d{1,2})(\d{4})$/);
        if (m) {
            let [_, d, month, y] = m;
            return `${y}-${month.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        // Typo: DD/MM/YY typo (like 21/08/206 where it has 3 digits)
        m = valStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d+)$/);
        if (m) {
            let [_, d, month, y] = m;
            if (y === '206') {
                y = '2026';
            } else if (y.length === 1) {
                y = '202' + y;
            } else if (y.length === 2) {
                y = '20' + y;
            }
            return `${y.padStart(4, '0')}-${month.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        return valStr;
    };

    // Excel Parsing Handler
    // Excel Parsing Handler
    const handleFile = (file) => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Detect header row (containing 'usuario')
                let headerRow = 0;
                for (let i = 0; i < Math.min(25, jsonData.length); i++) {
                    const row = jsonData[i];
                    if (!row) continue;
                    for (let cell of row) {
                        if (String(cell).trim().toLowerCase() === 'usuario') {
                            headerRow = i;
                            break;
                        }
                    }
                    if (headerRow) break;
                }
                // Build column index map based on header row
                const header = jsonData[headerRow] || [];
                const usuarioIdx = header.findIndex(c => String(c).trim().toLowerCase() === 'usuario');
                if (usuarioIdx === -1) {
                    alert('No se encontró la columna "Usuario" en el archivo.');
                    return;
                }
                // Offset to the first 'Días Laborables' column (G) which is 5 columns after 'Usuario'
                const baseIdx = usuarioIdx + 5;

                const rows = [];
                for (let idx = headerRow + 1; idx < jsonData.length; idx++) {
                    const rowData = jsonData[idx];
                    if (!rowData) continue;

                    const excelUser = String(rowData[usuarioIdx] || '').trim();
                    if (!excelUser || ['nan', 'usuario', 'personal', ''].includes(excelUser.toLowerCase())) continue;

                    const cleanUser = cleanUsername(excelUser);
                    const matchedEmp = userMap[cleanUser];

                    for (let p = 0; p < 6; p++) {
                        const daysIdx = baseIdx + p * 3;
                        const desdeIdx = baseIdx + p * 3 + 1;
                        const hastaIdx = baseIdx + p * 3 + 2;

                        const daysVal = rowData[daysIdx];
                        const desdeVal = rowData[desdeIdx];
                        const hastaVal = rowData[hastaIdx];

                        if (desdeVal === undefined && hastaVal === undefined) continue;

                        const parsedDesde = parseExcelDateJS(desdeVal);
                        const parsedHasta = parseExcelDateJS(hastaVal);

                        let days = null;
                        if (daysVal !== undefined && daysVal !== null) {
                            days = parseFloat(daysVal);
                            if (isNaN(days)) {
                                days = typeof daysVal === 'object' ? String(daysVal.v || JSON.stringify(daysVal)) : String(daysVal);
                            }
                        }

                        let status = 'valid';
                        let statusText = 'Listo';
                        let refPer = matchedEmp ? matchedEmp.REF_PER : null;

                        if (!matchedEmp) {
                            status = 'error_user';
                            statusText = 'Usuario no encontrado';
                        } else if (!parsedDesde || !parsedHasta) {
                            status = 'error_dates';
                            statusText = 'Fechas inválidas';
                        }

                        rows.push({
                            id: `${idx}_${p}`,
                            excelRow: idx + 1,
                            excelUser,
                            employee: matchedEmp || null,
                            refPer,
                            partition: p + 1,
                            days,
                            desde: parsedDesde,
                            hasta: parsedHasta,
                            desdeRaw: (desdeVal instanceof Date) ? (isNaN(desdeVal.getTime()) ? 'Fecha inválida' : desdeVal.toLocaleDateString()) : String(desdeVal || ''),
                            hastaRaw: (hastaVal instanceof Date) ? (isNaN(hastaVal.getTime()) ? 'Fecha inválida' : hastaVal.toLocaleDateString()) : String(hastaVal || ''),
                            status,
                            statusText
                        });
                    }
                }

                setExcelRows(rows);
            } catch (err) {
                console.error('Error parsing excel:', err);
                alert('Error al leer el archivo Excel. Asegúrese de que es un archivo válido.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!canManage) return;
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    };

    const triggerFileSelect = () => {
        if (!canManage) return;
        fileInputRef.current?.click();
    };

    // Handle user manual remapping dropdown
    const handleRemapEmployee = (rowId, empId) => {
        const emp = personalList.find(p => p.REF_PER === parseInt(empId));
        setExcelRows(prev => prev.map(row => {
            if (row.id === rowId) {
                const newStatus = (!row.desde || !row.hasta) ? 'error_dates' : 'valid';
                const newStatusText = newStatus === 'valid' ? 'Listo' : 'Fechas inválidas';
                return {
                    ...row,
                    employee: emp,
                    refPer: emp ? emp.REF_PER : null,
                    status: emp ? newStatus : 'error_user',
                    statusText: emp ? newStatusText : 'Usuario no encontrado'
                };
            }
            return row;
        }));
    };

    // Save imported vacations to database
    const handleSaveImport = async () => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        const validRows = excelRows.filter(r => r.status === 'valid');
        if (validRows.length === 0) {
            alert("No hay registros válidos para importar.");
            return;
        }
        
        setImportLoading(true);
        try {
            const dataToInsert = validRows.map(r => ({
                ref_per: r.refPer,
                duracion: typeof r.days === 'number' ? r.days : null,
                fecha_desde: r.desde,
                fecha_hasta: r.hasta,
                particion_num: r.partition,
                origen_fichero: fileName
            }));
            
            const res = await api.importVacaciones(dataToInsert);
            alert(res.data.message || "Vacaciones cargadas con éxito");
            setExcelRows([]);
            setFileName('');
            loadHistory();
            setActiveTab('history');
        } catch (err) {
            console.error(err);
            alert("Error al importar las vacaciones: " + (err.response?.data?.error || err.message));
        } finally {
            setImportLoading(false);
        }
    };

    // Delete single vacation
    const handleDeleteVacacion = async (id) => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        if (!window.confirm("¿Seguro que desea eliminar este periodo de vacaciones?")) return;
        try {
            await api.deleteVacacion(id);
            loadHistory();
        } catch (err) {
            alert("Error al borrar: " + err.message);
        }
    };

    const startEditVacation = (item) => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        setEditingVacationId(item.ID_VACACION);
        setEditingVacationData({
            DURACION: item.DURACION ?? '',
            FECHA_DESDE: item.FECHA_DESDE ? item.FECHA_DESDE.split('T')[0] : '',
            FECHA_HASTA: item.FECHA_HASTA ? item.FECHA_HASTA.split('T')[0] : '',
            PARTICION_NUM: item.PARTICION_NUM ?? '',
            ORIGEN_FICHERO: item.ORIGEN_FICHERO || ''
        });
    };

    const cancelEditVacation = () => {
        setEditingVacationId(null);
        setEditingVacationData({
            DURACION: '',
            FECHA_DESDE: '',
            FECHA_HASTA: '',
            PARTICION_NUM: '',
            ORIGEN_FICHERO: ''
        });
    };

    const handleUpdateVacacion = async (id) => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        if (!id) return;
        setEditLoading(true);
        try {
            await api.updateVacacion(id, {
                duracion: editingVacationData.DURACION || null,
                fecha_desde: editingVacationData.FECHA_DESDE,
                fecha_hasta: editingVacationData.FECHA_HASTA,
                particion_num: editingVacationData.PARTICION_NUM || null,
                origen_fichero: editingVacationData.ORIGEN_FICHERO || null,
            });
            cancelEditVacation();
            loadHistory();
        } catch (err) {
            alert("Error al actualizar vacaciones: " + (err.response?.data?.error || err.message));
        } finally {
            setEditLoading(false);
        }
    };

    // Bulk delete vacations by imported file
    const handleDeleteByFile = async (filename) => {
        if (!canManage) {
            alert('No tienes permisos para modificar vacaciones.');
            return;
        }
        if (!filename) return;
        if (!window.confirm(`¿Seguro que desea eliminar TODAS las vacaciones importadas del fichero "${filename}"? Esta acción no se puede deshacer.`)) return;
        
        try {
            const res = await api.deleteVacacionesPorFichero(filename);
            alert(res.data.message || "Vacaciones eliminadas");
            if (historyFilterFile === filename) setHistoryFilterFile('');
            loadHistory();
        } catch (err) {
            alert("Error al eliminar importación: " + err.message);
        }
    };

    // Export history to Excel
    const handleExportHistory = () => {
        if (!sortedHistory || sortedHistory.length === 0) {
            alert('No hay datos para exportar con los filtros actuales.');
            return;
        }
        const rows = sortedHistory.map(item => ({
            'Empleado': `${item.APELLIDO1 || ''} ${item.APELLIDO2 || ''}, ${item.NOMBRE || ''}`.trim(),
            'Usuario': (item.USUARIO || '').split('@')[0],
            'Perfil': item.PERFIL || '',
            'Partición': item.PARTICION_NUM != null ? `P${item.PARTICION_NUM}` : '',
            'Días': item.DURACION ?? '',
            'Fecha Desde': item.FECHA_DESDE ? item.FECHA_DESDE.split('T')[0] : '',
            'Fecha Hasta': item.FECHA_HASTA ? item.FECHA_HASTA.split('T')[0] : '',
            'Archivo Origen': item.ORIGEN_FICHERO || '',
            'Fecha Carga': item.FECHA_CARGA ? item.FECHA_CARGA.split('T')[0] : ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vacaciones');
        const filters = [
            historyFilterYear && `año${historyFilterYear}`,
            historyFilterUsers.length > 0 && `emp${historyFilterUsers.length}`,
            historyFilterFile && historyFilterFile.replace(/\.[^/.]+$/, ''),
        ].filter(Boolean).join('_');
        const filename = `vacaciones${filters ? '_' + filters : ''}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // Sorting helper for history table
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter and Sort History Data
    const activeProjects = useMemo(() => {
        return [...projects].sort((a, b) => {
            const aCode = String(a.CODIGOPR || '').toLowerCase();
            const bCode = String(b.CODIGOPR || '').toLowerCase();
            if (aCode !== bCode) return aCode.localeCompare(bCode);
            const aName = String(a.NOMBRE || '').toLowerCase();
            const bName = String(b.NOMBRE || '').toLowerCase();
            return aName.localeCompare(bName);
        });
    }, [projects]);

    const noVacationEmployees = useMemo(() => {
        const vacationRefs = new Set(currentYearVacations.map(v => v.REF_PER));
        return activePersonalList.filter(person => !vacationRefs.has(person.REF_PER));
    }, [activePersonalList, currentYearVacations]);

    const overallAvailablePeople = useMemo(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // Find who is on vacation today
        const peopleOnVacationToday = new Set();
        availableTabVacations.forEach(v => {
            if (v.FECHA_DESDE && v.FECHA_HASTA) {
                if (isDateInRange(todayStr, v.FECHA_DESDE, v.FECHA_HASTA)) {
                    peopleOnVacationToday.add(v.REF_PER);
                }
            }
        });

        // Filter active people who are not on vacation today
        return activePersonalList.filter(p => !peopleOnVacationToday.has(p.REF_PER));
    }, [activePersonalList, availableTabVacations]);

    const projectAssignmentsMap = useMemo(() => {
        const map = {};
        allAssignments.forEach(a => {
            const code = a.CODIGOPR;
            if (code) {
                if (!map[code]) map[code] = new Set();
                map[code].add(a.REF_PER);
            }
        });
        return map;
    }, [allAssignments]);

    const availableCountByProject = useMemo(() => {
        const counts = {};
        projects.forEach(p => {
            counts[p.CODIGOPR] = 0;
        });

        overallAvailablePeople.forEach(person => {
            projects.forEach(proj => {
                const assignedSet = projectAssignmentsMap[proj.CODIGOPR];
                if (assignedSet && assignedSet.has(person.REF_PER)) {
                    counts[proj.CODIGOPR]++;
                }
            });
        });
        return counts;
    }, [projects, overallAvailablePeople, projectAssignmentsMap]);

    const availableByLocation = useMemo(() => {
        let availablePeople = overallAvailablePeople;

        // Filter by project
        if (availableProjectFilter) {
            const assignedSet = projectAssignmentsMap[availableProjectFilter];
            availablePeople = availablePeople.filter(p => assignedSet && assignedSet.has(p.REF_PER));
        }

        // Filter by availableSearchText
        if (availableSearchText) {
            const s = normalizeString(availableSearchText);
            availablePeople = availablePeople.filter(p => {
                const fullName = normalizeString(`${p.NOMBRE || ''} ${p.APELLIDO1 || ''} ${p.APELLIDO2 || ''}`);
                const user = normalizeString(p.USUARIO || '');
                return fullName.includes(s) || user.includes(s);
            });
        }

        // Group by REF_UBI
        const groups = {};
        locations.forEach(loc => {
            groups[loc.REF_UBI] = {
                location: loc,
                people: []
            };
        });

        const noLocKey = 'no_location';
        groups[noLocKey] = {
            location: { REF_UBI: '', A_LUGAR: 'Sin Ubicación Asignada' },
            people: []
        };

        availablePeople.forEach(p => {
            const ubi = p.REF_UBI;
            if (ubi && groups[ubi]) {
                groups[ubi].people.push(p);
            } else {
                groups[noLocKey].people.push(p);
            }
        });

        return Object.values(groups)
            .filter(g => g.people.length > 0)
            .sort((a, b) => String(a.location.A_LUGAR).localeCompare(String(b.location.A_LUGAR)));
    }, [overallAvailablePeople, availableProjectFilter, projectAssignmentsMap, availableSearchText, locations]);

    const filteredHistory = loadedVacaciones.filter(item => {
        // Search filter (Employee name, username or file)
        if (historySearch) {
            const s = normalizeString(historySearch);
            const fullName = normalizeString(`${item.NOMBRE || ''} ${item.APELLIDO1 || ''} ${item.APELLIDO2 || ''}`);
            const user = normalizeString(item.USUARIO || '');
            const file = normalizeString(item.ORIGEN_FICHERO || '');
            if (!fullName.includes(s) && !user.includes(s) && !file.includes(s)) {
                return false;
            }
        }
        
        // Multi-select employee filter
        if (historyFilterUsers.length > 0 && !historyFilterUsers.includes(item.REF_PER)) {
            return false;
        }
        
        // Filter by file
        if (historyFilterFile && item.ORIGEN_FICHERO !== historyFilterFile) {
            return false;
        }
        
        // Filter by year
        if (historyFilterYear && item.FECHA_DESDE) {
            const itemYear = item.FECHA_DESDE.split('-')[0];
            if (itemYear !== historyFilterYear) return false;
        }
        
        return true;
    });

    const sortedHistory = [...filteredHistory].sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA = a[key];
        let valB = b[key];
        
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';
        
        if (key === 'NOMBRE') {
            valA = `${a.APELLIDO1 || ''} ${a.APELLIDO2 || ''} ${a.NOMBRE || ''}`.trim().toLowerCase();
            valB = `${b.APELLIDO1 || ''} ${b.APELLIDO2 || ''} ${b.NOMBRE || ''}`.trim().toLowerCase();
        }
        
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination for history
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentHistoryItems = sortedHistory.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

    // Calculate dynamic stats
    const totalDays = loadedVacaciones.reduce((sum, item) => sum + (parseFloat(item.DURACION) || 0), 0);
    const uniqueEmployeesCount = new Set(loadedVacaciones.map(item => item.REF_PER)).size;
    const activeEmployeeRefs = new Set(activePersonalList.map(p => p.REF_PER));
    const activeEmployeesWithVacationsCount = new Set(loadedVacaciones
        .map(item => item.REF_PER)
        .filter(ref => activeEmployeeRefs.has(ref))
    ).size;
    const activeEmployeesWithoutVacationsCount = Math.max(0, activePersonalList.length - activeEmployeesWithVacationsCount);
    const activeYears = Array.from(new Set(loadedVacaciones.map(item => item.FECHA_DESDE ? item.FECHA_DESDE.split('-')[0] : null).filter(Boolean))).sort().reverse();

    return (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestión de Vacaciones</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Carga masiva desde ficheros Excel de cuadrantes y consulta de resultados integrados.
                    </p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.8rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                        <CalendarRange size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>TOTAL DÍAS CARGADOS</span>
                        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalDays.toFixed(0)}</span>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.8rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                        <CheckCircle2 size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>EMPLEADOS</span>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Solicitadas</span>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeEmployeesWithVacationsCount}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>No solicitadas</span>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeEmployeesWithoutVacationsCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.8rem', borderRadius: '10px', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' }}>
                        <FileSpreadsheet size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>ARCHIVOS IMPORTADOS</span>
                        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{filesList.length}</span>
                    </div>
                </div>
            </div>

            {/* Custom Tabs Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-card)', marginBottom: '2rem', gap: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('upload')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'upload' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'upload' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <Upload size={16} /> Cargar Archivo Excel
                </button>
                <button
                    onClick={() => { setActiveTab('history'); loadHistory(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <Clock size={16} /> Historial y Consultas
                </button>
                <button
                    onClick={() => { setActiveTab('calendar'); setCalendarMonth(new Date().getMonth()); loadHistory({ projectFilter: calendarFilterProject, refPer: calendarFilterUser, year: calendarYear }); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'calendar' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'calendar' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <Calendar size={16} /> Calendario
                </button>
                <button
                    onClick={() => { setActiveTab('no-vacations'); loadNoVacations(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'no-vacations' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'no-vacations' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <Calendar size={16} /> Sin Vacaciones {currentYear}
                </button>
                <button
                    onClick={() => { setActiveTab('available-today'); loadAvailableToday(); }}
                    style={{
                        padding: '0.8rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'available-today' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'available-today' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <CheckCircle2 size={16} /> Disponible Hoy
                </button>
                <button
                    onClick={() => setActiveTab('festivos')}
                    style={{
                        padding: '0.8rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'festivos' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'festivos' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <CalendarRange size={16} /> Festivos
                </button>
            </div>

            {/* Tab Contents */}
            <AnimatePresence mode="wait">
                {activeTab === 'upload' ? (
                    <motion.div
                        key="upload-tab"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Drag and Drop Zone */}
                        <div 
                            onDragOver={canManage ? onDragOver : undefined}
                            onDragLeave={canManage ? onDragLeave : undefined}
                            onDrop={canManage ? onDrop : undefined}
                            onClick={canManage ? triggerFileSelect : undefined}
                            style={{
                                border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border-card)',
                                background: isDragging ? 'rgba(99, 102, 241, 0.05)' : 'var(--glass-bg)',
                                borderRadius: '12px',
                                padding: '2.5rem',
                                textAlign: 'center',
                                cursor: canManage ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                marginBottom: '2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={(e) => handleFile(e.target.files[0])} 
                                accept=".xlsx,.xls" 
                                style={{ display: 'none' }}
                            />
                            <div style={{ 
                                width: '56px', 
                                height: '56px', 
                                borderRadius: '50%', 
                                background: 'rgba(255,255,255,0.03)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                marginBottom: '1rem',
                                border: '1px solid var(--border-card)'
                            }}>
                                <FileSpreadsheet size={28} style={{ color: 'var(--primary)' }} />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                Arrastra tu archivo Excel aquí o haz clic para buscar
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Soporta ficheros .xlsx y .xls con estructura de 6 particiones (G a X).
                            </p>
                            {fileName && (
                                <div style={{ 
                                    marginTop: '1.2rem', 
                                    padding: '0.4rem 1rem', 
                                    background: 'rgba(99, 102, 241, 0.1)', 
                                    borderRadius: '20px', 
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#a5b4fc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <CheckCircle2 size={14} style={{ color: '#818cf8' }} /> {fileName}
                                </div>
                            )}
                        </div>

                        {/* Excel Preview Table */}
                        {excelRows.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Previsualización de Datos Extraídos</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Revisa los periodos detectados. Las filas en rojo no tienen usuario asignado; puedes resolverlo con el selector.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={() => { setExcelRows([]); setFileName(''); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                        >
                                            <X size={16} /> Cancelar Carga
                                        </button>
                                        <button 
                                            className="btn btn-primary" 
                                            disabled={importLoading || excelRows.filter(r => r.status === 'valid').length === 0}
                                            onClick={handleSaveImport}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                        >
                                            <Upload size={16} />
                                            {importLoading ? 'Cargando...' : `Confirmar e Importar (${excelRows.filter(r => r.status === 'valid').length} filas)`}
                                        </button>
                                    </div>
                                </div>

                                <div className="glass-card" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px' }}>Fila Excel</th>
                                                <th>Usuario Excel</th>
                                                <th>Empleado Asociado (Base de Datos)</th>
                                                <th style={{ width: '80px', textAlign: 'center' }}>Partición</th>
                                                <th style={{ width: '80px', textAlign: 'center' }}>Días Laborables</th>
                                                <th>Desde</th>
                                                <th>Hasta</th>
                                                <th style={{ width: '180px' }}>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {excelRows.map((row) => (
                                                <tr key={row.id} style={{ 
                                                    background: row.status === 'error_user' ? 'rgba(239, 68, 68, 0.03)' : 
                                                                row.status === 'error_dates' ? 'rgba(245, 158, 11, 0.03)' : 'none'
                                                }}>
                                                    <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{row.excelRow}</td>
                                                    <td>
                                                        <span style={{ 
                                                            fontFamily: 'monospace', 
                                                            padding: '0.15rem 0.35rem', 
                                                            borderRadius: '4px', 
                                                            background: 'rgba(255,255,255,0.05)',
                                                            fontSize: '0.85rem'
                                                        }}>
                                                            {row.excelUser}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {row.status === 'error_user' ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <select
                                                                    className="form-control"
                                                                    disabled={!canManage}
                                                                    style={{ 
                                                                        padding: '0.2rem 0.5rem', 
                                                                        fontSize: '0.8rem', 
                                                                        height: '30px', 
                                                                        borderColor: 'rgba(239, 68, 68, 0.3)',
                                                                        background: 'rgba(239, 68, 68, 0.05)'
                                                                    }}
                                                                    onChange={(e) => handleRemapEmployee(row.id, e.target.value)}
                                                                    defaultValue=""
                                                                >
                                                                    <option value="">-- Asociar Empleado Manualmente --</option>
                                                                    {activePersonalList.map(p => (
                                                                        <option key={p.REF_PER} value={p.REF_PER}>
                                                                            {p.APELLIDO1} {p.APELLIDO2}, {p.NOMBRE} ({p.USUARIO})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontWeight: 600 }}>
                                                                {row.employee?.NOMBRE} {row.employee?.APELLIDO1} {row.employee?.APELLIDO2}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>P{row.partition}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                                        {row.days !== null ? row.days : '-'}
                                                    </td>
                                                    <td>
                                                        <span style={{ color: !row.desde ? 'var(--danger)' : undefined }}>
                                                            {row.desde || <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Error ({row.desdeRaw})</span>}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: !row.hasta ? 'var(--danger)' : undefined }}>
                                                            {row.hasta || <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Error ({row.hastaRaw})</span>}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem',
                                                            background: row.status === 'valid' ? 'rgba(16, 185, 129, 0.15)' : 
                                                                        row.status === 'error_dates' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                            color: row.status === 'valid' ? '#34d399' : 
                                                                   row.status === 'error_dates' ? '#fbbf24' : '#f87171'
                                                        }}>
                                                            {row.status === 'valid' && <CheckCircle2 size={12} />}
                                                            {row.status === 'error_dates' && <AlertTriangle size={12} />}
                                                            {row.status === 'error_user' && <AlertCircle size={12} />}
                                                            {row.statusText}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}
                        
                        {/* Help Card */}
                        <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'rgba(255,255,255,0.08)' }}>
                            <Info size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.15rem' }} />
                            <div>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem', color: 'var(--text-main)' }}>Guía de Formato y Estructura</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                    Para asegurar una lectura correcta del Excel, compruebe que:
                                    <br />
                                    1. La columna <strong>B</strong> contiene el login de usuario (ej: <code>jsuarez</code>). Se buscarán coincidencias parciales con los correos de la base de datos (ej: <code>jsuarez@tragsa.es</code>).
                                    <br />
                                    2. Las columnas de vacaciones van de la <strong>G a la X</strong> inclusive. Cada partición se compone consecutivamente de: <strong>Días Laborables</strong>, <strong>Fecha Desde</strong>, y <strong>Fecha Hasta</strong>.
                                    <br />
                                    3. El sistema corregirá automáticamente errores de formato habituales al tipear años de 3 dígitos (ej: <code>206</code> a <code>2026</code>) o barras omitidas (ej: <code>30/072026</code>).
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'history' ? (
                    <motion.div
                        key="history-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Filters and Management */}
                        <div className="glass-card" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Buscar / Fichero</label>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="form-control"
                                            style={{ paddingLeft: '2.2rem', height: '34px', fontSize: '0.85rem' }}
                                            placeholder="Nombre o archivo..."
                                            value={historySearch}
                                            onChange={(e) => { setHistorySearch(e.target.value); setCurrentPage(1); }}
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Filtrar por Año</label>
                                    <select
                                        className="form-control"
                                        style={{ height: '34px', fontSize: '0.85rem', padding: '0 0.5rem' }}
                                        value={historyFilterYear}
                                        onChange={(e) => { setHistoryFilterYear(e.target.value); setCurrentPage(1); }}
                                    >
                                        <option value="">Todos los años</option>
                                        {activeYears.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Filtrar por Archivo Importado</label>
                                    <select
                                        className="form-control"
                                        style={{ height: '34px', fontSize: '0.85rem', padding: '0 0.5rem' }}
                                        value={historyFilterFile}
                                        onChange={(e) => { setHistoryFilterFile(e.target.value); setCurrentPage(1); }}
                                    >
                                        <option value="">Todos los archivos</option>
                                        {filesList.map(f => (
                                            <option key={f.ORIGEN_FICHERO} value={f.ORIGEN_FICHERO}>{f.ORIGEN_FICHERO}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Multi-select employee filter */}
                                <div className="form-group" style={{ margin: 0, position: 'relative', zIndex: 2147483647, overflow: 'visible' }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Añadir empleado al filtro</label>
                                    <div style={{ position: 'relative', zIndex: 2147483647, overflow: 'visible' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                                        <input
                                            ref={historyUserInputRef}
                                            type="text"
                                            className="form-control"
                                            style={{ paddingLeft: '2.2rem', height: '34px', fontSize: '0.85rem' }}
                                            placeholder="Buscar por nombre..."
                                            value={historyUserSearch}
                                            onChange={(e) => { setHistoryUserSearch(e.target.value); setHistoryUserSearchOpen(true); }}
                                            onFocus={() => setHistoryUserSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setHistoryUserSearchOpen(false), 180)}
                                        />
                                    </div>
                                    {historyUserSearchOpen && historyUserSearch && (
                                        <FloatingSuggestionList open={historyUserSearchOpen && historyUserSearch} anchorRef={historyUserInputRef}>
                                            {/* Add by encargo */}
                                            {activeProjects
                                                .filter(p => {
                                                    const s = normalizeString(historyUserSearch);
                                                    return normalizeString(p.CODIGOPR).includes(s) || normalizeString(p.NOMBRE || '').includes(s);
                                                })
                                                .slice(0, 4)
                                                .map(proj => (
                                                    <div
                                                        key={'enc-' + proj.CODIGOPR}
                                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                        onMouseDown={() => {
                                                            addEncargoPeopleToFilter(proj.CODIGOPR, setHistoryFilterUsers);
                                                            setHistoryUserSearch('');
                                                            setHistoryUserSearchOpen(false);
                                                            setCurrentPage(1);
                                                        }}
                                                    >
                                                        <span style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(99,102,241,0.18)', color: '#818cf8', fontSize: '0.7rem', fontWeight: 700 }}>Encargo</span>
                                                        {proj.CODIGOPR} – {proj.NOMBRE}
                                                    </div>
                                                ))
                                            }
                                            {/* Add by person */}
                                            {activePersonalList
                                                .filter(p => {
                                                    if (historyFilterUsers.includes(p.REF_PER)) return false;
                                                    const s = normalizeString(historyUserSearch);
                                                    return normalizeString(`${p.APELLIDO1 || ''} ${p.APELLIDO2 || ''} ${p.NOMBRE || ''}`).includes(s) || normalizeString(p.USUARIO || '').includes(s);
                                                })
                                                .slice(0, 8)
                                                .map(p => (
                                                    <div
                                                        key={'emp-' + p.REF_PER}
                                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', borderBottom: '1px solid rgba(148,163,184,0.08)' }}
                                                        onMouseDown={() => {
                                                            addPersonToFilter(p.REF_PER, setHistoryFilterUsers);
                                                            setHistoryUserSearch('');
                                                            setHistoryUserSearchOpen(false);
                                                            setCurrentPage(1);
                                                        }}
                                                    >
                                                        {p.APELLIDO1} {p.APELLIDO2}, {p.NOMBRE}
                                                        <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(p.USUARIO || '').split('@')[0]}</span>
                                                    </div>
                                                ))
                                            }
                                            {activePersonalList.filter(p => {
                                                if (historyFilterUsers.includes(p.REF_PER)) return false;
                                                const s = normalizeString(historyUserSearch);
                                                return normalizeString(`${p.APELLIDO1||''} ${p.APELLIDO2||''} ${p.NOMBRE||''}`).includes(s) || normalizeString(p.USUARIO||'').includes(s);
                                            }).length === 0 && activeProjects.filter(pr => { const s=normalizeString(historyUserSearch); return normalizeString(pr.CODIGOPR).includes(s)||normalizeString(pr.NOMBRE||'').includes(s); }).length === 0 && (
                                                <div style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin resultados</div>
                                            )}
                                        </FloatingSuggestionList>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleExportHistory}
                                        disabled={sortedHistory.length === 0}
                                        title="Exportar registros filtrados a Excel"
                                        style={{
                                            height: '34px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            fontSize: '0.85rem',
                                            whiteSpace: 'nowrap',
                                            opacity: sortedHistory.length === 0 ? 0.5 : 1
                                        }}
                                    >
                                        <Download size={14} /> Exportar Excel
                                    </button>
                                </div>
                            </div>
                            {/* Active employee filter chips */}
                            {historyFilterUsers.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(148,163,184,0.15)', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.2rem' }}>Filtrando:</span>
                                    {historyFilterUsers.map(refPer => {
                                        const person = activePersonalList.find(p => p.REF_PER === refPer);
                                        if (!person) return null;
                                        return (
                                            <span key={refPer} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                padding: '0.2rem 0.55rem', borderRadius: '20px',
                                                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                                                fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600
                                            }}>
                                                {person.APELLIDO1} {person.APELLIDO2[0] ? person.APELLIDO2[0]+'.' : ''}, {person.NOMBRE}
                                                <button
                                                    onClick={() => { removePersonFromFilter(refPer, setHistoryFilterUsers); setCurrentPage(1); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1, color: '#818cf8', display: 'flex', alignItems: 'center' }}
                                                    title="Quitar del filtro"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                    <button
                                        onClick={() => { setHistoryFilterUsers([]); setCurrentPage(1); }}
                                        style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.2rem', textDecoration: 'underline' }}
                                    >
                                        Limpiar todo
                                    </button>
                                </div>
                            )}

                            {/* Bulk Delete imported files */}
                            {historyFilterFile && (
                                <div style={{ 
                                    padding: '0.8rem 1.2rem', 
                                    background: 'rgba(239, 68, 68, 0.08)', 
                                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                                        <span>
                                            Tiene seleccionado el filtro del archivo <strong>{historyFilterFile}</strong>. Puede borrar la importación completa de esta hoja si lo desea.
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteByFile(historyFilterFile)}
                                        className="btn" 
                                        disabled={!canManage}
                                        style={{ 
                                            padding: '0.3rem 0.8rem', 
                                            background: '#ef4444', 
                                            color: '#ffffff', 
                                            fontSize: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        <Trash2 size={12} /> Eliminar Carga Completa
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* History Table */}
                        <div className="glass-card">
                            {historyLoading ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Cargando historial de vacaciones...
                                </div>
                            ) : sortedHistory.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No se encontraron periodos de vacaciones con los filtros aplicados.
                                </div>
                            ) : (
                                <table style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleSort('NOMBRE')} style={{ cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    Empleado
                                                    {sortConfig.key === 'NOMBRE' ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('USUARIO')} style={{ cursor: 'pointer', width: '150px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    Usuario
                                                    {sortConfig.key === 'USUARIO' ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('PARTICION_NUM')} style={{ cursor: 'pointer', textAlign: 'center', width: '90px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                                    Partición
                                                    {sortConfig.key === 'PARTICION_NUM' ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('DURACION')} style={{ cursor: 'pointer', textAlign: 'center', width: '90px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                                    Días
                                                    {sortConfig.key === 'DURACION' ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('FECHA_DESDE')} style={{ cursor: 'pointer', width: '120px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    Desde
                                                    {sortConfig.key === 'FECHA_DESDE' ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('FECHA_HASTA')} style={{ cursor: 'pointer', width: '120px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    Hasta
                                                    {sortConfig.key === 'FECHA_HASTA' ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('ORIGEN_FICHERO')} style={{ cursor: 'pointer', width: '220px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    Archivo Origen
                                                    {sortConfig.key === 'ORIGEN_FICHERO' ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentHistoryItems.map((item) => (
                                            <tr key={item.ID_VACACION}>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                                        {item.APELLIDO1} {item.APELLIDO2}, {item.NOMBRE}
                                                    </span>
                                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {item.PERFIL}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.85rem' }}>
                                                        {item.USUARIO?.split('@')[0]}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                                    {editingVacationId === item.ID_VACACION ? (
                                                        <input
                                                            type="number"
                                                            value={editingVacationData.PARTICION_NUM}
                                                            onChange={(e) => setEditingVacationData(prev => ({ ...prev, PARTICION_NUM: e.target.value }))}
                                                            style={{ width: '70px', padding: '0.25rem', fontSize: '0.85rem' }}
                                                        />
                                                    ) : (
                                                        `P${item.PARTICION_NUM || '-'}`
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                                    {editingVacationId === item.ID_VACACION ? (
                                                        <input
                                                            type="number"
                                                            value={editingVacationData.DURACION}
                                                            onChange={(e) => setEditingVacationData(prev => ({ ...prev, DURACION: e.target.value }))}
                                                            style={{ width: '70px', padding: '0.25rem', fontSize: '0.85rem' }}
                                                        />
                                                    ) : (
                                                        item.DURACION || '-'
                                                    )}
                                                </td>
                                                <td>
                                                    {editingVacationId === item.ID_VACACION ? (
                                                        <input
                                                            type="date"
                                                            value={editingVacationData.FECHA_DESDE}
                                                            onChange={(e) => setEditingVacationData(prev => ({ ...prev, FECHA_DESDE: e.target.value }))}
                                                            style={{ width: '120px', padding: '0.25rem', fontSize: '0.85rem' }}
                                                        />
                                                    ) : (
                                                        formatDateStr(item.FECHA_DESDE)
                                                    )}
                                                </td>
                                                <td>
                                                    {editingVacationId === item.ID_VACACION ? (
                                                        <input
                                                            type="date"
                                                            value={editingVacationData.FECHA_HASTA}
                                                            onChange={(e) => setEditingVacationData(prev => ({ ...prev, FECHA_HASTA: e.target.value }))}
                                                            style={{ width: '120px', padding: '0.25rem', fontSize: '0.85rem' }}
                                                        />
                                                    ) : (
                                                        formatDateStr(item.FECHA_HASTA)
                                                    )}
                                                </td>
                                                <td>
                                                    {editingVacationId === item.ID_VACACION ? (
                                                        <input
                                                            type="text"
                                                            value={editingVacationData.ORIGEN_FICHERO}
                                                            onChange={(e) => setEditingVacationData(prev => ({ ...prev, ORIGEN_FICHERO: e.target.value }))}
                                                            style={{ width: '180px', padding: '0.25rem', fontSize: '0.85rem' }}
                                                        />
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', opacity: 0.8 }}>
                                                            <FileSpreadsheet size={12} style={{ color: 'var(--primary)' }} />
                                                            <span title={item.ORIGEN_FICHERO} style={{
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                maxWidth: '180px'
                                                            }}>
                                                                {item.ORIGEN_FICHERO}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {editingVacationId === item.ID_VACACION ? (
                                                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0.35rem 0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
                                                                onClick={() => handleUpdateVacacion(item.ID_VACACION)}
                                                                disabled={editLoading}
                                                            >
                                                                Guardar
                                                            </button>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0.35rem 0.7rem', background: 'rgba(229, 62, 62, 0.08)', color: '#dc2626' }}
                                                                onClick={cancelEditVacation}
                                                                disabled={editLoading}
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0.35rem 0.7rem', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}
                                                                onClick={() => startEditVacation(item)}
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0.35rem 0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
                                                                onClick={() => handleDeleteVacacion(item.ID_VACACION)}
                                                                title="Eliminar registro"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {sortedHistory.length > 0 && (
                            <div style={{
                                display: 'flex',
                                justifyInter: 'space-between',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '1.5rem',
                                background: 'rgba(255,255,255,0.03)',
                                padding: '0.8rem 1.5rem',
                                borderRadius: '12px',
                                border: '1px solid var(--border-card)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Mostrar
                                    </span>
                                    <select
                                        className="form-control"
                                        value={itemsPerPage}
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        style={{ width: '85px', padding: '0.3rem', fontSize: '0.85rem' }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={15}>15</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        registros por página
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                                        <span style={{ marginLeft: '0.8rem', opacity: 0.6 }}>({sortedHistory.length} registros)</span>
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className="btn"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            style={{ padding: '0.4rem', opacity: currentPage === 1 ? 0.3 : 1 }}
                                        >
                                            Anterior
                                        </button>
                                        <button
                                            className="btn"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            style={{ padding: '0.4rem', opacity: currentPage === totalPages ? 0.3 : 1 }}
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : activeTab === 'calendar' ? (
                    <motion.div
                        key="calendar-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="glass-card" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '1rem', alignItems: 'end', marginBottom: '0.75rem' }}>
                                {/* Multi-select employee filter */}
                                <div className="form-group" style={{ margin: 0, position: 'relative', zIndex: 2147483647, overflow: 'visible' }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Añadir empleado al filtro</label>
                                    <div style={{ position: 'relative', zIndex: 2147483647, overflow: 'visible' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                                        <input
                                            ref={calendarUserInputRef}
                                            type="text"
                                            className="form-control"
                                            style={{ paddingLeft: '2.2rem', height: '34px', fontSize: '0.85rem' }}
                                            placeholder="Nombre del empleado..."
                                            value={calendarUserSearch}
                                            onChange={(e) => { setCalendarUserSearch(e.target.value); setCalendarUserSearchOpen(true); }}
                                            onFocus={() => setCalendarUserSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setCalendarUserSearchOpen(false), 180)}
                                        />
                                    </div>
                                    {calendarUserSearchOpen && calendarUserSearch && (
                                        <FloatingSuggestionList open={calendarUserSearchOpen && calendarUserSearch} anchorRef={calendarUserInputRef}>
                                            {activePersonalList
                                                .filter(p => {
                                                    if (calendarFilterUsers.includes(p.REF_PER)) return false;
                                                    const s = normalizeString(calendarUserSearch);
                                                    return normalizeString(`${p.APELLIDO1||''} ${p.APELLIDO2||''} ${p.NOMBRE||''}`).includes(s) || normalizeString(p.USUARIO||'').includes(s);
                                                })
                                                .slice(0, 10)
                                                .map(p => (
                                                    <div
                                                        key={p.REF_PER}
                                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', borderBottom: '1px solid rgba(148,163,184,0.08)' }}
                                                        onMouseDown={() => {
                                                            addPersonToFilter(p.REF_PER, setCalendarFilterUsers);
                                                            setCalendarUserSearch('');
                                                            setCalendarUserSearchOpen(false);
                                                        }}
                                                    >
                                                        {p.APELLIDO1} {p.APELLIDO2}, {p.NOMBRE}
                                                        <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(p.USUARIO||'').split('@')[0]}</span>
                                                    </div>
                                                ))
                                            }
                                            {activePersonalList.filter(p => {
                                                if (calendarFilterUsers.includes(p.REF_PER)) return false;
                                                const s = normalizeString(calendarUserSearch);
                                                return normalizeString(`${p.APELLIDO1||''} ${p.APELLIDO2||''} ${p.NOMBRE||''}`).includes(s)||normalizeString(p.USUARIO||'').includes(s);
                                            }).length === 0 && (
                                                <div style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin resultados</div>
                                            )}
                                        </FloatingSuggestionList>
                                    )}
                                </div>
                                {/* Filter by encargo (adds all employees of that encargo) */}
                                <div className="form-group" style={{ margin: 0, position: 'relative', zIndex: 2147483647, overflow: 'visible' }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Añadir por encargo</label>
                                    <div style={{ position: 'relative', zIndex: 2147483647, overflow: 'visible' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                                        <input
                                            ref={calendarProjectInputRef}
                                            type="text"
                                            className="form-control"
                                            style={{ paddingLeft: '2.2rem', height: '34px', fontSize: '0.85rem' }}
                                            placeholder="Código o nombre encargo..."
                                            value={calendarProjectSearch}
                                            onChange={(e) => setCalendarProjectSearch(e.target.value)}
                                        />
                                    </div>
                                    {calendarProjectSearch && (
                                        <FloatingSuggestionList open={Boolean(calendarProjectSearch)} anchorRef={calendarProjectInputRef}>
                                            {activeProjects
                                                .filter(p => {
                                                    const s = normalizeString(calendarProjectSearch);
                                                    return normalizeString(p.CODIGOPR).includes(s) || normalizeString(p.NOMBRE||'').includes(s);
                                                })
                                                .slice(0, 8)
                                                .map(proj => (
                                                    <div
                                                        key={proj.CODIGOPR}
                                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', borderBottom: '1px solid rgba(148,163,184,0.08)' }}
                                                        onMouseDown={async () => {
                                                            await addEncargoPeopleToFilter(proj.CODIGOPR, setCalendarFilterUsers);
                                                            setCalendarProjectSearch('');
                                                        }}
                                                    >
                                                        <span style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(99,102,241,0.18)', color: '#818cf8', fontSize: '0.7rem', fontWeight: 700, marginRight: '0.4rem' }}>+todos</span>
                                                        {proj.CODIGOPR} – {proj.NOMBRE}
                                                    </div>
                                                ))
                                            }
                                            {activeProjects.filter(p => { const s=normalizeString(calendarProjectSearch); return normalizeString(p.CODIGOPR).includes(s)||normalizeString(p.NOMBRE||'').includes(s); }).length === 0 && (
                                                <div style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin resultados</div>
                                            )}
                                        </FloatingSuggestionList>
                                    )}
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Año</label>
                                    <select
                                        className="form-control"
                                        style={{ height: '34px', fontSize: '0.85rem', padding: '0 0.5rem' }}
                                        value={calendarYear}
                                        onChange={(e) => setCalendarYear(e.target.value)}
                                    >
                                        {[currentYear, (Number(currentYear) - 1).toString(), (Number(currentYear) + 1).toString()].map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                        className="btn"
                                        style={{ padding: '0.45rem 0.5rem', minWidth: '40px' }}
                                        onClick={() => setCalendarMonth(prev => prev === 0 ? 11 : prev - 1)}
                                    >
                                        ◀
                                    </button>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', minWidth: '100px', textAlign: 'center' }}>{selectedMonthLabel}</span>
                                    <button
                                        className="btn"
                                        style={{ padding: '0.45rem 0.5rem', minWidth: '40px' }}
                                        onClick={() => setCalendarMonth(prev => prev === 11 ? 0 : prev + 1)}
                                    >
                                        ▶
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        id="only-with-vacations"
                                        type="checkbox"
                                        checked={calendarOnlyWithVacations}
                                        onChange={(e) => setCalendarOnlyWithVacations(e.target.checked)}
                                    />
                                    <label htmlFor="only-with-vacations" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Solo con vac.</label>
                                </div>
                            </div>
                            {/* Active employee filter chips for calendar */}
                            {calendarFilterUsers.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(148,163,184,0.15)', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.2rem' }}>Filtrando:</span>
                                    {calendarFilterUsers.map(refPer => {
                                        const person = activePersonalList.find(p => p.REF_PER === refPer);
                                        if (!person) return null;
                                        return (
                                            <span key={refPer} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                padding: '0.2rem 0.55rem', borderRadius: '20px',
                                                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                                                fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600
                                            }}>
                                                {person.APELLIDO1} {person.APELLIDO2 ? person.APELLIDO2[0]+'.' : ''}, {person.NOMBRE}
                                                <button
                                                    onClick={() => removePersonFromFilter(refPer, setCalendarFilterUsers)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1, color: '#818cf8', display: 'flex', alignItems: 'center' }}
                                                    title="Quitar del filtro"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                    <button
                                        onClick={() => setCalendarFilterUsers([])}
                                        style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.2rem', textDecoration: 'underline' }}
                                    >
                                        Limpiar todo
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="glass-card" style={{ overflowX: 'auto', padding: '1rem' }}>
                            {calendarLoading ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Cargando calendario...
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Calendario de Vacaciones</h3>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                                Cada fila muestra a un empleado activo y los días resaltados corresponden a los periodos con vacaciones.
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#bbf7d0', display: 'inline-block', border: '1px solid rgba(16,185,129,0.35)' }} />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Día de vacaciones</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'rgba(147,197,253,0.4)', display: 'inline-block', border: '1px solid rgba(59,130,246,0.3)' }} />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Día festivo entre semana</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'rgba(196,181,253,0.35)', display: 'inline-block', border: '1px solid rgba(147,112,219,0.3)' }} />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Puente</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'transparent', display: 'inline-block', border: '1px solid rgba(148, 163, 184, 0.35)' }} />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Día laboral</span>
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleExportCalendar}
                                                disabled={calendarEmployees.length === 0}
                                                title="Exportar calendario actual a Excel con colores"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    fontSize: '0.82rem',
                                                    padding: '0.4rem 0.9rem',
                                                    opacity: calendarEmployees.length === 0 ? 0.5 : 1
                                                }}
                                            >
                                                <Download size={14} /> Exportar Excel
                                            </button>
                                        </div>
                                    </div>

                                    {calendarEmployees.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No hay empleados activos que coincidan con el filtro seleccionado.
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ position: 'sticky', left: 0, zIndex: 3, background: 'var(--card-bg)', borderBottom: '1px solid var(--border-card)', padding: '0.45rem 0.6rem', textAlign: 'left', minWidth: '160px' }}>
                                                            Empleado
                                                        </th>
                                                        {calendarMonths.map(month => (
                                                            <th
                                                                key={`month-${month.monthYear}-${month.monthIndex}`}
                                                                colSpan={month.days.length}
                                                                style={{
                                                                    textAlign: 'center',
                                                                    padding: '0.55rem 0.35rem',
                                                                    borderBottom: '1px solid var(--border-card)',
                                                                    fontSize: '0.85rem',
                                                                    color: 'var(--text-main)',
                                                                    background: 'rgba(148, 163, 184, 0.08)'
                                                                }}
                                                            >
                                                                {new Date(Number(month.monthYear), month.monthIndex, 1).toLocaleString('es-ES', { month: 'short' })} {month.monthYear}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                    <tr>
                                                        <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--card-bg)', borderBottom: '1px solid var(--border-card)', padding: '0.25rem 0.35rem' }} />
                                                        {calendarMonths.map(month => month.days.map(day => (
                                                            <th
                                                                key={`day-${month.monthYear}-${month.monthIndex}-${day.number}`}
                                                                style={{
                                                                    width: '22px',
                                                                    padding: '0.12rem 0.06rem',
                                                                    textAlign: 'center',
                                                                    borderBottom: '1px solid rgba(148,163,184,0.12)',
                                                                    fontSize: '0.68rem',
                                                                    color: [0, 6].includes(day.weekday) ? '#ef4444' : 'var(--text-muted)',
                                                                    background: [0, 6].includes(day.weekday) ? 'rgba(254,226,226,0.8)' : 'transparent'
                                                                }}
                                                            >
                                                                {day.number}
                                                            </th>
                                                        )))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {calendarEmployees.map(person => (
                                                        <tr key={person.REF_PER} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <td style={{ position: 'sticky', left: 0, background: 'var(--card-bg)', padding: '0.25rem 0.4rem', minWidth: '200px', verticalAlign: 'middle' }}>
                                                                <div style={{ fontWeight: 700, fontSize: '0.86rem', lineHeight: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.APELLIDO1} {person.APELLIDO2}{person.NOMBRE ? `, ${person.NOMBRE}` : ''}</div>
                                                            </td>
                                                            {calendarMonths.map(month => month.days.map(day => {
                                                                const vacations = calendarVacationsByPerson[person.REF_PER] || [];
                                                                const isVacation = vacations.some(vac => isDateInRange(day.iso, vac.FECHA_DESDE, vac.FECHA_HASTA));
                                                                const isWeekend = [0, 6].includes(day.weekday);
                                                                
                                                                // Check if day is a holiday using real festivos from DB
                                                                const personFestivos = person.REF_UBI != null
                                                                    ? new Set([...nationalFestivos, ...(festivosByRef[person.REF_UBI] || [])])
                                                                    : nationalFestivos;
                                                                const isHoliday = personFestivos.has(day.iso) && !isWeekend;
                                                                
                                                                // Check if this is a bridge day (Friday/Monday adjacent to Tuesday/Thursday holiday)
                                                                let isBridge = false;
                                                                if (!isWeekend && !isHoliday) {
                                                                    const dayNum = parseInt(day.iso.split('-')[2], 10);
                                                                    const monthStr = day.iso.split('-')[1];
                                                                    const yearStr = day.iso.split('-')[0];
                                                                    // Check Monday (weekday=1): look for holiday on Tuesday (weekday=2)
                                                                    if (day.weekday === 1) {
                                                                        const tueDate = new Date(day.iso);
                                                                        tueDate.setDate(tueDate.getDate() + 1);
                                                                        const tueDateStr = tueDate.toISOString().split('T')[0];
                                                                        isBridge = personFestivos.has(tueDateStr);
                                                                    }
                                                                    // Check Friday (weekday=5): look for holiday on Thursday (weekday=4)
                                                                    if (day.weekday === 5) {
                                                                        const thuDate = new Date(day.iso);
                                                                        thuDate.setDate(thuDate.getDate() - 1);
                                                                        const thuDateStr = thuDate.toISOString().split('T')[0];
                                                                        isBridge = personFestivos.has(thuDateStr);
                                                                    }
                                                                }
                                                                
                                                                return (
                                                                    <td
                                                                        key={`${person.REF_PER}-${day.iso}`}
                                                                        style={{
                                                                            width: '22px',
                                                                            height: '18px',
                                                                            padding: 0,
                                                                            textAlign: 'center',
                                                                            background: isWeekend ? 'rgba(239,68,68,0.12)' : (isHoliday ? 'rgba(147,197,253,0.4)' : (isBridge ? 'rgba(196,181,253,0.35)' : (isVacation ? '#bbf7d0' : 'transparent'))),
                                                                            border: '1px solid rgba(148,163,184,0.18)'
                                                                        }}
                                                                    >
                                                                        <div style={{
                                                                            width: '100%',
                                                                            height: '100%',
                                                                            display: 'block'
                                                                        }} />
                                                                    </td>
                                                                );
                                                            }))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                ) : activeTab === 'festivos' ? (
                    <motion.div
                        key="festivos-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Filters */}
                        <div className="glass-card" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Año</label>
                                    <input
                                        className="form-control"
                                        type="number"
                                        value={festivosTabYear}
                                        onChange={(e) => setFestivosTabYear(Number(e.target.value))}
                                        style={{ width: '110px' }}
                                        disabled={!canManage}
                                    />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Ubicación</label>
                                    <select
                                        className="form-control"
                                        value={festivosTabRefUbi}
                                        onChange={(e) => setFestivosTabRefUbi(e.target.value)}
                                        style={{ width: '220px' }}
                                        disabled={!canManage}
                                    >
                                        <option value="">Todas</option>
                                        <option value="null">Nacional</option>
                                        {locations.map(u => (
                                            <option key={u.REF_UBI} value={u.REF_UBI}>{u.REF_UBI} - {u.A_LUGAR}</option>
                                        ))}
                                    </select>
                                </div>
                                <button className="btn" onClick={loadFestivosTab} style={{ padding: '0.4rem 0.8rem' }}>Recargar</button>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Copiar festivos:</div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>De año:</label>
                                    <input
                                        className="form-control"
                                        type="number"
                                        value={festivosCopyFromYear}
                                        onChange={(e) => setFestivosCopyFromYear(Number(e.target.value))}
                                        style={{ width: '110px' }}
                                        disabled={!canManage}
                                    />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>A año:</label>
                                    <input
                                        className="form-control"
                                        type="number"
                                        value={festivosCopyToYear}
                                        onChange={(e) => setFestivosCopyToYear(Number(e.target.value))}
                                        style={{ width: '110px' }}
                                        disabled={!canManage}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleFestivoCopy}
                                    disabled={festivosCopyLoading || !canManage}
                                    style={{ padding: '0.4rem 0.8rem' }}
                                >
                                    {festivosCopyLoading ? 'Copiando...' : 'Copiar'}
                                </button>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="glass-card" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CalendarRange size={18} style={{ color: 'var(--primary)' }} />
                                {festivosEditingId ? 'Editar Festivo' : 'Nuevo Festivo'}
                            </h3>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Fecha</label>
                                    <input
                                        className="form-control"
                                        type="date"
                                        value={festivosForm.fecha}
                                        onChange={(e) => setFestivosForm(prev => ({ ...prev, fecha: e.target.value }))}
                                        disabled={!canManage}
                                    />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Ubicación (vacío = Nacional)</label>
                                    <select
                                        className="form-control"
                                        value={festivosForm.ref_ubi}
                                        onChange={(e) => setFestivosForm(prev => ({ ...prev, ref_ubi: e.target.value }))}
                                        style={{ width: '220px' }}
                                        disabled={!canManage}
                                    >
                                        <option value="">Nacional</option>
                                        {locations.map(u => (
                                            <option key={u.REF_UBI} value={u.REF_UBI}>{u.REF_UBI} - {u.A_LUGAR}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
                                    <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Descripción</label>
                                    <input
                                        className="form-control"
                                        type="text"
                                        value={festivosForm.descripcion}
                                        onChange={(e) => setFestivosForm(prev => ({ ...prev, descripcion: e.target.value }))}
                                        placeholder="Nombre del festivo..."
                                        disabled={!canManage}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {festivosEditingId && (
                                        <button
                                            className="btn"
                                            onClick={() => { setFestivosEditingId(null); setFestivosForm({ fecha: '', descripcion: '', ref_ubi: '' }); }}
                                            title="Cancelar edición"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleFestivoSave}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        <Plus size={14} />{festivosEditingId ? 'Actualizar' : 'Crear'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Festivos Table */}
                        <div className="glass-card">
                            {festivosLoading ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando festivos...</div>
                            ) : festivosList.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No hay festivos para los filtros seleccionados.
                                </div>
                            ) : (
                                <table style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleFestivosSort('FECHA')} style={{ cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    Fecha
                                                    {festivosSortConfig?.key === 'FECHA' ? (
                                                        festivosSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                                    ) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleFestivosSort('REF_UBI')} style={{ cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    Ubicación
                                                    {festivosSortConfig?.key === 'REF_UBI' ? (
                                                        festivosSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                                    ) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th onClick={() => handleFestivosSort('DESCRIPCION')} style={{ cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    Descripción
                                                    {festivosSortConfig?.key === 'DESCRIPCION' ? (
                                                        festivosSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                                    ) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </th>
                                            <th style={{ width: '120px', textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedFestivos.map(f => (
                                            <tr key={f.ID_FESTIVO || f.id_festivo}>
                                                <td>{formatDateStr(f.FECHA || f.fecha)}</td>
                                                <td>{f.REF_UBI != null ? (locations.find(u => String(u.REF_UBI) === String(f.REF_UBI))?.A_LUGAR || f.REF_UBI) : 'Nacional'}</td>
                                                <td>{f.DESCRIPCION || f.descripcion}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                        <button
                                                            className="btn"
                                                            style={{ padding: '0.35rem 0.7rem', background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}
                                                            onClick={() => handleFestivoEdit(f)}
                                                            title="Editar"
                                                            disabled={!canManage}
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            className="btn"
                                                            style={{ padding: '0.35rem 0.7rem', background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
                                                            onClick={() => handleFestivoDelete(f.ID_FESTIVO || f.id_festivo)}
                                                            title="Eliminar"
                                                            disabled={!canManage}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </motion.div>
                ) : activeTab === 'no-vacations' ? (
                    <motion.div
                        key="no-vacations-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="glass-card" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Empleados activos sin vacaciones en {currentYear}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                Listado de personal con <strong>ACTIVO = 'S'</strong> en <code>LISTA_PERSONAL</code> que no tiene ningún periodo de vacaciones registrado en el año actual.
                            </p>
                        </div>
                        <div className="glass-card">
                            {noVacationsLoading ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Cargando empleados sin vacaciones...
                                </div>
                            ) : noVacationEmployees.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Todos los empleados activos tienen al menos una vacación registrada en {currentYear}.
                                </div>
                            ) : (
                                <table style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Empleado</th>
                                            <th>Usuario</th>
                                            <th>Perfil</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {noVacationEmployees.map(person => (
                                            <tr key={person.REF_PER}>
                                                <td>
                                                    <strong>{person.APELLIDO1} {person.APELLIDO2}, {person.NOMBRE}</strong>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.85rem' }}>
                                                        {person.USUARIO || '-'}
                                                    </span>
                                                </td>
                                                <td>{person.PERFIL || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </motion.div>
                ) : activeTab === 'available-today' ? (
                    <motion.div
                        key="available-today-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="glass-card" style={{ padding: '1.2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle2 size={18} color="var(--primary)" /> Personal Disponible por Ubicación
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Listado de personal activo hoy (<strong>{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>) que no tiene vacaciones registradas en el día de hoy.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ minWidth: '320px' }}>
                                    <select
                                        className="form-control"
                                        value={availableProjectFilter}
                                        onChange={(e) => setAvailableProjectFilter(e.target.value)}
                                        style={{ width: '100%', height: '42px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)' }}
                                    >
                                        <option value="">Todos los encargos activos ({overallAvailablePeople.length} disp.)</option>
                                        {[...projects]
                                            .filter(p => p.FIN_REAL === null || p.FIN_REAL === undefined || p.FIN_REAL === '')
                                            .sort((a, b) => String(a.CODIGOPR || '').localeCompare(String(b.CODIGOPR || ''), undefined, { numeric: true }))
                                            .map(proj => {
                                                const count = availableCountByProject[proj.CODIGOPR] || 0;
                                                return (
                                                    <option key={proj.CODIGOPR} value={proj.CODIGOPR}>
                                                        {proj.CODIGOPR} - {proj.NOMBRE} ({count} {count === 1 ? 'disponible' : 'disponibles'})
                                                    </option>
                                                );
                                            })}
                                    </select>
                                </div>
                                <div style={{ position: 'relative', width: '280px' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Buscar empleado..."
                                        className="form-control"
                                        value={availableSearchText}
                                        onChange={(e) => setAvailableSearchText(e.target.value)}
                                        style={{ paddingLeft: '2.5rem', width: '100%' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {availableTabLoading ? (
                            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Cargando información de disponibilidad...
                            </div>
                        ) : availableByLocation.length === 0 ? (
                            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {availableSearchText ? 'No se encontraron empleados disponibles con ese filtro.' : 'No hay personal disponible en el día de hoy.'}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                                {availableByLocation.map(group => (
                                    <div key={group.location.REF_UBI || 'no_location'} className="glass-card" style={{ padding: '1.2rem' }}>
                                        <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.5rem', marginBottom: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700 }}>{group.location.A_LUGAR}</span>
                                            <span style={{ fontSize: '0.8rem', background: 'rgba(59,130,246,0.12)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
                                                {group.people.length} {group.people.length === 1 ? 'disponible' : 'disponibles'}
                                            </span>
                                        </h4>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {group.people.map(person => (
                                                <li key={person.REF_PER} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                                                    <span>{person.APELLIDO1} {person.APELLIDO2}, {person.NOMBRE}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{person.PERFIL || '-'}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    );
};

export default VacacionesPage;
