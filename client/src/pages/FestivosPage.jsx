import React, { useEffect, useState } from 'react';
import api from '../api';
import { Calendar, Plus, Trash2, Edit, X } from 'lucide-react';

const FestivosPage = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [refUbi, setRefUbi] = useState('');
    const [ubicaciones, setUbicaciones] = useState([]);
    const [festivos, setFestivos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ fecha: '', descripcion: '', ref_ubi: '' });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadUbicaciones();
    }, []);

    useEffect(() => {
        loadFestivos();
    }, [year, refUbi]);

    const loadUbicaciones = async () => {
        try {
            const res = await api.getUbicacion();
            setUbicaciones(res.data || []);
        } catch (err) {
            console.error('Error loading ubicaciones', err);
        }
    };

    const loadFestivos = async () => {
        setLoading(true);
        try {
            const res = await api.getFestivos(year, refUbi || null);
            setFestivos(res.data || []);
        } catch (err) {
            console.error('Error loading festivos', err);
            setFestivos([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.fecha) return alert('Seleccione una fecha');
        try {
            const payload = { year: Number(year), ref_ubi: form.ref_ubi || null, fecha: form.fecha, descripcion: form.descripcion };
            if (editingId) {
                await api.updateFestivo({ id_festivo: editingId, ...payload });
                setEditingId(null);
            } else {
                await api.createFestivo(payload);
            }
            setForm({ fecha: '', descripcion: '', ref_ubi: '' });
            loadFestivos();
        } catch (err) {
            console.error('Error saving festivo', err);
            alert('Error al guardar festivo');
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.ID_FESTIVO || item.id_festivo || item.ID_FESTIVO);
        setForm({ fecha: (item.FECHA || item.fecha || '').split('T')[0], descripcion: item.DESCRIPCION || item.descripcion || '', ref_ubi: item.REF_UBI || '' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este festivo?')) return;
        try {
            await api.deleteFestivo(id);
            loadFestivos();
        } catch (err) {
            console.error('Error deleting festivo', err);
            alert('Error al eliminar');
        }
    };

    return (
        <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar /> Mantenimiento de Festivos</h2>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <div>
                    <label>Año</label>
                    <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: '120px' }} />
                </div>
                <div>
                    <label>Ubicación</label>
                    <select value={refUbi} onChange={(e) => setRefUbi(e.target.value)} style={{ width: '220px' }}>
                        <option value="">Todas</option>
                        <option value="null">Nacional</option>
                        {ubicaciones.map(u => (
                            <option key={u.REF_UBI} value={u.REF_UBI}>{u.REF_UBI} - {u.A_LUGAR}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn" onClick={loadFestivos} style={{ padding: '0.4rem 0.8rem' }}>Recargar</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label>Fecha</label>
                    <input type="date" value={form.fecha} onChange={(e) => setForm(prev => ({ ...prev, fecha: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label>Ubicación (vacío = nacional)</label>
                    <select value={form.ref_ubi} onChange={(e) => setForm(prev => ({ ...prev, ref_ubi: e.target.value }))}>
                        <option value="">Nacional</option>
                        {ubicaciones.map(u => (
                            <option key={u.REF_UBI} value={u.REF_UBI}>{u.REF_UBI} - {u.A_LUGAR}</option>
                        ))}
                    </select>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label>Descripción</label>
                    <input type="text" value={form.descripcion} onChange={(e) => setForm(prev => ({ ...prev, descripcion: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                    {editingId && <button className="btn" onClick={() => { setEditingId(null); setForm({ fecha: '', descripcion: '', ref_ubi: '' }); }}><X /></button>}
                    <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus />{editingId ? 'Actualizar' : 'Crear'}</button>
                </div>
            </div>

            <div className="glass-card">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
                ) : festivos.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay festivos para los filtros seleccionados.</div>
                ) : (
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Ubicación</th>
                                <th>Descripción</th>
                                <th style={{ width: '120px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {festivos.map(f => (
                                <tr key={f.ID_FESTIVO || f.id_festivo || f.id_festivo}>
                                    <td>{(f.FECHA || f.fecha || '').split('T')[0]}</td>
                                    <td>{f.REF_UBI ? `${f.REF_UBI}` : 'Nacional'}</td>
                                    <td>{f.DESCRIPCION || f.descripcion}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button className="btn" onClick={() => handleEdit(f)}><Edit size={14} /></button>
                                            <button className="btn" onClick={() => handleDelete(f.ID_FESTIVO || f.id_festivo || f.id_festivo)} style={{ background: 'rgba(239,68,68,0.08)' }}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default FestivosPage;
