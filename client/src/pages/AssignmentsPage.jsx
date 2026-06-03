import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Trash2, Edit2, X, Save, ChevronUp, ChevronDown, Search } from 'lucide-react';
import api from '../api';
import { normalizeString, formatDate } from '../utils';

const AssignmentsPage = () => {
    const [encargos, setEncargos] = useState([]);
    const [personal, setPersonal] = useState([]);
    const [selectedEncargo, setSelectedEncargo] = useState('');
    const [assignments, setAssignments] = useState([]);
    const [newAssignment, setNewAssignment] = useState({ REF_PER: '', ALTA: '', BAJA: '', PORCENTAJE: 100, RTP: 'N' });
    const [searchTerm, setSearchTerm] = useState('');
    const [editingRefPer, setEditingRefPer] = useState(null);
    const [searchEncargo, setSearchEncargo] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'NOMBRE_COMPLETO', direction: 'ascending' });
    const [showOnlyActive, setShowOnlyActive] = useState(true);

    useEffect(() => {
        const loadInitial = async () => {
            const [e, pers] = await Promise.all([api.getEncargos(), api.getPersonal()]);
            // Sort encargos by CODIGOPR
            const sortedEncargos = e.data.sort((a, b) => {
                if (a.CODIGOPR < b.CODIGOPR) return -1;
                if (a.CODIGOPR > b.CODIGOPR) return 1;
                return 0;
            });
            setEncargos(sortedEncargos);
            // Filter only active staff for assignments
            setPersonal(pers.data.filter(p => p.ACTIVO === 'S'));
        };
        loadInitial();
    }, []);

    const filteredPersonal = personal
        .filter(p => {
            // If editing, include the current person being edited so they show up (or just disable the select)
            if (editingRefPer && p.REF_PER === editingRefPer) return true;
            return !assignments.some(a => a.REF_PER === p.REF_PER);
        })
        .filter(p =>
            normalizeString(`${p.NOMBRE || ''} ${p.APELLIDO1 || ''} ${p.APELLIDO2 || ''}`).includes(normalizeString(searchTerm))
        )
        .sort((a, b) => {
            const nameA = `${a.APELLIDO1} ${a.APELLIDO2}`.toLowerCase();
            const nameB = `${b.APELLIDO1} ${b.APELLIDO2}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });

    useEffect(() => {
        if (selectedEncargo) {
            loadAssignments();
            setAssignments([]);
            setEditingRefPer(null);
            setNewAssignment({ REF_PER: '', ALTA: '', BAJA: '', PORCENTAJE: 100, RTP: 'N' });
        }
    }, [selectedEncargo]);

    const loadAssignments = async () => {
        try {
            const res = await api.getAssignments(selectedEncargo);
            setAssignments(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const sortedAssignments = React.useMemo(() => {
        let sortableItems = [...assignments];

        // Filter by BAJA if showOnlyActive is true
        if (showOnlyActive) {
            sortableItems = sortableItems.filter(a => !a.BAJA);
        }

        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'NOMBRE_COMPLETO') {
                    aValue = `${a.APELLIDO1 || ''} ${a.APELLIDO2 || ''} ${a.NOMBRE || ''}`.trim().toLowerCase();
                    bValue = `${b.APELLIDO1 || ''} ${b.APELLIDO2 || ''} ${b.NOMBRE || ''}`.trim().toLowerCase();
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];

                    // Handle nulls for dates or other fields
                    if (aValue === null || aValue === undefined) aValue = '';
                    if (bValue === null || bValue === undefined) bValue = '';

                    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                    if (typeof bValue === 'string') bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [assignments, sortConfig, showOnlyActive]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...newAssignment, CODIGOPR: selectedEncargo };

            // Sanitize dates
            if (payload.ALTA === '') payload.ALTA = null;
            else if (typeof payload.ALTA === 'string') payload.ALTA = payload.ALTA.split('T')[0];

            if (payload.BAJA === '') payload.BAJA = null;
            else if (typeof payload.BAJA === 'string') payload.BAJA = payload.BAJA.split('T')[0];

            if (editingRefPer) {
                await api.updateAssignment(payload);
                setEditingRefPer(null);
            } else {
                await api.createAssignment(payload);
            }
            setNewAssignment({ REF_PER: '', ALTA: '', BAJA: '', PORCENTAJE: 100, RTP: 'N' });
            loadAssignments();
        } catch (err) {
            console.error(err);
            alert("Error: " + (err.response?.data?.error || err.message));
        }
    };

    const handleEdit = (assignment) => {
        setEditingRefPer(assignment.REF_PER);
        setNewAssignment({
            REF_PER: assignment.REF_PER,
            ALTA: assignment.ALTA ? assignment.ALTA.split('T')[0] : '',
            BAJA: assignment.BAJA ? assignment.BAJA.split('T')[0] : '',
            PORCENTAJE: assignment.PORCENTAJE,
            RTP: assignment.RTP || 'N'
        });
    };

    const cancelEdit = () => {
        setEditingRefPer(null);
        setNewAssignment({ REF_PER: '', ALTA: '', BAJA: '', PORCENTAJE: 100, RTP: 'N' });
    };

    const handleDelete = async (ref_per) => {
        if (window.confirm("¿Quitar personal del encargo?")) {
            await api.deleteAssignment(ref_per, selectedEncargo);
            loadAssignments();
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Asignaciones de Personal</h2>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', marginTop: '1.5rem' }}>
                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Buscar/Filtrar Encargo:</p>
                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Filtrar por código o nombre..."
                            value={searchEncargo}
                            onChange={e => setSearchEncargo(e.target.value)}
                            style={{ paddingLeft: '2.5rem', height: '42px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)' }}
                        />
                    </div>
                </div>
                <div className="glass-card" style={{ flex: 1, padding: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Seleccionar Encargo:</p>
                    <select className="form-control" value={selectedEncargo} onChange={e => setSelectedEncargo(e.target.value)} style={{ height: '42px', fontSize: '0.9rem' }}>
                        <option value="">-- Seleccione un encargo --</option>
                        {encargos
                            .filter(e => {
                                if (!searchEncargo) return true;
                                const s = normalizeString(searchEncargo);
                                return normalizeString(e.CODIGOPR || '').includes(s) ||
                                    normalizeString(e.NOMBRE || '').includes(s);
                            })
                            .map(e => (
                                <option key={e.CODIGOPR} value={e.CODIGOPR}>{e.CODIGOPR} - {e.NOMBRE}</option>
                            ))}
                    </select>
                </div>
            </div>

            {selectedEncargo && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                    <div className="glass-card">
                        <h3>{editingRefPer ? 'Editar Asignación' : 'Asignar Personal'}</h3>
                        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                            <div className="form-group">
                                <label>Buscar Persona</label>
                                {!editingRefPer && (
                                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Nombre o apellido..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                )}
                                <select
                                    className="form-control"
                                    value={newAssignment.REF_PER}
                                    onChange={e => setNewAssignment({ ...newAssignment, REF_PER: e.target.value })}
                                    required
                                    disabled={!!editingRefPer}
                                >
                                    <option value="">-- Seleccione persona --</option>
                                    {personal
                                        .filter(p => editingRefPer ? p.REF_PER === editingRefPer : !assignments.some(a => a.REF_PER === p.REF_PER))
                                        .filter(p => editingRefPer ? true : normalizeString(`${p.NOMBRE || ''} ${p.APELLIDO1 || ''} ${p.APELLIDO2 || ''}`).includes(normalizeString(searchTerm)))
                                        .map(p => (
                                            <option key={p.REF_PER} value={p.REF_PER}>{p.NOMBRE} {p.APELLIDO1} {p.APELLIDO2} ({p.PERFIL})</option>
                                        ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Alta</label>
                                <input type="date" className="form-control" value={newAssignment.ALTA} onChange={e => setNewAssignment({ ...newAssignment, ALTA: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Baja</label>
                                <input type="date" className="form-control" value={newAssignment.BAJA} onChange={e => setNewAssignment({ ...newAssignment, BAJA: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Porcentaje (%)</label>
                                <input type="number" className="form-control" value={newAssignment.PORCENTAJE} onChange={e => setNewAssignment({ ...newAssignment, PORCENTAJE: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>RTP</label>
                                <select className="form-control" value={newAssignment.RTP} onChange={e => setNewAssignment({ ...newAssignment, RTP: e.target.value })} >
                                    <option value="S">S</option>
                                    <option value="N">N</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    {editingRefPer ? <Save size={18} /> : <UserPlus size={18} />}
                                    {editingRefPer ? 'Guardar Cambios' : 'Asignar'}
                                </button>
                                {editingRefPer && (
                                    <button type="button" className="btn" onClick={cancelEdit} style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                                        <X size={18} /> Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Personal Asignado ({sortedAssignments.length})</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                                <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={showOnlyActive}
                                        onChange={(e) => setShowOnlyActive(e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    Solo activos
                                </label>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort('NOMBRE_COMPLETO')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            Nombre {getSortIcon('NOMBRE_COMPLETO')}
                                        </div>
                                    </th>
                                    <th onClick={() => requestSort('PERFIL')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            Perfil {getSortIcon('PERFIL')}
                                        </div>
                                    </th>
                                    <th onClick={() => requestSort('ALTA')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            Alta {getSortIcon('ALTA')}
                                        </div>
                                    </th>
                                    <th onClick={() => requestSort('BAJA')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            Baja {getSortIcon('BAJA')}
                                        </div>
                                    </th>
                                    <th onClick={() => requestSort('PORCENTAJE')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            % {getSortIcon('PORCENTAJE')}
                                        </div>
                                    </th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAssignments.map(a => (
                                    <tr key={a.REF_PER} style={{ fontWeight: a.RTP === 'S' ? 'bold' : 'normal' }}>
                                        <td>{a.NOMBRE} {a.APELLIDO1} {a.APELLIDO2}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{a.PERFIL}</td>
                                        <td>{formatDate(a.ALTA)}</td>
                                        <td>{formatDate(a.BAJA)}</td>
                                        <td>{a.PORCENTAJE}%</td>

                                        <td>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <button className="btn" style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.2)' }} onClick={() => handleEdit(a)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.2)' }} onClick={() => handleDelete(a.REF_PER)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {assignments.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay personal asignado</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default AssignmentsPage;
