import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';
import api from '../api';
import { normalizeString, formatDate } from '../utils';

const EncargosPage = () => {
    const [data, setData] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        CODIGOPR: '', NOMBRE: '', AREA: '', INICIO: '', FIN: '', CLIENTE: '', FIN_REAL: '', PRESUPUESTO: '', DESCRIPCION: '', INFOR: ''
    });

    // Pagination and Sort state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [sortConfig, setSortConfig] = useState({ key: 'CODIGOPR', direction: 'asc' });
    const [visibleColumns, setVisibleColumns] = useState(['CODIGOPR', 'NOMBRE', 'AREA', 'CLIENTE', 'PRESUPUESTO', 'INICIO', 'FIN', 'INFOR']);
    const [inforFilter, setInforFilter] = useState('S'); // 'S', 'N', 'BOTH'
    const [finRealFilter, setFinRealFilter] = useState('NULL'); // 'NULL', 'NOT_NULL', 'BOTH'
    const [searchTerm, setSearchTerm] = useState('');

    const allColumns = [
        { id: 'CODIGOPR', label: 'Código', key: 'CODIGOPR' },
        { id: 'NOMBRE', label: 'Nombre', key: 'NOMBRE' },
        { id: 'AREA', label: 'Área', key: 'AREA' },
        { id: 'CLIENTE', label: 'Cliente', key: 'CLIENTE' },
        { id: 'INICIO', label: 'Inicio', key: 'INICIO' },
        { id: 'FIN', label: 'Fin', key: 'FIN' },
        { id: 'FIN_REAL', label: 'Fin Real', key: 'FIN_REAL' },
        { id: 'PRESUPUESTO', label: 'Presupuesto', key: 'PRESUPUESTO' },

        { id: 'DESCRIPCION', label: 'Descripción', key: 'DESCRIPCION' },
        { id: 'INFOR', label: 'Infor', key: 'INFOR' }
    ];

    const loadData = async () => {
        try {
            const res = await api.getEncargos();
            // Initial sort by CODIGOPR asc
            const sortedData = res.data.sort((a, b) => {
                if (a.CODIGOPR < b.CODIGOPR) return -1;
                if (a.CODIGOPR > b.CODIGOPR) return 1;
                return 0;
            });
            setData(sortedData);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleColumn = (colId) => {
        setVisibleColumns(prev =>
            prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
        );
    };

    const filteredData = data.filter(item => {
        const matchesInfor = inforFilter === 'BOTH' || item.INFOR === inforFilter;
        const matchesFinReal = finRealFilter === 'BOTH' ||
            (finRealFilter === 'NULL' ? !item.FIN_REAL : !!item.FIN_REAL);
        const s = normalizeString(searchTerm);
        const matchesSearch = searchTerm === '' ||
            normalizeString(item.CODIGOPR || '').includes(s) ||
            normalizeString(item.NOMBRE || '').includes(s) ||
            normalizeString(item.CLIENTE || '').includes(s);
        return matchesInfor && matchesFinReal && matchesSearch;
    });

    const sortedData = [...filteredData].sort((a, b) => {
        const key = sortConfig.key;
        const direction = sortConfig.direction;

        let valA = a[key];
        let valB = b[key];

        // Handle nulls
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        // Handle numbers
        if (typeof valA === 'number' && typeof valB === 'number') {
            // already numbers
        } else if (!isNaN(Number(valA)) && !isNaN(Number(valB)) && valA !== '' && valB !== '') {
            valA = Number(valA);
            valB = Number(valB);
        } else {
            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = sortedData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };

            // Sanitize numeric fields
            if (payload.PRESUPUESTO === '' || payload.PRESUPUESTO === null || payload.PRESUPUESTO === undefined) {
                payload.PRESUPUESTO = null;
            } else {
                payload.PRESUPUESTO = parseFloat(payload.PRESUPUESTO);
            }

            // Sanitize date fields to ensure YYYY-MM-DD format
            const sanitizeDate = (dateVal) => {
                if (!dateVal) return null;
                if (typeof dateVal === 'string') {
                    return dateVal.split('T')[0];
                }
                return null;
            };

            payload.INICIO = sanitizeDate(payload.INICIO);
            payload.FIN = sanitizeDate(payload.FIN);
            payload.FIN_REAL = sanitizeDate(payload.FIN_REAL);

            if (editingItem) {
                await api.updateEncargo(payload);
            } else {
                await api.createEncargo(payload);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ CODIGOPR: '', NOMBRE: '', AREA: '', INICIO: '', FIN: '', CLIENTE: '', FIN_REAL: '', PRESUPUESTO: '', DESCRIPCION: '', INFOR: '' });
            loadData();
        } catch (err) {
            console.error(err);
            alert("Error al guardar: " + (err.response?.data?.error || err.message));
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Seguro que desea eliminar?")) {
            try {
                await api.deleteEncargo(id);
                loadData();
            } catch (err) {
                alert("Error al eliminar: " + err.message);
            }
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Gestión de Encargos</h2>
                <button className="btn btn-primary" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
                    <Plus size={20} /> Nuevo Encargo
                </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.2rem' }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.6rem', color: 'var(--text-muted)', fontWeight: '500' }}>Buscar Encargo:</p>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por código, nombre o cliente..."
                            className="form-control"
                            style={{
                                paddingLeft: '3rem',
                                height: '50px',
                                fontSize: '1rem',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border-card)',
                                borderRadius: '12px'
                            }}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Filtro Gestión Directa:</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => { setInforFilter('S'); setCurrentPage(1); }}
                            className={`btn ${inforFilter === 'S' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: inforFilter === 'S' ? '' : 'rgba(255,255,255,0.05)', color: inforFilter === 'S' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            'S'
                        </button>
                        <button
                            onClick={() => { setInforFilter('N'); setCurrentPage(1); }}
                            className={`btn ${inforFilter === 'N' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: inforFilter === 'N' ? '' : 'rgba(255,255,255,0.05)', color: inforFilter === 'N' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            'N'
                        </button>
                        <button
                            onClick={() => { setInforFilter('BOTH'); setCurrentPage(1); }}
                            className={`btn ${inforFilter === 'BOTH' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: inforFilter === 'BOTH' ? '' : 'rgba(255,255,255,0.05)', color: inforFilter === 'BOTH' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            Ambos
                        </button>
                    </div>
                </div>

                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Filtro Fin Real:</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => { setFinRealFilter('NULL'); setCurrentPage(1); }}
                            className={`btn ${finRealFilter === 'NULL' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: finRealFilter === 'NULL' ? '' : 'rgba(255,255,255,0.05)', color: finRealFilter === 'NULL' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            Nulo
                        </button>
                        <button
                            onClick={() => { setFinRealFilter('NOT_NULL'); setCurrentPage(1); }}
                            className={`btn ${finRealFilter === 'NOT_NULL' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: finRealFilter === 'NOT_NULL' ? '' : 'rgba(255,255,255,0.05)', color: finRealFilter === 'NOT_NULL' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            No Nulo
                        </button>
                        <button
                            onClick={() => { setFinRealFilter('BOTH'); setCurrentPage(1); }}
                            className={`btn ${finRealFilter === 'BOTH' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: finRealFilter === 'BOTH' ? '' : 'rgba(255,255,255,0.05)', color: finRealFilter === 'BOTH' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            Ambos
                        </button>
                    </div>
                </div>

                <div className="glass-card" style={{ flex: 1.5, padding: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Columnas Dinámicas:</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {allColumns.map(col => (
                            <button
                                key={col.id}
                                onClick={() => toggleColumn(col.id)}
                                style={{
                                    padding: '0.3rem 0.6rem',
                                    fontSize: '0.85rem',
                                    borderRadius: '4px',
                                    background: visibleColumns.includes(col.id) ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                    color: visibleColumns.includes(col.id) ? '#ffffff' : 'var(--text-muted)',
                                    border: '1px solid var(--border-card)',
                                    cursor: 'pointer'
                                }}
                            >
                                {col.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass-card">
                <table style={{ minWidth: '1000px' }}> {/* Ensure table doesn't squash too much */}
                    <thead>
                        <tr>
                            {allColumns.filter(c => visibleColumns.includes(c.id)).map(col => (
                                <th
                                    key={col.id}
                                    onClick={() => handleSort(col.id)}
                                    style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {col.label}
                                        {sortConfig.key === col.id ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        ) : (
                                            <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map(item => (
                            <tr key={item.CODIGOPR}>
                                {visibleColumns.includes('CODIGOPR') && <td>{item.CODIGOPR}</td>}
                                {visibleColumns.includes('NOMBRE') && <td>{item.NOMBRE}</td>}
                                {visibleColumns.includes('AREA') && <td>{item.AREA}</td>}
                                {visibleColumns.includes('CLIENTE') && <td>{item.CLIENTE}</td>}
                                {visibleColumns.includes('INICIO') && <td>{formatDate(item.INICIO)}</td>}
                                {visibleColumns.includes('FIN') && <td>{formatDate(item.FIN)}</td>}
                                {visibleColumns.includes('FIN_REAL') && <td>{formatDate(item.FIN_REAL)}</td>}
                                {visibleColumns.includes('PRESUPUESTO') && <td>{item.PRESUPUESTO?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>}
                                {visibleColumns.includes('DESCRIPCION') && <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.DESCRIPCION}>{item.DESCRIPCION}</td>}
                                {visibleColumns.includes('INFOR') && <td>{item.INFOR}</td>}
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn" style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.2)' }} onClick={() => handleEdit(item)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.2)' }} onClick={() => handleDelete(item.CODIGOPR)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

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
                            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                            <span style={{ marginLeft: '0.8rem', opacity: 0.6 }}>({filteredData.length} encargos)</span>
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

            <AnimatePresence>
                {isModalOpen && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3>{editingItem ? 'Editar Encargo' : 'Nuevo Encargo'}</h3>
                                <X size={24} style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)} />
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Código</label>
                                    <input className="form-control" value={formData.CODIGOPR} onChange={e => setFormData({ ...formData, CODIGOPR: e.target.value })} disabled={editingItem} required />
                                </div>
                                <div className="form-group">
                                    <label>Nombre</label>
                                    <input className="form-control" value={formData.NOMBRE} onChange={e => setFormData({ ...formData, NOMBRE: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Área</label>
                                    <input className="form-control" value={formData.AREA} onChange={e => setFormData({ ...formData, AREA: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Inicio</label>
                                        <input type="date" className="form-control" value={formData.INICIO?.split('T')[0] || ''} onChange={e => setFormData({ ...formData, INICIO: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Fin</label>
                                        <input type="date" className="form-control" value={formData.FIN?.split('T')[0] || ''} onChange={e => setFormData({ ...formData, FIN: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Cliente</label>
                                    <input className="form-control" value={formData.CLIENTE} onChange={e => setFormData({ ...formData, CLIENTE: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Fin Real</label>
                                    <input type="date" className="form-control" value={formData.FIN_REAL?.split('T')[0] || ''} onChange={e => setFormData({ ...formData, FIN_REAL: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Presupuesto</label>
                                    <input type="number" step="0.01" className="form-control" value={formData.PRESUPUESTO} onChange={e => setFormData({ ...formData, PRESUPUESTO: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Descripción</label>
                                    <textarea className="form-control" value={formData.DESCRIPCION} onChange={e => setFormData({ ...formData, DESCRIPCION: e.target.value })} rows="3" />
                                </div>
                                <div className="form-group">
                                    <label>Infor</label>
                                    <input className="form-control" value={formData.INFOR} onChange={e => setFormData({ ...formData, INFOR: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                    {editingItem ? 'Actualizar' : 'Crear'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default EncargosPage;
