import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';
import api from '../api';
import { normalizeString, formatDate } from '../utils';
import { useAuth } from '../AuthContext';

const PersonalPage = () => {
    const { isReadOnly } = useAuth();
    const canManage = !isReadOnly;
    const [data, setData] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const initialFormState = {
        REF_PER: '', NOMBRE: '', APELLIDO1: '', APELLIDO2: '', PERFIL: '', BAJA: '', USUARIO: '',
        TELEFONO_1: '', TELEFONO_2: '', ACTIVO: 'S', RESP: 'N', NIF: '', PLANTILLA: 'N',
        REF_UBI: 1, SITUACION: 'P', INCORPORACION: '', N_FICHA: '', F_CONTRATO: '', REF_TIT: '', IDEMPLEADO: ''
    };
    const [formData, setFormData] = useState(initialFormState);
    const [filterActive, setFilterActive] = useState('S');
    const [searchTerm, setSearchTerm] = useState('');
    const [locations, setLocations] = useState([]);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [visibleColumns, setVisibleColumns] = useState(['REF_PER', 'IDEMPLEADO', 'NOMBRE', 'APELLIDOS', 'PERFIL', 'ACTIVO', 'NIF']);
    const [allColumns] = useState([
        { id: 'REF_PER', label: 'Ref', key: 'REF_PER' },
        { id: 'N_FICHA', label: 'Ficha', key: 'N_FICHA' },
        { id: 'IDEMPLEADO', label: 'ID Empleado', key: 'IDEMPLEADO' },
        { id: 'NOMBRE', label: 'Nombre', key: 'NOMBRE' },
        { id: 'APELLIDOS', label: 'Apellidos', key: 'APELLIDOS' },
        { id: 'PERFIL', label: 'Perfil', key: 'PERFIL' },
        { id: 'ACTIVO', label: 'Activo', key: 'ACTIVO' },
        { id: 'USUARIO', label: 'Usuario', key: 'USUARIO' },
        { id: 'NIF', label: 'NIF', key: 'NIF' },
        { id: 'TELEFONO_1', label: 'Tel 1', key: 'TELEFONO_1' },
        { id: 'INCORPORACION', label: 'Incorporación', key: 'INCORPORACION' },
        { id: 'BAJA', label: 'Baja', key: 'BAJA' }
    ]);
    const [sortConfig, setSortConfig] = useState({ key: 'INCORPORACION', direction: 'desc' });

    const loadData = async () => {
        try {
            const res = await api.getPersonal();
            setData(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadLocations = async () => {
        try {
            const res = await api.getUbicacion();
            setLocations(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadData();
        loadLocations();
    }, []);

    const filteredData = data.filter(item => {
        let matchesFilter = true;
        if (filterActive !== 'ALL') {
            matchesFilter = item.ACTIVO === filterActive;
        }

        if (!matchesFilter) return false;

        if (searchTerm) {
            const searchLower = normalizeString(searchTerm);
            const fullName = normalizeString(`${item.NOMBRE || ''} ${item.APELLIDO1 || ''} ${item.APELLIDO2 || ''}`);
            return (
                fullName.includes(searchLower) ||
                normalizeString(item.USUARIO || '').includes(searchLower) ||
                normalizeString(item.NIF || '').includes(searchLower) ||
                (item.REF_PER || '').toString().includes(searchLower)
            );
        }

        return true;
    });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedFilteredData = [...filteredData].sort((a, b) => {
        const key = sortConfig.key;
        const direction = sortConfig.direction;

        let valA, valB;

        if (key === 'APELLIDOS') {
            valA = `${a.APELLIDO1 || ''} ${a.APELLIDO2 || ''}`.trim().toLowerCase();
            valB = `${b.APELLIDO1 || ''} ${b.APELLIDO2 || ''}`.trim().toLowerCase();
        } else if (key === 'INCORPORACION' || key === 'BAJA') {
            valA = new Date(a[key] || 0).getTime();
            valB = new Date(b[key] || 0).getTime();
        } else {
            valA = a[key];
            valB = b[key];

            // Handle numbers represented as strings
            if (valA !== null && valA !== undefined && valB !== null && valB !== undefined) {
                if (!isNaN(valA) && !isNaN(valB) && (typeof valA !== 'string' || valA.trim() !== '') && (typeof valB !== 'string' || valB.trim() !== '')) {
                    valA = Number(valA);
                    valB = Number(valB);
                } else {
                    valA = valA.toString().toLowerCase();
                    valB = valB.toString().toLowerCase();
                }
            } else {
                valA = valA || '';
                valB = valB || '';
            }
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Reset to first page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filterActive]);

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = sortedFilteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const toggleColumn = (colId) => {
        setVisibleColumns(prev =>
            prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canManage) {
            alert('No tienes permisos para modificar personal.');
            return;
        }
        try {
            const payload = { ...formData };

            // Helper sanitizers
            const sanitizeDate = (val) => (!val ? null : (typeof val === 'string' ? val.split('T')[0] : null));
            const sanitizeNum = (val) => (val === '' ? null : val);

            payload.INCORPORACION = sanitizeDate(payload.INCORPORACION);
            payload.F_CONTRATO = sanitizeDate(payload.F_CONTRATO);
            payload.BAJA = sanitizeDate(payload.BAJA);

            payload.REF_PER = sanitizeNum(payload.REF_PER);
            payload.N_FICHA = sanitizeNum(payload.N_FICHA);
            payload.REF_UBI = sanitizeNum(payload.REF_UBI);
            payload.REF_TIT = sanitizeNum(payload.REF_TIT);

            if (editingItem) {
                await api.updatePersonal(payload);
            } else {
                await api.createPersonal(payload);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData(initialFormState);
            loadData();
        } catch (err) {
            console.error(err);
            alert("Error al guardar: " + (err.response?.data?.error || err.message));
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Lista de Personal</h2>
                {canManage && (
                    <button className="btn btn-primary" onClick={() => { setEditingItem(null); setFormData(initialFormState); setIsModalOpen(true); }}>
                        <Plus size={20} /> Nuevo Personal
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Buscar Personal:</p>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Nombre, usuario o NIF..."
                            className="form-control"
                            style={{ paddingLeft: '2.5rem', height: '38px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)' }}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>

                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Filtrar Estado:</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => { setFilterActive('S'); setCurrentPage(1); }}
                            className={`btn ${filterActive === 'S' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: filterActive === 'S' ? '' : 'rgba(255,255,255,0.05)', color: filterActive === 'S' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            Activos
                        </button>
                        <button
                            onClick={() => { setFilterActive('N'); setCurrentPage(1); }}
                            className={`btn ${filterActive === 'N' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: filterActive === 'N' ? '' : 'rgba(255,255,255,0.05)', color: filterActive === 'N' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            Bajas
                        </button>
                        <button
                            onClick={() => { setFilterActive('ALL'); setCurrentPage(1); }}
                            className={`btn ${filterActive === 'ALL' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', flex: 1, background: filterActive === 'ALL' ? '' : 'rgba(255,255,255,0.05)', color: filterActive === 'ALL' ? '' : 'var(--text-muted)', border: '1px solid var(--border-card)' }}
                        >
                            Todos
                        </button>
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
                <table>
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
                            <tr key={item.REF_PER}>
                                {visibleColumns.includes('REF_PER') && <td>{item.REF_PER}</td>}
                                {visibleColumns.includes('N_FICHA') && <td>{item.N_FICHA}</td>}
                                {visibleColumns.includes('IDEMPLEADO') && <td>{item.IDEMPLEADO}</td>}
                                {visibleColumns.includes('NOMBRE') && <td>{item.NOMBRE}</td>}
                                {visibleColumns.includes('APELLIDOS') && <td>{item.APELLIDO1} {item.APELLIDO2}</td>}
                                {visibleColumns.includes('PERFIL') && <td>{item.PERFIL}</td>}
                                {visibleColumns.includes('ACTIVO') && <td>{item.ACTIVO === 'S' ? '✅' : '❌'}</td>}
                                {visibleColumns.includes('USUARIO') && <td>{item.USUARIO}</td>}
                                {visibleColumns.includes('NIF') && <td>{item.NIF}</td>}
                                {visibleColumns.includes('TELEFONO_1') && <td>{item.TELEFONO_1}</td>}
                                {visibleColumns.includes('INCORPORACION') && <td>{formatDate(item.INCORPORACION)}</td>}
                                {visibleColumns.includes('BAJA') && <td>{formatDate(item.BAJA)}</td>}
                                <td>
                                    {canManage ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn" style={{ padding: '0.4rem', background: 'rgba(99, 102, 241, 0.2)' }} onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn" style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.2)' }} onClick={async () => { if (window.confirm("¿Eliminar?")) { await api.deletePersonal(item.REF_PER); loadData(); } }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Solo lectura</span>
                                    )}
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
                            <span style={{ marginLeft: '0.8rem', opacity: 0.6 }}>({filteredData.length} personas)</span>
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
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3>{editingItem ? 'Editar Personal' : 'Nuevo Personal'}</h3>
                                <X size={24} style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)} />
                            </div>
                            {!canManage && (
                                <div style={{ marginBottom: '1rem', color: '#fbbf24', fontSize: '0.9rem' }}>
                                    No tienes permisos para modificar personal.
                                </div>
                            )}
                            <form onSubmit={handleSubmit}>
                                <fieldset disabled={!canManage} style={{ border: 'none', margin: 0, padding: 0 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>Ref Personal</label>
                                        <input type="number" className="form-control" value={formData.REF_PER} onChange={e => setFormData({ ...formData, REF_PER: e.target.value })} disabled={editingItem || !canManage} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Nº Ficha</label>
                                        <input type="number" className="form-control" value={formData.N_FICHA} onChange={e => setFormData({ ...formData, N_FICHA: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>ID Empleado</label>
                                        <input className="form-control" value={formData.IDEMPLEADO} onChange={e => setFormData({ ...formData, IDEMPLEADO: e.target.value })} />
                                    </div>

                                    <div className="form-group">
                                        <label>NIF</label>
                                        <input className="form-control" value={formData.NIF} onChange={e => setFormData({ ...formData, NIF: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label>Usuario / Login</label>
                                        <input className="form-control" value={formData.USUARIO} onChange={e => setFormData({ ...formData, USUARIO: e.target.value })} />
                                    </div>

                                    <div className="form-group">
                                        <label>Nombre</label>
                                        <input className="form-control" value={formData.NOMBRE} onChange={e => setFormData({ ...formData, NOMBRE: e.target.value })} required disabled={!canManage} />
                                    </div>
                                    <div className="form-group">
                                        <label>Primer Apellido</label>
                                        <input className="form-control" value={formData.APELLIDO1} onChange={e => setFormData({ ...formData, APELLIDO1: e.target.value })} required disabled={!canManage} />
                                    </div>
                                    <div className="form-group">
                                        <label>Segundo Apellido</label>
                                        <input className="form-control" value={formData.APELLIDO2} onChange={e => setFormData({ ...formData, APELLIDO2: e.target.value })} disabled={!canManage} />
                                    </div>

                                    <div className="form-group">
                                        <label>Perfil</label>
                                        <input className="form-control" value={formData.PERFIL} onChange={e => setFormData({ ...formData, PERFIL: e.target.value })} disabled={!canManage} />
                                    </div>
                                    <div className="form-group">
                                        <label>Teléfono 1</label>
                                        <input className="form-control" value={formData.TELEFONO_1} onChange={e => setFormData({ ...formData, TELEFONO_1: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Teléfono 2</label>
                                        <input className="form-control" value={formData.TELEFONO_2} onChange={e => setFormData({ ...formData, TELEFONO_2: e.target.value })} />
                                    </div>

                                    <div className="form-group">
                                        <label>Activo (S/N)</label>
                                        <select className="form-control" value={formData.ACTIVO} onChange={e => setFormData({ ...formData, ACTIVO: e.target.value })} disabled={!canManage}>
                                            <option value="S">Sí</option>
                                            <option value="N">No</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Es Responsable (S/N)</label>
                                        <select className="form-control" value={formData.RESP} onChange={e => setFormData({ ...formData, RESP: e.target.value })} disabled={!canManage}>
                                            <option value="S">Sí</option>
                                            <option value="N">No</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>En Plantilla (S/N)</label>
                                        <select className="form-control" value={formData.PLANTILLA} onChange={e => setFormData({ ...formData, PLANTILLA: e.target.value })} disabled={!canManage}>
                                            <option value="S">Sí</option>
                                            <option value="N">No</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Lugar (Ubicación)</label>
                                        <select
                                            className="form-control"
                                            value={locations.find(loc => loc.REF_UBI == formData.REF_UBI)?.A_LUGAR || ''}
                                            onChange={(e) => {
                                                const loc = locations.find(l => l.A_LUGAR === e.target.value);
                                                if (loc) setFormData({ ...formData, REF_UBI: loc.REF_UBI });
                                            }}
                                        >
                                            <option value="">Seleccione...</option>
                                            {locations.sort((a, b) => (a.A_LUGAR || '').localeCompare(b.A_LUGAR || '')).map(loc => (
                                                <option key={loc.REF_UBI} value={loc.A_LUGAR}>{loc.A_LUGAR}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Ref Ubicación</label>
                                        <input type="number" className="form-control" value={formData.REF_UBI} onChange={e => setFormData({ ...formData, REF_UBI: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Situación</label>
                                        <input className="form-control" value={formData.SITUACION} onChange={e => setFormData({ ...formData, SITUACION: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Ref Titulación</label>
                                        <input type="number" className="form-control" value={formData.REF_TIT} onChange={e => setFormData({ ...formData, REF_TIT: e.target.value })} />
                                    </div>

                                    <div className="form-group">
                                        <label>Incorporación</label>
                                        <input type="date" className="form-control" value={formData.INCORPORACION?.split('T')[0] || ''} onChange={e => setFormData({ ...formData, INCORPORACION: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>F. Contrato</label>
                                        <input type="date" className="form-control" value={formData.F_CONTRATO?.split('T')[0] || ''} onChange={e => setFormData({ ...formData, F_CONTRATO: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Baja</label>
                                        <input type="date" className="form-control" value={formData.BAJA?.split('T')[0] || ''} onChange={e => setFormData({ ...formData, BAJA: e.target.value })} />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '0.8rem' }} disabled={!canManage}>
                                    {editingItem ? 'Actualizar Registro' : 'Crear Registro'}
                                </button>
                                </fieldset>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default PersonalPage;
