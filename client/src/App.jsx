import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, UserPlus, FolderKanban, Database, Moon, Sun, Palette, LogOut, MapPin, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check, RefreshCw, Calendar } from 'lucide-react';
import { supabase } from './supabaseClient';
import EncargosPage from './pages/EncargosPage';
import PersonalPage from './pages/PersonalPage';
import AssignmentsPage from './pages/AssignmentsPage';
import Dashboard from './pages/Dashboard';
import UbicacionPage from './pages/UbicacionPage';
import PersonalByLocationPage from './pages/PersonalByLocationPage';
import VacacionesPage from './pages/VacacionesPage';

import logo from './assets/tragsa_logo.png';

import LoginPage from './pages/LoginPage';

import PersonalAssignmentsSummaryPage from './pages/PersonalAssignmentsSummaryPage';
import QueryPage from './pages/QueryPage';
import SyncPage from './pages/SyncPage';

function App() {
  useEffect(() => {
    console.log("App Version 4.0 Loaded — Supabase Auth");
  }, []);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(localStorage.getItem('sidebarPinned') !== 'false');
  const [isHovered, setIsHovered] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let themeClass = '';
    if (theme === 'light') themeClass = 'light-theme';
    else if (theme === 'onenote') themeClass = 'onenote-theme';
    else if (theme === 'office') themeClass = 'office-theme';
    document.documentElement.className = themeClass;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleSidebar = () => {
    setIsSidebarPinned(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarPinned', newState);
      return newState;
    });
  };

  const themes = [
    { id: 'dark', label: 'Solarized Noche', icon: <Moon size={16} /> },
    { id: 'light', label: 'Solarized Día', icon: <Sun size={16} /> },
    { id: 'onenote', label: 'Modo OneNote', icon: <Palette size={16} style={{ color: '#7719aa' }} /> },
    { id: 'office', label: 'Modo Office', icon: <Palette size={16} style={{ color: '#0078d4' }} /> },
  ];

  // Supabase Auth: comprueba la sesión al arrancar y escucha cambios
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || '');
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || '');
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    // El estado se actualiza via onAuthStateChange
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange pondrá isAuthenticated = false automáticamente
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-dark)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isExpanded = isSidebarPinned || isHovered;

  return (
    <Router>
      <div
        className={`sidebar ${isSidebarPinned ? 'pinned' : 'collapsed'} ${isHovered ? 'hovered' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'space-between' : 'center', marginBottom: '2rem' }}>
          {isExpanded && (
            <div className="logo-container" style={{ display: 'flex', justifyContent: 'center' }}>
              <img src={logo} alt="Tragsatec" style={{ maxWidth: '200px', height: 'auto' }} />
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="pin-button"
            title={isSidebarPinned ? "Desfijar panel" : "Fijar panel"}
          >
            {isSidebarPinned ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Supabase connection indicator */}
        <div style={{ 
          margin: '0 0.8rem 1.5rem 0.8rem',
          padding: '0.6rem',
          background: 'rgba(99, 102, 241, 0.15)',
          borderRadius: '10px',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.7rem',
          justifyContent: isExpanded ? 'flex-start' : 'center'
        }}>
          <Database size={18} style={{ color: '#818cf8' }} />
          {isExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 600 }}>SUPABASE</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail}
              </span>
            </div>
          )}
        </div>

        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} /> {isExpanded && <span>Dashboard</span>}
        </NavLink>
        <NavLink to="/encargos" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Briefcase size={18} /> {isExpanded && <span>Encargos</span>}
        </NavLink>
        <NavLink to="/personal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Users size={18} /> {isExpanded && <span>Personal</span>}
        </NavLink>
        <NavLink to="/asignaciones" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <UserPlus size={18} /> {isExpanded && <span>Asignaciones</span>}
        </NavLink>
        <NavLink to="/resumen-asignaciones" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FolderKanban size={18} /> {isExpanded && <span>Resumen Total</span>}
        </NavLink>
        <NavLink to="/ubicacion" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <MapPin size={18} /> {isExpanded && <span>Ubicación</span>}
        </NavLink>
        <NavLink to="/personal-ubicacion" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <MapPin size={18} /> {isExpanded && <span>Personal Por Ubicación</span>}
        </NavLink>
        <NavLink to="/vacaciones" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Calendar size={18} /> {isExpanded && <span>Vacaciones</span>}
        </NavLink>
        <NavLink to="/consultas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Database size={18} /> {isExpanded && <span>Consultas</span>}
        </NavLink>
        <NavLink to="/sincronizacion" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <RefreshCw size={18} /> {isExpanded && <span>Sincronizar DB</span>}
        </NavLink>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-card)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ position: 'relative' }}>
            <button
              className="nav-link"
              onClick={() => setIsThemeMenuOpen(prev => !prev)}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', justifyContent: isExpanded ? 'flex-start' : 'center' }}
            >
              {themes.find(t => t.id === theme)?.icon}
              {isExpanded && (
                <>
                  <span style={{ flex: 1, textAlign: 'left' }}>{themes.find(t => t.id === theme)?.label}</span>
                  {isThemeMenuOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </>
              )}
            </button>
            {isThemeMenuOpen && (
              <div className="theme-menu" style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                background: 'var(--glass2-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.3rem',
                marginBottom: '0.25rem',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
                zIndex: 200,
                backdropFilter: 'blur(12px)',
              }}>
                {themes.map(t => (
                  <button
                    key={t.id}
                    className="nav-link"
                    onClick={() => { setTheme(t.id); setIsThemeMenuOpen(false); }}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: theme === t.id ? 'var(--bg-card)' : 'none',
                      cursor: 'pointer',
                      justifyContent: 'flex-start',
                      fontWeight: theme === t.id ? 600 : 400,
                      color: theme === t.id ? 'var(--primary)' : undefined,
                      marginBottom: '0.1rem',
                    }}
                  >
                    {t.icon}
                    <span style={{ flex: 1, textAlign: 'left' }}>{t.label}</span>
                    {theme === t.id && <Check size={14} style={{ color: 'var(--primary)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="nav-link" onClick={handleLogout} style={{ width: '100%', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', cursor: 'pointer', justifyContent: isExpanded ? 'flex-start' : 'center' }}>
            <LogOut size={18} /> {isExpanded && 'Cerrar Sesión'}
          </button>
        </div>
      </div>

      <main className={`main-content ${isSidebarPinned ? 'margin-pinned' : 'margin-collapsed'}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/encargos" element={<EncargosPage />} />
          <Route path="/personal" element={<PersonalPage />} />
          <Route path="/asignaciones" element={<AssignmentsPage />} />
          <Route path="/resumen-asignaciones" element={<PersonalAssignmentsSummaryPage />} />
          <Route path="/consultas" element={<QueryPage />} />
          <Route path="/sincronizacion" element={<SyncPage />} />
          <Route path="/ubicacion" element={<UbicacionPage />} />
          <Route path="/personal-ubicacion" element={<PersonalByLocationPage />} />
          <Route path="/vacaciones" element={<VacacionesPage />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
