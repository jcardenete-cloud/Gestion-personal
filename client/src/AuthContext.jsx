import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import api from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [appUser, setAppUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    const applyUserRole = useCallback((user) => {
        if (!user) {
            setAppUser(null);
            setIsAdmin(false);
            setIsReadOnly(true);
            return;
        }
        setAppUser(user);
        const admin = (user.PERFIL || '').trim().toLowerCase() === 'administrador';
        setIsAdmin(admin);
        setIsReadOnly(!admin);
    }, []);

    const loadAppUser = useCallback(async (email) => {
        if (!email) {
            setIsAuthenticated(false);
            setUserEmail('');
            applyUserRole(null);
            setAuthLoading(false);
            return;
        }

        setUserEmail(email);
        setIsAuthenticated(true);

        try {
            const { data: user } = await api.getAppUsuarioByEmail(email);
            if (!user) {
                setAuthError(
                    `El email "${email}" no tiene acceso a esta aplicación. Contacte con el administrador.`
                );
                await supabase.auth.signOut();
                setIsAuthenticated(false);
                applyUserRole(null);
            } else {
                setAuthError('');
                applyUserRole(user);
            }
        } catch (err) {
            console.error('Error loading app user:', err);
            setAuthError('Error al verificar permisos de acceso. Inténtalo de nuevo.');
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            applyUserRole(null);
        } finally {
            setAuthLoading(false);
        }
    }, [applyUserRole]);

    useEffect(() => {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            loadAppUser(session?.user?.email || null);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user?.email) {
                loadAppUser(session.user.email);
            } else {
                setIsAuthenticated(false);
                setUserEmail('');
                applyUserRole(null);
                setAuthError('');
                setAuthLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [loadAppUser, applyUserRole]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            userEmail,
            appUser,
            isAdmin,
            isReadOnly,
            authLoading,
            authError,
            handleLogout,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};
