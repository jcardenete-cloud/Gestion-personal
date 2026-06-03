import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';
import api from '../api';
import { normalizeString } from '../utils';


const Tooltip = ({ children, content }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            style={{ position: 'relative', display: 'inline-block' }}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onClick={() => setIsVisible(!isVisible)}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            color: '#fff',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            zIndex: 50,
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            pointerEvents: 'none'
                        }}
                    >
                        {content}
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            borderLeft: '4px solid transparent',
                            borderRight: '4px solid transparent',
                            borderTop: '4px solid rgba(15, 23, 42, 0.95)'
                        }} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const PersonalAssignmentsSummaryPage = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [sortConfig, setSortConfig] = useState({ key: 'lastname1', direction: 'asc' }); // Default sort by surname
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch assignments (all), personal (all), and encargos (to get names)
                const [assignsRes, personalRes, encargosRes] = await Promise.all([
                    api.getAssignments(),
                    api.getPersonal(),
                    api.getEncargos()
                ]);

                const assignments = assignsRes.data;
                const personal = personalRes.data;
                const encargos = encargosRes.data;

                // Create Encargo Map
                const encargosMap = {};
                encargos.forEach(e => {
                    encargosMap[e.CODIGOPR] = e.NOMBRE;
                });

                // Process data
                // 1. Group assignments by REF_PER
                const assignmentsByPerson = {};
                assignments.filter(a => !a.BAJA).forEach(a => {
                    if (!assignmentsByPerson[a.REF_PER]) {
                        assignmentsByPerson[a.REF_PER] = {
                            codes: [], // specific objects { code, name }
                            totalPercent: 0
                        };
                    }
                    assignmentsByPerson[a.REF_PER].codes.push({
                        code: a.CODIGOPR,
                        name: encargosMap[a.CODIGOPR] || 'Desconocido'
                    });
                    assignmentsByPerson[a.REF_PER].totalPercent += (parseFloat(a.PORCENTAJE) || 0);
                });

                // 2. Map personal to summary objects
                const summary = personal
                    .filter(p => p.ACTIVO === 'S') // Only active personal
                    .map(p => {
                        const personAssignments = assignmentsByPerson[p.REF_PER];
                        if (!personAssignments) return null; // Skip if no assignments? Request says "que está asignado"

                        return {
                            id: p.REF_PER,
                            lastname1: p.APELLIDO1 || '',
                            lastname2: p.APELLIDO2 || '',
                            name: `${p.NOMBRE} ${p.APELLIDO1 || ''} ${p.APELLIDO2 || ''}`.trim(),
                            perfil: p.PERFIL || '',
                            encargos: personAssignments.codes,
                            totalPercent: personAssignments.totalPercent
                        };
                    })
                    .filter(item => item !== null) // Remove nulls (people with no assignments)
                    .sort((a, b) => {
                        const surNameA = `${a.lastname1} ${a.lastname2}`.trim().toLowerCase();
                        const surNameB = `${b.lastname1} ${b.lastname2}`.trim().toLowerCase();
                        return surNameA.localeCompare(surNameB);
                    });

                setData(summary);
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredData = data.filter(item => {
        if (!searchTerm) return true;
        const s = normalizeString(searchTerm);
        const matchesName = normalizeString(item.name || '').includes(s);
        const matchesPerfil = normalizeString(item.perfil || '').includes(s);
        const matchesEncargos = (item.encargos || []).some(e =>
            normalizeString(e.code || '').includes(s) ||
            normalizeString(e.name || '').includes(s)
        );
        return matchesName || matchesPerfil || matchesEncargos;
    });

    const sortedData = [...filteredData].sort((a, b) => {
        const key = sortConfig.key;
        const direction = sortConfig.direction;

        let valA, valB;

        if (key === 'lastname1') {
            // Sort by full surname string
            valA = `${a.lastname1} ${a.lastname2}`.trim().toLowerCase();
            valB = `${b.lastname1} ${b.lastname2}`.trim().toLowerCase();
        } else if (key === 'encargos') {
            // Sort by number of assignments
            valA = a.encargos.length;
            valB = b.encargos.length;
        } else {
            valA = a[key] || '';
            valB = b[key] || '';
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Resumen de Asignaciones</h2>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Buscar Personal o Encargo:</p>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Nombre, perfil o encargo..."
                            className="form-control"
                            style={{ paddingLeft: '2.5rem', height: '42px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)' }}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>
                <div style={{ flex: 2 }}></div> {/* Spacer */}
            </div>

            <div className="glass-card">
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos...</p>
                ) : (
                    <>
                        <table style={{ minWidth: '100%' }}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('lastname1')} style={{ cursor: 'pointer', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            Nombre y Apellidos
                                            {sortConfig.key === 'lastname1' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('perfil')} style={{ cursor: 'pointer', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            Perfil
                                            {sortConfig.key === 'perfil' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('encargos')} style={{ cursor: 'pointer', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            Encargos Asignados
                                            {sortConfig.key === 'encargos' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('totalPercent')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            % Total Asignación
                                            {sortConfig.key === 'totalPercent' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(item => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: '500' }}>{item.name}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{item.perfil}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {item.encargos.map((encargo, idx) => (
                                                    <Tooltip key={idx} content={encargo.name}>
                                                        <span
                                                            style={{
                                                                fontSize: '0.75rem',
                                                                background: 'rgba(99, 102, 241, 0.1)',
                                                                color: '#818cf8',
                                                                padding: '2px 8px',
                                                                borderRadius: '12px',
                                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                                cursor: 'pointer',
                                                                display: 'inline-block'
                                                            }}
                                                        >
                                                            {encargo.code}
                                                        </span>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: item.totalPercent !== 100 ? '#ef4444' : 'inherit' }}>
                                            {item.totalPercent}%
                                        </td>
                                    </tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                            No se han encontrado resultados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination Controls */}
                        {filteredData.length > 0 && (
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
                                        Página <strong>{currentPage}</strong> de <strong>{Math.ceil(filteredData.length / itemsPerPage)}</strong>
                                        <span style={{ marginLeft: '0.8rem', opacity: 0.6 }}>({filteredData.length} resultados)</span>
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
                                            disabled={currentPage === Math.ceil(filteredData.length / itemsPerPage)}
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredData.length / itemsPerPage)))}
                                            style={{ padding: '0.4rem', opacity: currentPage === Math.ceil(filteredData.length / itemsPerPage) ? 0.3 : 1 }}
                                        >
                                            Siguiente
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
