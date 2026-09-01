import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, 
    ChevronRight, 
    ArrowUp, 
    ArrowDown, 
    ArrowUpDown, 
    Search, 
    Filter, 
    Layers, 
    Download, 
    X, 
    CheckSquare, 
    Square, 
    RotateCcw, 
    SlidersHorizontal,
    Users,
    Briefcase,
    Check
} from 'lucide-react';
import api from '../api';
import { normalizeString, formatDate } from '../utils';

// Column definitions grouped by category
const COLUMN_DEFINITIONS = [
    // --- ENCARGO ---
    { id: 'CODIGOPR', label: 'Cód. Encargo', group: 'encargo', type: 'text' },
    { id: 'NOMBRE_ENCARGO', label: 'Nombre Encargo', group: 'encargo', type: 'text' },
    { id: 'CLIENTE', label: 'Cliente', group: 'encargo', type: 'text' },
    { id: 'AREA', label: 'Área', group: 'encargo', type: 'text' },
    { id: 'PRESUPUESTO', label: 'Presupuesto', group: 'encargo', type: 'currency' },
    { id: 'INICIO_ENCARGO', label: 'Inicio Encargo', group: 'encargo', type: 'date' },
    { id: 'FIN_ENCARGO', label: 'Fin Encargo', group: 'encargo', type: 'date' },
    { id: 'FIN_REAL_ENCARGO', label: 'Fin Real Encargo', group: 'encargo', type: 'date' },
    { id: 'DESCRIPCION_ENCARGO', label: 'Descripción Encargo', group: 'encargo', type: 'text' },
    { id: 'INFOR', label: 'Informe', group: 'encargo', type: 'text' },

    // --- ASIGNACIÓN ---
    { id: 'PORCENTAJE', label: '% Asignación', group: 'asignacion', type: 'percent' },
    { id: 'ALTA_ASIGNACION', label: 'Alta Asig.', group: 'asignacion', type: 'date' },
    { id: 'BAJA_ASIGNACION', label: 'Baja Asig.', group: 'asignacion', type: 'date' },
    { id: 'RTP', label: 'RTP', group: 'asignacion', type: 'text' },

    // --- PERSONAL ---
    { id: 'NOMBRE_COMPLETO', label: 'Nombre y Apellidos', group: 'personal', type: 'text' },
    { id: 'IDEMPLEADO', label: 'ID Empleado', group: 'personal', type: 'text' },
    { id: 'PERFIL', label: 'Perfil', group: 'personal', type: 'text' },
    { id: 'ACTIVO', label: 'Activo (Personal)', group: 'personal', type: 'boolean' },
    { id: 'NIF', label: 'NIF', group: 'personal', type: 'text' },
    { id: 'USUARIO', label: 'Usuario', group: 'personal', type: 'text' },
    { id: 'UBICACION', label: 'Ubicación', group: 'personal', type: 'text' },
    { id: 'TELEFONO_1', label: 'Teléfono', group: 'personal', type: 'text' },
    { id: 'INCORPORACION', label: 'Incorporación', group: 'personal', type: 'date' },
    { id: 'BAJA_PERSONAL', label: 'Baja Personal', group: 'personal', type: 'date' },
    { id: 'SITUACION', label: 'Situación', group: 'personal', type: 'text' }
];

const DEFAULT_VISIBLE_COLUMNS = [
    'CODIGOPR',
    'NOMBRE_ENCARGO',
    'CLIENTE',
    'NOMBRE_COMPLETO',
    'PERFIL',
    'PORCENTAJE',
    'ALTA_ASIGNACION',
    'BAJA_ASIGNACION',
    'ACTIVO'
];

const PersonalAssignmentsSummaryPage = () => {
    // Raw Data
    const [assignments, setAssignments] = useState([]);
    const [personalList, setPersonalList] = useState([]);
    const [encargosList, setEncargosList] = useState([]);
    const [ubicacionesList, setUbicacionesList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters & Options
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEncargos, setSelectedEncargos] = useState([]);
    const [encargoSearchFilter, setEncargoSearchFilter] = useState('');
    const [personalStatusFilter, setPersonalStatusFilter] = useState('active'); // 'active', 'inactive', 'all'
    const [onlyActiveAssignments, setOnlyActiveAssignments] = useState(false);
    const [isEncargoDropdownOpen, setIsEncargoDropdownOpen] = useState(false);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);

    // Visible columns
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState({ key: 'NOMBRE_COMPLETO', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Click outside ref for Encargo Dropdown
    const encargoDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (encargoDropdownRef.current && !encargoDropdownRef.current.contains(event.target)) {
                setIsEncargoDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch all initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [asgnRes, persRes, encRes, ubiRes] = await Promise.all([
                    api.getAssignments(),
                    api.getPersonal(),
                    api.getEncargos(),
                    api.getUbicacion().catch(() => ({ data: [] }))
                ]);

                setAssignments(asgnRes.data || []);
                setPersonalList(persRes.data || []);
                
                // Sort encargos by CODIGOPR
                const sortedEnc = (encRes.data || []).sort((a, b) => 
                    String(a.CODIGOPR || '').localeCompare(String(b.CODIGOPR || ''))
                );
                setEncargosList(sortedEnc);
                setUbicacionesList(ubiRes.data || []);
            } catch (err) {
                console.error("Error al cargar datos del resumen:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Build map lookups
    const personalMap = useMemo(() => {
        const map = {};
        personalList.forEach(p => {
            map[String(p.REF_PER)] = p;
        });
        return map;
    }, [personalList]);

    const encargosMap = useMemo(() => {
        const map = {};
        encargosList.forEach(e => {
            map[String(e.CODIGOPR)] = e;
        });
        return map;
    }, [encargosList]);

    const ubicacionesMap = useMemo(() => {
        const map = {};
        ubicacionesList.forEach(u => {
            map[String(u.REF_UBI)] = u.A_LUGAR;
        });
        return map;
    }, [ubicacionesList]);

    // Combine all assignments into detailed flat objects
    const combinedData = useMemo(() => {
        return assignments.map(a => {
            const p = personalMap[String(a.REF_PER)] || {};
            const e = encargosMap[String(a.CODIGOPR)] || {};

            const nombreCompleto = `${p.APELLIDO1 || ''} ${p.APELLIDO2 || ''} ${p.NOMBRE || ''}`.trim() || 
                                   `${a.APELLIDO1 || ''} ${a.APELLIDO2 || ''} ${a.NOMBRE || ''}`.trim() || 'Desconocido';

            return {
                id: `${a.REF_PER}-${a.CODIGOPR}`,
                // Personal fields
                REF_PER: a.REF_PER,
                NOMBRE_COMPLETO: nombreCompleto,
                NOMBRE: p.NOMBRE || a.NOMBRE || '',
                APELLIDOS: `${p.APELLIDO1 || a.APELLIDO1 || ''} ${p.APELLIDO2 || a.APELLIDO2 || ''}`.trim(),
                IDEMPLEADO: p.IDEMPLEADO || '',
                PERFIL: p.PERFIL || a.PERFIL || '',
                ACTIVO: p.ACTIVO || a.ACTIVO || 'N',
                NIF: p.NIF || '',
                USUARIO: p.USUARIO || '',
                UBICACION: ubicacionesMap[String(p.REF_UBI)] || p.REF_UBI || '',
                TELEFONO_1: p.TELEFONO_1 || '',
                INCORPORACION: p.INCORPORACION || null,
                BAJA_PERSONAL: p.BAJA || null,
                SITUACION: p.SITUACION || '',

                // Encargo fields
                CODIGOPR: a.CODIGOPR || '',
                NOMBRE_ENCARGO: e.NOMBRE || 'Desconocido',
                CLIENTE: e.CLIENTE || '',
                AREA: e.AREA || '',
                PRESUPUESTO: e.PRESUPUESTO !== null && e.PRESUPUESTO !== undefined ? Number(e.PRESUPUESTO) : null,
                INICIO_ENCARGO: e.INICIO || null,
                FIN_ENCARGO: e.FIN || null,
                FIN_REAL_ENCARGO: e.FIN_REAL || null,
                DESCRIPCION_ENCARGO: e.DESCRIPCION || '',
                INFOR: e.INFOR || '',

                // Assignment fields
                PORCENTAJE: a.PORCENTAJE !== null && a.PORCENTAJE !== undefined ? parseFloat(a.PORCENTAJE) : 100,
                ALTA_ASIGNACION: a.ALTA || null,
                BAJA_ASIGNACION: a.BAJA || null,
                RTP: a.RTP || 'N'
            };
        });
    }, [assignments, personalMap, encargosMap, ubicacionesMap]);

    // Filter data
    const filteredData = useMemo(() => {
        return combinedData.filter(item => {
            // 1. Multi-encargo filter
            if (selectedEncargos.length > 0 && !selectedEncargos.includes(item.CODIGOPR)) {
                return false;
            }

            // 2. Personal status filter
            if (personalStatusFilter === 'active' && item.ACTIVO !== 'S') return false;
            if (personalStatusFilter === 'inactive' && item.ACTIVO === 'S') return false;

            // 3. Only active assignments filter
            if (onlyActiveAssignments && item.BAJA_ASIGNACION) {
                // If assignment has a baja date in the past or today, filter out
                const bajaDate = new Date(item.BAJA_ASIGNACION);
                if (!isNaN(bajaDate.getTime()) && bajaDate < new Date()) {
                    return false;
                }
            }

            // 4. Global search term filter
            if (searchTerm) {
                const s = normalizeString(searchTerm);
                const matchName = normalizeString(item.NOMBRE_COMPLETO).includes(s);
                const matchEncCode = normalizeString(item.CODIGOPR).includes(s);
                const matchEncName = normalizeString(item.NOMBRE_ENCARGO).includes(s);
                const matchPerfil = normalizeString(item.PERFIL).includes(s);
                const matchCliente = normalizeString(item.CLIENTE).includes(s);
                const matchArea = normalizeString(item.AREA).includes(s);
                const matchIdEmp = normalizeString(item.IDEMPLEADO).includes(s);
                const matchNif = normalizeString(item.NIF).includes(s);
                const matchUbi = normalizeString(item.UBICACION).includes(s);

                if (!matchName && !matchEncCode && !matchEncName && !matchPerfil && 
                    !matchCliente && !matchArea && !matchIdEmp && !matchNif && !matchUbi) {
                    return false;
                }
            }

            return true;
        });
    }, [combinedData, selectedEncargos, personalStatusFilter, onlyActiveAssignments, searchTerm]);

    // Sort data
    const sortedData = useMemo(() => {
        const sorted = [...filteredData];
        if (!sortConfig.key) return sorted;

        const { key, direction } = sortConfig;
        const colDef = COLUMN_DEFINITIONS.find(c => c.id === key);

        sorted.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            if (colDef?.type === 'currency' || colDef?.type === 'percent') {
                const numA = Number(valA) || 0;
                const numB = Number(valB) || 0;
                return direction === 'asc' ? numA - numB : numB - numA;
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [filteredData, sortConfig]);

    // Metrics summary
    const metrics = useMemo(() => {
        const totalAssignments = filteredData.length;
        const uniquePersonal = new Set(filteredData.map(d => d.REF_PER)).size;
        const uniqueEncargos = new Set(filteredData.map(d => d.CODIGOPR)).size;
        const totalPorcentaje = filteredData.reduce((acc, curr) => acc + (curr.PORCENTAJE || 0), 0);
        const avgPorcentaje = totalAssignments > 0 ? (totalPorcentaje / totalAssignments).toFixed(1) : 0;

        return {
            totalAssignments,
            uniquePersonal,
            uniqueEncargos,
            avgPorcentaje
        };
    }, [filteredData]);

    // Handle column toggle
    const toggleColumn = (colId) => {
        setVisibleColumns(prev => 
            prev.includes(colId) 
                ? (prev.length > 1 ? prev.filter(c => c !== colId) : prev) 
                : [...prev, colId]
        );
    };

    const selectAllColumns = () => {
        setVisibleColumns(COLUMN_DEFINITIONS.map(c => c.id));
    };

    const deselectAllColumns = () => {
        setVisibleColumns(['CODIGOPR', 'NOMBRE_COMPLETO']);
    };

    const resetDefaultColumns = () => {
        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    };

    // Encargo multi-select handlers
    const toggleEncargoSelection = (codigopr) => {
        setSelectedEncargos(prev => 
            prev.includes(codigopr) 
                ? prev.filter(c => c !== codigopr) 
                : [...prev, codigopr]
        );
        setCurrentPage(1);
    };

    const selectAllEncargos = () => {
        setSelectedEncargos(encargosList.map(e => e.CODIGOPR));
        setCurrentPage(1);
    };

    const clearEncargosSelection = () => {
        setSelectedEncargos([]);
        setCurrentPage(1);
    };

    const filteredEncargosOptions = useMemo(() => {
        if (!encargoSearchFilter) return encargosList;
        const s = normalizeString(encargoSearchFilter);
        return encargosList.filter(e => 
            normalizeString(e.CODIGOPR).includes(s) || 
            normalizeString(e.NOMBRE).includes(s)
        );
    }, [encargosList, encargoSearchFilter]);

    // Sort column click handler
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Export to Excel
    const handleExportExcel = async () => {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Gestión Personal';
            workbook.created = new Date();
            const ws = workbook.addWorksheet('Resumen de Asignaciones');

            // Columns to export: only visible columns
            const colsToExport = COLUMN_DEFINITIONS.filter(c => visibleColumns.includes(c.id));

            ws.columns = colsToExport.map(col => ({
                header: col.label,
                key: col.id,
                width: col.id === 'NOMBRE_COMPLETO' || col.id === 'NOMBRE_ENCARGO' ? 30 : 18
            }));

            // Style Header
            const headerRow = ws.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F46E5' } // Indigo
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Add rows
            sortedData.forEach(item => {
                const rowData = {};
                colsToExport.forEach(col => {
                    let val = item[col.id];
                    if (col.type === 'date') {
                        val = formatDate(val);
                    } else if (col.type === 'boolean') {
                        val = val === 'S' ? 'Sí' : 'No';
                    } else if (col.type === 'percent') {
                        val = val !== null && val !== undefined ? `${val}%` : '';
                    } else if (col.type === 'currency') {
                        val = val !== null && val !== undefined ? `${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '';
                    }
                    rowData[col.id] = val;
                });
                ws.addRow(rowData);
            });

            // Auto-border rows
            ws.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Resumen_Asignaciones_${new Date().toISOString().split('T')[0]}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error al exportar a Excel:", err);
            alert("Error al exportar a Excel: " + err.message);
        }
    };

    // Render cell value
    const renderCell = (item, col) => {
        const val = item[col.id];

        if (col.type === 'date') {
            return formatDate(val) || '-';
        }

        if (col.type === 'boolean') {
            return (
                <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    background: val === 'S' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: val === 'S' ? '#4ade80' : '#f87171',
                    border: `1px solid ${val === 'S' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                    {val === 'S' ? 'Activo' : 'Inactivo'}
                </span>
            );
        }

        if (col.type === 'percent') {
            const isFull = val === 100;
            const isOver = val > 100;
            return (
                <span style={{
                    fontWeight: 'bold',
                    color: isOver ? '#f87171' : isFull ? '#4ade80' : '#fbbf24'
                }}>
                    {val}%
                </span>
            );
        }

        if (col.type === 'currency') {
            return val !== null && val !== undefined
                ? `${val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                : '-';
        }

        if (col.id === 'CODIGOPR') {
            return (
                <span style={{
                    fontWeight: '600',
                    color: '#818cf8',
                    background: 'rgba(99, 102, 241, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                    {val}
                </span>
            );
        }

        if (col.id === 'NOMBRE_COMPLETO') {
            return <span style={{ fontWeight: '500' }}>{val}</span>;
        }

        if (col.id === 'RTP') {
            return (
                <span style={{
                    fontWeight: val === 'S' ? 'bold' : 'normal',
                    color: val === 'S' ? '#a855f7' : 'inherit'
                }}>
                    {val}
                </span>
            );
        }

        if (col.id === 'DESCRIPCION_ENCARGO') {
            return (
                <span 
                    style={{ 
                        display: 'inline-block', 
                        maxWidth: '220px', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                    }} 
                    title={val}
                >
                    {val || '-'}
                </span>
            );
        }

        return val || '-';
    };

    // Pagination calculations
    const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
    const paginatedItems = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {/* Header with Title & Export Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Resumen de Asignaciones</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                        Consulta y cruce avanzado de asignaciones, personal y encargos con personalización dinámica de columnas.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <button 
                        className="btn"
                        onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: isColumnSelectorOpen ? 'var(--primary)' : 'var(--bg-card)',
                            color: isColumnSelectorOpen ? '#ffffff' : 'var(--text-main)',
                            border: '1px solid var(--border-card)'
                        }}
                    >
                        <SlidersHorizontal size={16} />
                        Personalizar Columnas ({visibleColumns.length})
                    </button>

                    <button 
                        className="btn btn-primary"
                        onClick={handleExportExcel}
                        disabled={sortedData.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Download size={16} />
                        Exportar a Excel
                    </button>
                </div>
            </div>

            {/* Metrics Ribbon */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(119, 25, 170, 0.1)', borderRadius: '10px', color: 'var(--primary)' }}>
                        <Layers size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asignaciones</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{metrics.totalAssignments}</div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(34, 197, 94, 0.15)', borderRadius: '10px', color: '#16a34a' }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Único</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{metrics.uniquePersonal}</div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(234, 179, 8, 0.15)', borderRadius: '10px', color: '#d97706' }}>
                        <Briefcase size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encargos Seleccionados</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
                            {selectedEncargos.length > 0 ? `${selectedEncargos.length} de ${encargosList.length}` : `Todos (${metrics.uniqueEncargos})`}
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(168, 85, 247, 0.15)', borderRadius: '10px', color: '#9333ea' }}>
                        <Filter size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>% Medio Asignación</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{metrics.avgPorcentaje}%</div>
                    </div>
                </div>
            </div>

            {/* Column Selector Panel (Collapsible) */}
            <AnimatePresence>
                {isColumnSelectorOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden', marginBottom: '1.5rem' }}
                    >
                        <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <SlidersHorizontal size={18} color="var(--primary)" />
                                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Seleccionar Campos Visibles</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        ({visibleColumns.length} de {COLUMN_DEFINITIONS.length} activos)
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={selectAllColumns}
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', background: 'var(--input-bg)', border: '1px solid var(--border-card)', color: 'var(--text-main)' }}
                                    >
                                        Marcar Todos
                                    </button>
                                    <button
                                        onClick={deselectAllColumns}
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', background: 'var(--input-bg)', border: '1px solid var(--border-card)', color: 'var(--text-main)' }}
                                    >
                                        Mínimo
                                    </button>
                                    <button
                                        onClick={resetDefaultColumns}
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', background: 'var(--input-bg)', border: '1px solid var(--border-card)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                    >
                                        <RotateCcw size={12} /> Por Defecto
                                    </button>
                                    <button
                                        onClick={() => setIsColumnSelectorOpen(false)}
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                {/* Group 1: Encargo */}
                                <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Briefcase size={14} /> Campos del Encargo
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {COLUMN_DEFINITIONS.filter(c => c.group === 'encargo').map(col => {
                                            const isChecked = visibleColumns.includes(col.id);
                                            return (
                                                <button
                                                    key={col.id}
                                                    onClick={() => toggleColumn(col.id)}
                                                    style={{
                                                        fontSize: '0.8rem',
                                                        padding: '0.3rem 0.6rem',
                                                        borderRadius: '6px',
                                                        border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-card)',
                                                        background: isChecked ? 'var(--primary)' : 'var(--input-bg)',
                                                        color: isChecked ? '#ffffff' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem'
                                                    }}
                                                >
                                                    {isChecked && <Check size={12} />}
                                                    {col.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Group 2: Asignación */}
                                <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#7c3aed', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Layers size={14} /> Campos de la Asignación
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {COLUMN_DEFINITIONS.filter(c => c.group === 'asignacion').map(col => {
                                            const isChecked = visibleColumns.includes(col.id);
                                            return (
                                                <button
                                                    key={col.id}
                                                    onClick={() => toggleColumn(col.id)}
                                                    style={{
                                                        fontSize: '0.8rem',
                                                        padding: '0.3rem 0.6rem',
                                                        borderRadius: '6px',
                                                        border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-card)',
                                                        background: isChecked ? 'var(--primary)' : 'var(--input-bg)',
                                                        color: isChecked ? '#ffffff' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem'
                                                    }}
                                                >
                                                    {isChecked && <Check size={12} />}
                                                    {col.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Group 3: Personal */}
                                <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#16a34a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Users size={14} /> Campos del Personal
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {COLUMN_DEFINITIONS.filter(c => c.group === 'personal').map(col => {
                                            const isChecked = visibleColumns.includes(col.id);
                                            return (
                                                <button
                                                    key={col.id}
                                                    onClick={() => toggleColumn(col.id)}
                                                    style={{
                                                        fontSize: '0.8rem',
                                                        padding: '0.3rem 0.6rem',
                                                        borderRadius: '6px',
                                                        border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-card)',
                                                        background: isChecked ? 'var(--primary)' : 'var(--input-bg)',
                                                        color: isChecked ? '#ffffff' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem'
                                                    }}
                                                >
                                                    {isChecked && <Check size={12} />}
                                                    {col.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filter Bar: Multi-Encargo & Status Filters & Search */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem', position: 'relative', zIndex: isEncargoDropdownOpen ? 999 : 10 }}>
                {/* 1. Global Search */}
                <div className="glass-card" style={{ padding: '0.8rem 1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Búsqueda General:</p>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, encargo, perfil, cliente..."
                            className="form-control"
                            style={{ paddingLeft: '2.4rem', height: '40px', fontSize: '0.85rem' }}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. Multi-Encargo Selector Filter */}
                <div 
                    ref={encargoDropdownRef}
                    className="glass-card" 
                    style={{ padding: '0.8rem 1rem', position: 'relative', zIndex: isEncargoDropdownOpen ? 1000 : 2 }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)' }}>
                            Filtro Encargos ({selectedEncargos.length === 0 ? 'Todos' : `${selectedEncargos.length} selec.`}):
                        </p>
                        {selectedEncargos.length > 0 && (
                            <button 
                                onClick={clearEncargosSelection}
                                style={{ fontSize: '0.75rem', background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Limpiar
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setIsEncargoDropdownOpen(!isEncargoDropdownOpen)}
                        className="form-control"
                        style={{
                            height: '40px',
                            textAlign: 'left',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            background: 'var(--input-bg)',
                            color: 'var(--text-main)',
                            border: isEncargoDropdownOpen ? '1px solid var(--primary)' : '1px solid var(--border-card)'
                        }}
                    >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedEncargos.length === 0 
                                ? '✨ Todos los encargos (sin filtrar)' 
                                : `${selectedEncargos.length} encargo(s) seleccionado(s)`}
                        </span>
                        <Filter size={14} style={{ opacity: 0.6, flexShrink: 0, color: 'var(--primary)' }} />
                    </button>

                    {/* Encargos Dropdown Popup */}
                    <AnimatePresence>
                        {isEncargoDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                transition={{ duration: 0.15 }}
                                style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1001,
                                    background: 'var(--glass2-bg, #ffffff)',
                                    color: 'var(--text-main, #323130)',
                                    borderRadius: '12px',
                                    padding: '0.9rem',
                                    boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid var(--border-card)',
                                    backdropFilter: 'blur(16px)',
                                    maxHeight: '350px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.6rem'
                                }}
                            >
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar encargo..."
                                            value={encargoSearchFilter}
                                            onChange={(e) => setEncargoSearchFilter(e.target.value)}
                                            className="form-control"
                                            style={{
                                                width: '100%',
                                                paddingLeft: '1.9rem',
                                                paddingRight: '0.5rem',
                                                height: '32px',
                                                fontSize: '0.8rem',
                                                borderRadius: '6px',
                                                background: 'var(--input-bg)',
                                                color: 'var(--text-main)',
                                                border: '1px solid var(--border-card)'
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setIsEncargoDropdownOpen(false)}
                                        className="btn"
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-card)' }}>
                                    <button
                                        onClick={selectAllEncargos}
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', flex: 1, background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-card)' }}
                                    >
                                        Seleccionar Todos
                                    </button>
                                    <button
                                        onClick={clearEncargosSelection}
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', flex: 1, background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-card)' }}
                                    >
                                        Deseleccionar
                                    </button>
                                </div>

                                <div style={{ overflowY: 'auto', maxHeight: '200px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {filteredEncargosOptions.map(e => {
                                        const isSelected = selectedEncargos.includes(e.CODIGOPR);
                                        return (
                                            <div
                                                key={e.CODIGOPR}
                                                onClick={() => toggleEncargoSelection(e.CODIGOPR)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.6rem',
                                                    padding: '0.4rem 0.6rem',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    background: isSelected ? 'rgba(119, 25, 170, 0.08)' : 'transparent',
                                                    border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                                                    transition: 'background 0.15s ease'
                                                }}
                                            >
                                                {isSelected ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} style={{ opacity: 0.4 }} />}
                                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                                                    {e.CODIGOPR}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {e.NOMBRE}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {filteredEncargosOptions.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            No se encontraron encargos.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Personal Status & Vigencia Filter */}
                <div className="glass-card" style={{ padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Estado del Personal & Asignación:</p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flex: 1, background: 'var(--input-bg)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-card)' }}>
                            <button
                                onClick={() => { setPersonalStatusFilter('active'); setCurrentPage(1); }}
                                className={`btn ${personalStatusFilter === 'active' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', background: personalStatusFilter === 'active' ? '' : 'transparent', color: personalStatusFilter === 'active' ? '#fff' : 'var(--text-muted)' }}
                            >
                                Activos
                            </button>
                            <button
                                onClick={() => { setPersonalStatusFilter('inactive'); setCurrentPage(1); }}
                                className={`btn ${personalStatusFilter === 'inactive' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', background: personalStatusFilter === 'inactive' ? '' : 'transparent', color: personalStatusFilter === 'inactive' ? '#fff' : 'var(--text-muted)' }}
                            >
                                Inactivos
                            </button>
                            <button
                                onClick={() => { setPersonalStatusFilter('all'); setCurrentPage(1); }}
                                className={`btn ${personalStatusFilter === 'all' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', background: personalStatusFilter === 'all' ? '' : 'transparent', color: personalStatusFilter === 'all' ? '#fff' : 'var(--text-muted)' }}
                            >
                                Todos
                            </button>
                        </div>

                        <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                            <input
                                type="checkbox"
                                checked={onlyActiveAssignments}
                                onChange={(e) => { setOnlyActiveAssignments(e.target.checked); setCurrentPage(1); }}
                                style={{ cursor: 'pointer' }}
                            />
                            Vigentes
                        </label>
                    </div>
                </div>
            </div>

            {/* Selected Encargos Chips (if any) */}
            {selectedEncargos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.2rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.3rem' }}>
                        Encargos filtrados:
                    </span>
                    {selectedEncargos.map(code => {
                        const enc = encargosMap[code];
                        return (
                            <span
                                key={code}
                                style={{
                                    fontSize: '0.75rem',
                                    background: 'rgba(119, 25, 170, 0.08)',
                                    color: 'var(--primary)',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(119, 25, 170, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <strong>{code}</strong> {enc?.NOMBRE ? `(${enc.NOMBRE.slice(0, 22)}...)` : ''}
                                <button
                                    onClick={() => toggleEncargoSelection(code)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Main Table Card */}
            <div className="glass-card" style={{ position: 'relative', zIndex: 1 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <div style={{ marginBottom: '0.5rem' }}>Cargando asignaciones y personal...</div>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {COLUMN_DEFINITIONS.filter(c => visibleColumns.includes(c.id)).map(col => {
                                            const isSorted = sortConfig.key === col.id;
                                            return (
                                                <th
                                                    key={col.id}
                                                    onClick={() => handleSort(col.id)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        whiteSpace: 'nowrap',
                                                        textAlign: col.type === 'percent' || col.type === 'currency' ? 'right' : 'left'
                                                    }}
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem',
                                                        justifyContent: col.type === 'percent' || col.type === 'currency' ? 'flex-end' : 'flex-start'
                                                    }}>
                                                        {col.label}
                                                        {isSorted ? (
                                                            sortConfig.direction === 'asc' ? <ArrowUp size={13} color="var(--primary)" /> : <ArrowDown size={13} color="var(--primary)" />
                                                        ) : (
                                                            <ArrowUpDown size={12} style={{ opacity: 0.25 }} />
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedItems.map(item => (
                                        <tr key={item.id}>
                                            {COLUMN_DEFINITIONS.filter(c => visibleColumns.includes(c.id)).map(col => (
                                                <td 
                                                    key={col.id}
                                                    style={{
                                                        textAlign: col.type === 'percent' || col.type === 'currency' ? 'right' : 'left',
                                                        whiteSpace: col.type === 'date' || col.id === 'CODIGOPR' || col.type === 'boolean' ? 'nowrap' : 'normal'
                                                    }}
                                                >
                                                    {renderCell(item, col)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}

                                    {sortedData.length === 0 && (
                                        <tr>
                                            <td 
                                                colSpan={visibleColumns.length} 
                                                style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}
                                            >
                                                No se han encontrado registros con los filtros seleccionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination & Controls */}
                        {sortedData.length > 0 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '1.5rem',
                                background: 'rgba(255,255,255,0.4)',
                                padding: '0.8rem 1.2rem',
                                borderRadius: '10px',
                                border: '1px solid var(--border-card)',
                                flexWrap: 'wrap',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Mostrar
                                    </span>
                                    <select
                                        className="form-control"
                                        value={itemsPerPage}
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        style={{ width: '75px', padding: '0.3rem', fontSize: '0.85rem' }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={500}>500</option>
                                    </select>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        filas por página
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                                        <span style={{ marginLeft: '0.6rem', opacity: 0.7 }}>
                                            ({sortedData.length} resultados)
                                        </span>
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button
                                            className="btn"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            style={{ padding: '0.35rem 0.7rem', opacity: currentPage === 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                        >
                                            <ChevronLeft size={16} /> Anterior
                                        </button>
                                        <button
                                            className="btn"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            style={{ padding: '0.35rem 0.7rem', opacity: currentPage === totalPages ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                        >
                                            Siguiente <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default PersonalAssignmentsSummaryPage;
