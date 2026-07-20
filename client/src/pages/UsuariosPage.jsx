import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, ShieldCheck, Eye, Users } from 'lucide-react';
import api from '../api';

const PERFILES = ['Administrador', 'Consulta'];

const initialForm = { NOMBRE: '', APELLIDO1: '', APELLIDO2: '', PERFIL: 'Consulta', EMAIL: '' };

const UsuariosPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await api.getAppUsuarios();
            setUsers(res.data || []);
        } catch (err) {
            setError('Error cargando usuarios: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const openCreate = () => {
        setEditingUser(null);
        setFormData(initialForm);
        setIsModalOpen(true);
    };

    const openEdit = (user) => {
        setEditingUser(user);
        setFormData({
            NOMBRE: user.NOMBRE || '',
            APELLIDO1: user.APELLIDO1 || '',
            APELLIDO2: user.APELLIDO2 || '',
            PERFIL: user.PERFIL || 'Consulta',
            EMAIL: user.EMAIL || '',
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (editingUser) {
                await api.updateAppUsuario(editingUser.ID, formData);
            } else {
                await api.createAppUsuario(formData);
            }
            setIsModalOpen(false);
            loadUsers();
        } catch (err) {
            setError('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, email) => {
        if (!window.confirm(`¿Eliminar el usuario "${email}"? Esta acción no se puede deshacer.`)) return;
        try {
            await api.deleteAppUsuario(id);
            loadUsers();
        } catch (err) {
            setError('Error al eliminar: ' + err.message);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}
        >
            {/* Header */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Users size={28} style={{ color: 'var(--primary)' }} />
                        Usuarios de la Aplicación
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                        Gestión de accesos y perfiles. Solo los usuarios registrados aquí pueden iniciar sesión.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} /> Nuevo Usuario
                </button>
            </div>

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px', padding: '0.8rem 1rem', marginBottom: '1.5rem', color: '#fca5a5', fontSize: '0.88rem' }}>
                    {error}
                </div>
            )}

            {/* Info banner */}
            <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <ShieldCheck size={16} style={{ color: '#818cf8' }} />
                    <span><strong style={{ color: '#a5b4fc' }}>Administrador</strong> — acceso total: lectura + escritura + borrado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Eye size={16} style={{ color: '#94a3b8' }} />
                    <span><strong style={{ color: '#94a3b8' }}>Consulta (otros perfiles)</strong> — solo lectura, sin modificaciones</span>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card">
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando usuarios...</div>
                ) : users.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay usuarios registrados. Crea el primero con el botón superior.
                    </div>
                ) : (
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Apellidos</th>
                                <th>Perfil</th>
                                <th>Email (login)</th>
                                <th style={{ width: '120px', textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.ID}>
                                    <td style={{ fontWeight: 600 }}>{user.NOMBRE}</td>
                                    <td>{user.APELLIDO1} {user.APELLIDO2}</td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                            padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                                            background: (user.PERFIL || '').toLowerCase() === 'administrador'
                                                ? 'rgba(99,102,241,0.18)' : 'rgba(148,163,184,0.15)',
                                            color: (user.PERFIL || '').toLowerCase() === 'administrador'
                                                ? '#a5b4fc' : '#94a3b8',
                                        }}>
                                            {(user.PERFIL || '').toLowerCase() === 'administrador'
                                                ? <ShieldCheck size={12} /> : <Eye size={12} />}
                                            {user.PERFIL}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{user.EMAIL}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.35rem 0.7rem', background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}
                                                onClick={() => openEdit(user)}
                                                title="Editar"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.35rem 0.7rem', background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
                                                onClick={() => handleDelete(user.ID, user.EMAIL)}
                                                title="Eliminar"
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

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
                        onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="glass-card"
                            style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="btn" style={{ padding: '0.3rem' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            {error && (
                                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.7rem', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>Nombre *</label>
                                        <input
                                            className="form-control"
                                            value={formData.NOMBRE}
                                            onChange={e => setFormData(p => ({ ...p, NOMBRE: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>Primer Apellido *</label>
                                        <input
                                            className="form-control"
                                            value={formData.APELLIDO1}
                                            onChange={e => setFormData(p => ({ ...p, APELLIDO1: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>Segundo Apellido</label>
                                        <input
                                            className="form-control"
                                            value={formData.APELLIDO2}
                                            onChange={e => setFormData(p => ({ ...p, APELLIDO2: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>Perfil *</label>
                                        <select
                                            className="form-control"
                                            value={formData.PERFIL}
                                            onChange={e => setFormData(p => ({ ...p, PERFIL: e.target.value }))}
                                            required
                                        >
                                            {PERFILES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontSize: '0.8rem' }}>Email (debe coincidir con el email de login) *</label>
                                    <input
                                        className="form-control"
                                        type="email"
                                        value={formData.EMAIL}
                                        onChange={e => setFormData(p => ({ ...p, EMAIL: e.target.value }))}
                                        placeholder="usuario@dominio.com"
                                        required
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Guardando...' : (editingUser ? 'Actualizar' : 'Crear Usuario')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default UsuariosPage;
