import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Search, Download, Table as TableIcon, Check, X, Filter, Play, AlertCircle, Plus, Trash2, Settings } from 'lucide-react';
import api from '../api';
import { normalizeString, formatDate } from '../utils';
import * as XLSX from 'xlsx';

const QueryPage = () => {
    const [schema, setSchema] = useState({});
    const [selectedTables, setSelectedTables] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState({}); // { tableName: [columns] }
    const [filters, setFilters] = useState([]); // [{ id, table, column, operator, value }]
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedSql, setGeneratedSql] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [tableSearchTerm, setTableSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    const operators = [
        { label: 'Igual (=)', value: '=' },
        { label: 'Contiene (LIKE)', value: 'LIKE' },
        { label: 'Empieza por', value: 'LIKE_START' },
        { label: 'Distinto (<>)', value: '<>' },
        { label: 'Mayor que (>)', value: '>' },
        { label: 'Menor que (<)', value: '<' },
        { label: 'Es Nulo', value: 'IS NULL' },
        { label: 'No es Nulo', value: 'IS NOT NULL' }
    ];

    useEffect(() => {
        const fetchSchema = async () => {
            try {
                const res = await api.getSchema();
                setSchema(res.data);
            } catch (err) {
                console.error("Error fetching schema:", err);
                setError("No se pudo cargar el esquema de la base de datos.");
            }
        };
        fetchSchema();
    }, []);

    const toggleTable = (tableName) => {
        if (selectedTables.includes(tableName)) {
            setSelectedTables(selectedTables.filter(t => t !== tableName));
            const newCols = { ...selectedColumns };
            delete newCols[tableName];
            setSelectedColumns(newCols);
            // Also remove filters related to this table
            setFilters(filters.filter(f => f.table !== tableName));
        } else {
            setSelectedTables([...selectedTables, tableName]);
            setSelectedColumns({ ...selectedColumns, [tableName]: [] });
        }
    };

    const toggleColumn = (tableName, columnName) => {
        const currentCols = selectedColumns[tableName] || [];
        if (currentCols.includes(columnName)) {
            setSelectedColumns({
                ...selectedColumns,
                [tableName]: currentCols.filter(c => c !== columnName)
            });
        } else {
            setSelectedColumns({
                ...selectedColumns,
                [tableName]: [...currentCols, columnName]
            });
        }
    };

    const addFilter = () => {
        setFilters([...filters, { id: Date.now(), table: selectedTables[0] || '', column: '', operator: '=', value: '' }]);
    };

    const removeFilter = (id) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    const updateFilter = (id, field, value) => {
        setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    useEffect(() => {
        buildSql();
    }, [selectedColumns, selectedTables, filters]);

    const buildSql = () => {
        if (selectedTables.length === 0) {
            setGeneratedSql('');
            return;
        }

        let selectParts = [];
        Object.keys(selectedColumns).forEach(table => {
            selectedColumns[table].forEach(col => {
                selectParts.push(`${table}.${col} AS "${table}.${col}"`);
            });
        });

        if (selectParts.length === 0) {
            setGeneratedSql('');
            return;
        }

        let sql = `SELECT ${selectParts.join(', ')} FROM ${selectedTables[0]}`;

        // Relationships definition
        const relationships = [
            { t1: 'LISTA_PERSONAL', t2: 'PERSONAL_PROYECTOS', on: 'LISTA_PERSONAL.REF_PER = PERSONAL_PROYECTOS.REF_PER' },
            { t1: 'ENCARGOS', t2: 'PERSONAL_PROYECTOS', on: 'ENCARGOS.CODIGOPR = PERSONAL_PROYECTOS.CODIGOPR' },
            { t1: 'LISTA_PERSONAL', t2: 'UBICACION', on: 'LISTA_PERSONAL.REF_UBI = UBICACION.REF_UBI' }
        ];

        // Identify bridge tables
        let neededTables = [...selectedTables];
        const hasProject = selectedTables.includes('ENCARGOS');
        const hasLocation = selectedTables.includes('UBICACION');
        const hasPersonal = selectedTables.includes('LISTA_PERSONAL');
        const hasAssignment = selectedTables.includes('PERSONAL_PROYECTOS');

        if (hasProject && (hasPersonal || hasLocation) && !hasAssignment) {
            neededTables.push('PERSONAL_PROYECTOS');
        }
        if ((hasProject || hasAssignment) && hasLocation && !hasPersonal) {
            neededTables.push('LISTA_PERSONAL');
        }

        // Build JOINS
        let sqlJoins = "";
        const baseTable = selectedTables[0];
        let joined = [baseTable];
        let remaining = Array.from(new Set(neededTables)).filter(t => t !== baseTable);

        let attempts = 0;
        while (remaining.length > 0 && attempts < 10) {
            attempts++;
            for (let i = 0; i < remaining.length; i++) {
                const target = remaining[i];
                const rel = relationships.find(r =>
                    (joined.includes(r.t1) && r.t2 === target) ||
                    (joined.includes(r.t2) && r.t1 === target)
                );

                if (rel) {
                    sqlJoins += ` JOIN ${target} ON ${rel.on}`;
                    joined.push(target);
                    remaining.splice(i, 1);
                    break;
                }
            }
        }

        sql += sqlJoins;

        // Build WHERE
        const whereParts = filters
            .filter(f => f.table && f.column)
            .map(f => {
                let val = f.value;
                if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
                    return `${f.table}.${f.column} ${f.operator}`;
                }

                // Escape simple quotes for security/syntax
                const escapedVal = val.replace(/'/g, "''");

                if (f.operator === 'LIKE') return `${f.table}.${f.column} LIKE '%${escapedVal}%'`;
                if (f.operator === 'LIKE_START') return `${f.table}.${f.column} LIKE '${escapedVal}%'`;

                // Numeric or String direct comparison
                const isNumeric = !isNaN(val) && val !== '';
                return `${f.table}.${f.column} ${f.operator} ${isNumeric ? val : `'${escapedVal}'`}`;
            });

        if (whereParts.length > 0) {
            sql += ` WHERE ${whereParts.join(' AND ')}`;
        }

        setGeneratedSql(sql);
    };

    const runQuery = async () => {
        if (!generatedSql) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.runQuery(generatedSql);
            setResults(res.data);
            setSortConfig({ key: null, direction: 'asc' });
            setCurrentPage(1);
        } catch (err) {
            console.error("Query error:", err);
            setError(err.response?.data?.error || "Error al ejecutar la consulta.");
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (results.length === 0) return;

        // Clean keys for export
        const exportData = results.map(row => {
            const cleanRow = {};
            Object.keys(row).forEach(key => {
                cleanRow[key] = row[key];
            });
            return cleanRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Consulta");
        XLSX.writeFile(workbook, `Consulta_Variable_${new Date().getTime()}.xlsx`);
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const sortedResults = React.useMemo(() => {
        let sortableItems = [...results];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                if (aVal === null) return 1;
                if (bVal === null) return -1;

                // Compare values
                if (typeof aVal === 'string') {
                    const result = aVal.localeCompare(bVal);
                    return sortConfig.direction === 'asc' ? result : -result;
                } else {
                    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }
            });
        }
        return sortableItems;
    }, [results, sortConfig]);

    const paginatedResults = React.useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedResults.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedResults, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(results.length / itemsPerPage);

    const getColumnsByTable = () => {
        if (results.length === 0) return {};
        const columnsByTable = {};
        Object.keys(results[0]).forEach(key => {
            const parts = key.split('.');
            const table = parts.length > 1 ? parts[0] : 'Otros';
            const col = parts.length > 1 ? parts.slice(1).join('.') : key;
            if (!columnsByTable[table]) columnsByTable[table] = [];
            columnsByTable[table].push({ key, col });
        });
        return columnsByTable;
    };

    const columnsByTable = getColumnsByTable();
    const flatColumns = Object.values(columnsByTable).flat();

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="query-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.8rem', margin: 0 }}>
                        <Database className="text-primary" /> Consultas Variables
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>Cruza tablas, añade condiciones y exporta tus informes.</p>
                </div>
                {results.length > 0 && (
                    <button className="btn btn-primary" onClick={exportToExcel} style={{ background: '#107c41', borderColor: '#107c41' }}>
                        <Download size={18} /> Exportar Excel
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Sidebar: Table Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>
                    <div className="glass-card" style={{ padding: '1.2rem' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                            <TableIcon size={16} /> Tablas
                        </h3>
                        <div style={{ position: 'relative', marginBottom: '1rem' }}>
                            <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Filtrar tablas..."
                                className="form-control"
                                style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)' }}
                                value={tableSearchTerm}
                                onChange={(e) => setTableSearchTerm(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {Object.keys(schema)
                                .filter(tableName => normalizeString(tableName).includes(normalizeString(tableSearchTerm)))
                                .map(tableName => (
                                    <div key={tableName}>
                                        <div
                                            onClick={() => toggleTable(tableName)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                padding: '0.6rem',
                                                borderRadius: '6px',
                                                background: selectedTables.includes(tableName) ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                                border: '1px solid',
                                                borderColor: selectedTables.includes(tableName) ? 'var(--primary)' : 'transparent'
                                            }}
                                        >
                                            <span style={{ fontSize: '0.9rem', fontWeight: selectedTables.includes(tableName) ? '600' : '400' }}>{tableName}</span>
                                            {selectedTables.includes(tableName) ? <Check size={14} className="text-primary" /> : <Plus size={14} style={{ opacity: 0.3 }} />}
                                        </div>

                                        <AnimatePresence>
                                            {selectedTables.includes(tableName) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    style={{ overflow: 'hidden', marginLeft: '0.8rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
                                                >
                                                    {schema[tableName].map(colName => (
                                                        <label key={colName} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', padding: '0.2rem', cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={(selectedColumns[tableName] || []).includes(colName)}
                                                                onChange={() => toggleColumn(tableName, colName)}
                                                                style={{ accentColor: 'var(--primary)' }}
                                                            />
                                                            <span style={{ color: (selectedColumns[tableName] || []).includes(colName) ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                                {colName}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
                        onClick={runQuery}
                        disabled={!generatedSql || loading}
                    >
                        {loading ? 'Consultando...' : <><Play size={18} /> Ejecutar Informe</>}
                    </button>
                </div>

                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Filters Section */}
                    <div className="glass-card" style={{ padding: '1.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <Filter size={18} className="text-primary" /> Filtros y Condiciones
                            </h3>
                            <button className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)' }} onClick={addFilter}>
                                <Plus size={14} /> Añadir Filtro
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {filters.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No hay filtros aplicados. Se mostrarán todos los registros.</p>}
                            {filters.map((f, idx) => (
                                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 40px', gap: '0.8rem', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '0.6rem', borderRadius: '8px' }}>
                                    <select className="form-control" value={f.table} onChange={e => updateFilter(f.id, 'table', e.target.value)} style={{ padding: '0.4rem' }}>
                                        <option value="">Seleccionar Tabla</option>
                                        {selectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>

                                    <select className="form-control" value={f.column} onChange={e => updateFilter(f.id, 'column', e.target.value)} disabled={!f.table} style={{ padding: '0.4rem' }}>
                                        <option value="">Campo</option>
                                        {f.table && schema[f.table]?.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>

                                    <select className="form-control" value={f.operator} onChange={e => updateFilter(f.id, 'operator', e.target.value)} style={{ padding: '0.4rem' }}>
                                        {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                    </select>

                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Valor..."
                                        value={f.value}
                                        onChange={e => updateFilter(f.id, 'value', e.target.value)}
                                        disabled={f.operator.includes('NULL')}
                                        style={{ padding: '0.4rem' }}
                                    />

                                    <button className="btn" style={{ color: '#ef4444', padding: '0.4rem', background: 'transparent' }} onClick={() => removeFilter(f.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SQL Preview & Debug */}
                    <div className="glass-card" style={{ padding: '1.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Settings size={14} /> SENTENCIA SQL
                            </span>
                        </div>
                        <code style={{
                            display: 'block',
                            padding: '1rem',
                            borderRadius: '10px',
                            background: 'rgba(0, 0, 0, 0.15)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            whiteSpace: 'pre-wrap',
                            border: '1px solid var(--border-card)',
                            fontFamily: 'Questrial',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            {generatedSql || '-- Selecciona tablas y campos para comenzar --'}
                        </code>
                    </div>

                    {error && (
                        <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Results Table */}
                    <div className="glass-card" style={{ minHeight: '400px', overflowX: 'auto', padding: 0 }}>
                        {!loading && results.length === 0 && !error && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
                                <Search size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                <p style={{ fontSize: '0.9rem' }}>Los resultados aparecerán aquí tras ejecutar la consulta.</p>
                            </div>
                        )}

                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div className="loader"></div>
                            </div>
                        )}

                        {!loading && results.length > 0 && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                                <thead>
                                    {/* Table Names Header */}
                                    <tr>
                                        {Object.entries(columnsByTable).map(([table, cols]) => (
                                            <th
                                                key={table}
                                                colSpan={cols.length}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    textAlign: 'center',
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--primary)',
                                                    borderBottom: '1px solid var(--border-card)',
                                                    background: 'rgba(99, 102, 241, 0.05)',
                                                    fontWeight: '700',
                                                    letterSpacing: '0.05em'
                                                }}
                                            >
                                                {table}
                                            </th>
                                        ))}
                                    </tr>
                                    {/* Column Names Header */}
                                    <tr>
                                        {flatColumns.map(({ key, col }) => (
                                            <th
                                                key={key}
                                                onClick={() => handleSort(key)}
                                                style={{
                                                    padding: '0.8rem 1rem',
                                                    textAlign: 'left',
                                                    fontSize: '0.75rem',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--text-muted)',
                                                    borderBottom: '2px solid var(--border-card)',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    transition: 'all 0.2s'
                                                }}
                                                className="hover-header"
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {col}
                                                    <span style={{ fontSize: '10px', opacity: sortConfig.key === key ? 1 : 0.2 }}>
                                                        {sortConfig.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedResults.map((row, idx) => (
                                        <tr key={idx} className="table-row-hover">
                                            {flatColumns.map(({ key }, i) => {
                                                let val = row[key];
                                                let displayVal = val !== null && val !== undefined ? val.toString() : '';

                                                if (key.toUpperCase().includes('PRESUPUESTO') && val !== null && val !== '') {
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num)) {
                                                        displayVal = num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
                                                    }
                                                } else if (val && typeof val === 'string' && val.includes('-') && !isNaN(Date.parse(val)) && (val.length === 10 || val.includes('T'))) {
                                                    // Detect ISO-like dates (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
                                                    displayVal = formatDate(val);
                                                }

                                                return (
                                                    <td key={i} style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                                        {displayVal}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {!loading && results.length > 0 && (
                        <div style={{
                            display: 'flex',
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
                                    style={{ width: '80px', padding: '0.3rem', fontSize: '0.85rem' }}
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
                                    <span style={{ marginLeft: '0.8rem', opacity: 0.6 }}>({results.length} resultados totales)</span>
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
                </div>
            </div>

            <style>{`
                .loader {
                    border: 3px solid rgba(255, 255, 255, 0.1);
                    border-left-color: var(--primary);
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .text-primary { color: var(--primary); }
                .form-control:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }
                .hover-header:hover {
                    background: rgba(255, 255, 255, 0.05) !important;
                    color: var(--text-main) !important;
                }
                .table-row-hover:hover {
                    background: rgba(255, 255, 255, 0.02);
                }
            `}</style>
        </motion.div>
    );
};

export default QueryPage;
