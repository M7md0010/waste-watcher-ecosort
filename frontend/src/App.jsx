import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LangProvider, useLang } from './LangContext';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import ClientPortal from './components/ClientPortal';
import BinsManager from './components/BinsManager';
import FleetManager from './components/FleetManager';
import Controls from './components/Controls';

function RoleBadge({ role }) {
  const colors = {
    admin: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
    client: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    driver: { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
  };
  const c = colors[role] || colors.admin;
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 999,
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      background: c.bg, color: c.color,
    }}>
      {role}
    </span>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();

  if (!user) return <LoginScreen />;

  if (user.role === 'client') return <ClientPortal />;

  const isAdmin = user.role === 'admin';
  const isDriver = user.role === 'driver';

  return (
    <Router>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <h1>{t('app.title')}</h1>
            <span>{t('app.subtitle')}</span>
          </div>

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.username}</div>
              <RoleBadge role={user.role} />
            </div>
          </div>

          <nav className="sidebar-nav">
            {isAdmin && (
              <>
                <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                  <span className="nav-icon">📊</span>
                  <span className="nav-label">{t('nav.dashboard')}</span>
                </NavLink>
                <NavLink to="/bins" className={({ isActive }) => isActive ? 'active' : ''}>
                  <span className="nav-icon">🗑️</span>
                  <span className="nav-label">{t('nav.bins')}</span>
                </NavLink>
                <NavLink to="/fleet" className={({ isActive }) => isActive ? 'active' : ''}>
                  <span className="nav-icon">🚛</span>
                  <span className="nav-label">{t('nav.fleet')}</span>
                </NavLink>
                <NavLink to="/routes" className={({ isActive }) => isActive ? 'active' : ''}>
                  <span className="nav-icon">🗺️</span>
                  <span className="nav-label">{t('nav.routes')}</span>
                </NavLink>
              </>
            )}
            {isDriver && (
              <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">🗺️</span>
                <span className="nav-label">{t('nav.routes')}</span>
              </NavLink>
            )}
          </nav>

          <div className="sidebar-footer">
            <button
              className="btn btn-ghost sidebar-lang-btn"
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            >
              🌐 {t('app.lang_switch')}
            </button>
            <button className="btn btn-ghost sidebar-logout-btn" onClick={logout}>
              {t('app.signout')}
            </button>
          </div>
        </aside>

        <div className="page-wrapper">
          <div className="page-content">
            <Routes>
              {isAdmin && (
                <>
                  <Route path="/" element={<AdminDashboard />} />
                  <Route path="/bins" element={<BinsManager />} />
                  <Route path="/fleet" element={<FleetManager />} />
                  <Route path="/routes" element={<Controls />} />
                </>
              )}

              {isDriver && (
                <Route path="/" element={<Controls />} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LangProvider>
  );
}

export default App;
