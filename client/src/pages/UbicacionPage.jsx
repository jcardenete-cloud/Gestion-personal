import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';
import api from '../api';
import { normalizeString } from '../utils';

const UbicacionPage = () => {
    const [data, setData] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        REF_UBI: '', A_LUGAR: ''
    });

    // Pagination and Sort state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [sortConfig, setSortConfig] = useState({ key: 'REF_UBI', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');

    // In this simple table, we might just show both columns always, or handle visibility if preferred.
    // For consistency with other pages, let's keep the visibility logic but simple.
    const [visibleColumns, setVisibleColumns] = useState(['REF_UBI', 'A_LUGAR']);

    const allColumns = [
        { id: 'REF_UBI', label: 'Referencia', key: 'REF_UBI', style: { width: '1%', whiteSpace: 'nowrap' } },
        { id: 'A_LUGAR', label: 'Lugar', key: 'A_LUGAR' }
    ];

    const loadData = async () => {
        try {
            const res = await api.getUbicacion();
            // Initial sort handled by backend, but we can re-sort client side if needed
            setData(res.data);
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
        if (!searchTerm) return true;
        const s = normalizeString(searchTerm);
        return normalizeString(item.REF_UBI || '').includes(s) ||
            normalizeString(item.A_LUGAR || '').includes(s);
    });

    const sortedData = [...filteredData].sort((a, b) => {
        const key = sortConfig.key;
        const direction = sortConfig.direction;

        let valA = a[key];
        let valB = b[key];

        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

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
            if (editingItem) {
                await api.updateUbicacion(formData);
            } else {
                await api.createUbicacion(formData);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ REF_UBI: '', A_LUGAR: '' });
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
        if (window.confirm("¿Seguro que desea eliminar esta ubicación?")) {
            try {
                await api.deleteUbicacion(id);
                loadData();
            } catch (err) {
                alert("Error al eliminar: " + err.message);
            }
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Gestión de Ubicaciones</h2>
                <button className="btn btn-primary" onClick={() => { setEditingItem(null); setFormData({ REF_UBI: '', A_LUGAR: '' }); setIsModalOpen(true); }}>
                    <Plus size={20} /> Nueva Ubicación
                </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Buscar Ubicación:</p>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Referencia o lugar..."
                            className="form-control"
                            style={{ paddingLeft: '2.5rem', height: '38px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)' }}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>

                <div className="glass-card" style={{ flex: 2, padding: '1rem' }}>
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
                <table style={{ width: '100%', minWidth: '600px' }}>
                    <thead>
                        <tr>
                            {allColumns.filter(c => visibleColumns.includes(c.id)).map(col => (
                                <th
                                    key={col.id}
                                    onClick={() => handleSort(col.id)}
                                    style={{ cursor: 'pointer', whiteSpace: 'nowrap', ...(col.style || {}) }}
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
                            <th style={{ width: '100px' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map(item => (
                            <tr key={item.REF_UBI}>
                                {visibleColumns.includes('REF_UBI') && <td>{item.REF_UBI}</td>}
                                {visibleColumns.includes('A_LUGAR') && <td>{item.A_LUGAR}</td>}
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn" style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.2)' }} onClick={() => handleEdit(item)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.2)' }} onClick={() => handleDelete(item.REF_UBI)}>
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
                            <span style={{ marginLeft: '0.8rem', opacity: 0.6 }}>({filteredData.length} ubicaciones)</span>
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
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card" style={{ width: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3>{editingItem ? 'Editar Ubicación' : 'Nueva Ubicación'}</h3>
                                <X size={24} style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)} />
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Referencia (Ref Ubi)</label>
                                    <input
                                        className="form-control"
                                        value={formData.REF_UBI}
                                        onChange={e => setFormData({ ...formData, REF_UBI: e.target.value })}
                                        disabled={!!editingItem}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Lugar</label>
                                    <input
                                        className="form-control"
                                        value={formData.A_LUGAR}
                                        onChange={e => setFormData({ ...formData, A_LUGAR: e.target.value })}
                                        required
                                    />
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

export default UbicacionPage;
