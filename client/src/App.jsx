import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Briefcase, Users, UserPlus, FolderKanban,
    Database, Palette, LogOut, MapPin, ChevronLeft, ChevronRight,
    ChevronDown, ChevronUp, Check, RefreshCw, Calendar, ShieldCheck
} from 'lucide-react';
import EncargosPage from './pages/EncargosPage';
import PersonalPage from './pages/PersonalPage';
import AssignmentsPage from './pages/AssignmentsPage';
import Dashboard from './pages/Dashboard';
import UbicacionPage from './pages/UbicacionPage';
import PersonalByLocationPage from './pages/PersonalByLocationPage';
import VacacionesPage from './pages/VacacionesPage';
import UsuariosPage from './pages/UsuariosPage';
import logo from './assets/tragsa_logo.png';
import LoginPage from './pages/LoginPage';
import PersonalAssignmentsSummaryPage from './pages/PersonalAssignmentsSummaryPage';
import { useAuth } from './AuthContext';

function App() {
  useEffect(() => {
    console.log("App Version 4.1 Loaded — Role-based Access");
  }, []);

  const { isAuthenticated, userEmail, isAdmin, isReadOnly, authLoading, authError, handleLogout, appUser } = useAuth();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return 'onenote';
    return saved || 'onenote';
  });
  const [isSidebarPinned, setIsSidebarPinned] = useState(localStorage.getItem('sidebarPinned') !== 'false');
  const [isHovered, setIsHovered] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  useEffect(() => {
    let themeClass = '';
    if (theme === 'onenote') themeClass = 'onenote-theme';
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
    { id: 'onenote', label: 'Modo OneNote', icon: <Palette size={16} style={{ color: '#7719aa' }} /> },
    { id: 'office', label: 'Modo Office', icon: <Palette size={16} style={{ color: '#0078d4' }} /> },
  ];

  // Loading state (auth + role resolution)
  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-dark)', gap: '1rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Verificando acceso...</div>
      </div>
    );
  }

  // Auth error (email not in APP_USUARIOS)
  if (authError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-dark)', padding: '2rem' }}>
        <div className="glass-card" style={{ padding: '2.5rem', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fca5a5' }}>Acceso denegado</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>{authError}</p>
          <button className="btn btn-primary" onClick={handleLogout} style={{ width: '100%', justifyContent: 'center' }}>
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => {}} />;
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

        {/* User info & role badge */}
        <div style={{
          margin: '0 0.8rem 1.5rem 0.8rem',
          padding: '0.6rem',
          background: isAdmin ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148,163,184,0.1)',
          borderRadius: '10px',
          border: `1px solid ${isAdmin ? 'rgba(99, 102, 241, 0.3)' : 'rgba(148,163,184,0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.7rem',
          justifyContent: isExpanded ? 'flex-start' : 'center'
        }}>
          {isAdmin
            ? <ShieldCheck size={18} style={{ color: '#818cf8', flexShrink: 0 }} />
            : <Database size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
          }
          {isExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 600 }}>
                {isAdmin ? 'ADMINISTRADOR' : (appUser?.PERFIL?.toUpperCase() || 'CONSULTA')}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {appUser ? `${appUser.NOMBRE} ${appUser.APELLIDO1}` : userEmail}
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

        {/* Usuarios page: only visible to admins */}
        {isAdmin && (
          <NavLink to="/usuarios" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ShieldCheck size={18} /> {isExpanded && <span>Usuarios App</span>}
          </NavLink>
        )}

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
          <Route path="/ubicacion" element={<UbicacionPage />} />
          <Route path="/personal-ubicacion" element={<PersonalByLocationPage />} />
          <Route path="/vacaciones" element={<VacacionesPage />} />
          {isAdmin && <Route path="/usuarios" element={<UsuariosPage />} />}
        </Routes>
      </main>
    </Router>
  );
}

export default App;
