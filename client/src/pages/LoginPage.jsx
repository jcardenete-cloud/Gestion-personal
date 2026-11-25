import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import logo from '../assets/tragsa_logo.png';
import { supabase } from '../supabaseClient';

const LoginPage = ({ onLogin, authError }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const displayError = error || authError || '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (authError) throw authError;
            // onAuthStateChange en App.jsx detectará el login automáticamente
            if (onLogin) onLogin();
        } catch (err) {
            const msg = err.message || 'Error al iniciar sesión.';
            // Traducir mensajes comunes de Supabase Auth al español
            if (msg.includes('Invalid login credentials')) {
                setError('Email o contraseña incorrectos.');
            } else if (msg.includes('Email not confirmed')) {
                setError('El email no ha sido confirmado. Revisa tu bandeja de entrada.');
            } else if (msg.includes('Too many requests')) {
                setError('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
            } else {
                setError(msg);
            }
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

                {displayError && (
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
                        <div>{displayError}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={{ padding: '0.8rem' }}
                            placeholder="usuario@dominio.com"
                            autoComplete="email"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-control"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ padding: '0.8rem 2.8rem 0.8rem 0.8rem' }}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(visible => !visible)}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                aria-pressed={showPassword}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    right: '0.75rem',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0,
                                    border: 0,
                                    background: 'transparent',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
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

                <p style={{
                    marginTop: '1.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center'
                }}>
                    Acceso gestionado por Supabase Auth
                </p>
            </motion.div>
        </div>
    );
};

export default LoginPage;
