import React, { useState } from 'react';
import { motion } from 'framer-motion';
import logo from '../assets/tragsa_logo.png';
import api from '../api';

const LoginPage = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [dbType, setDbType] = useState('postgres');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [apiUrl, setApiUrlState] = useState(api.getApiUrl());

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const cleanUsername = username.trim();

        try {
            await api.login(cleanUsername, password, dbType);
            onLogin(cleanUsername, password, dbType);
        } catch (err) {
            console.error(err);
            const serverError = err.response?.data?.error;
            const status = err.response?.status;
            const message = err.message || 'Error al conectar.';
            const fullError = serverError
                ? `${serverError}${status ? ` (HTTP ${status})` : ''}`
                : `${message}${status ? ` (HTTP ${status})` : ''}`;
            setError(fullError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            width: '100vw',
            background: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.2) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.2) 0, transparent 50%)',
            backgroundColor: 'var(--bg-dark)'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card"
                style={{
                    padding: '3rem',
                    width: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                <img src={logo} alt="Tragsatec" style={{ width: '220px', marginBottom: '2rem' }} />

                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '500' }}>Iniciar Sesión</h2>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#fca5a5',
                        padding: '0.8rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        width: '100%',
                        fontSize: '0.85rem',
                        textAlign: 'center'
                    }}>
                        <div>{error}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <div className="form-group">
                        <label>Base de Datos</label>
                        <select
                            className="form-control"
                            value={dbType}
                            onChange={e => setDbType(e.target.value)}
                            style={{ padding: '0.8rem', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)' }}
                        >
                            <option value="postgres">PostgreSQL</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Usuario</label>
                        <input
                            type="text"
                            className="form-control"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            style={{ padding: '0.8rem' }}
                            placeholder={dbType === 'oracle' ? 'Ej. U012345' : 'Usuario Postgres'}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{ padding: '0.8rem' }}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '0.8rem',
                            marginTop: '1.5rem',
                            justifyContent: 'center',
                            fontSize: '1rem'
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Conectando...' : 'Acceder'}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', width: '100%', textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            textDecoration: 'underline',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            opacity: 0.7
                        }}
                    >
                        ⚙️ {showSettings ? 'Ocultar Configuración' : 'Configurar Servidor API'}
                    </button>
                </div>

                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ width: '100%', marginTop: '1rem' }}
                    >
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>URL del Servidor API</label>
                            <input
                                type="text"
                                className="form-control"
                                value={apiUrl}
                                onChange={e => {
                                    setApiUrlState(e.target.value);
                                    api.setApiUrl(e.target.value);
                                }}
                                style={{
                                    padding: '0.6rem',
                                    fontSize: '0.85rem',
                                    backgroundColor: 'var(--input-bg)',
                                    color: 'var(--input-text)'
                                }}
                                placeholder="https://gestion-personal-backend.onrender.com/api"
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                                Se guarda en localStorage de este navegador.
                            </span>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default LoginPage;
