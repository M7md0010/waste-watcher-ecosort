import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useLang } from '../LangContext';

const ROLES = [
  { key: 'admin', icon: '🛡️', color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)', hint: 'mohamed_admin', labelKey: 'login.role_admin', subKey: 'login.role_admin_sub' },
  { key: 'driver', icon: '🚛', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', hint: 'driver_alex', labelKey: 'login.role_driver', subKey: 'login.role_driver_sub' },
];

export default function LoginScreen() {
  const { login, loading, error, setError } = useAuth();
  const { t, lang, setLang } = useLang();
  const [selectedRole, setSelectedRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleRoleSelect = (role) => { setSelectedRole(role); setUsername(''); setPassword(''); setError(null); };
  const handleBack = () => { setSelectedRole(null); setUsername(''); setPassword(''); setError(null); };
  const handleSubmit = async (e) => { e.preventDefault(); try { await login(username, password); } catch {} };

  const activeRole = ROLES.find(r => r.key === selectedRole);

  return (
    <div className="login-screen">
      <div className="login-particles">
        {[...Array(6)].map((_, i) => (<div key={i} className="login-particle" style={{ animationDelay: `${i * 0.8}s` }} />))}
      </div>
      <div className="login-card">
        <div className="login-lang-toggle">
          <button className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
            🌐 {t('app.lang_switch')}
          </button>
        </div>
        <div className="login-brand">
          <div className="login-logo-icon">♻️</div>
          <h1>{t('app.title')}</h1>
          <span>{t('app.subtitle')}</span>
        </div>
        {!selectedRole ? (
          <>
            <p className="login-choose-label">{t('login.select_role')}</p>
            <div className="login-role-grid">
              {ROLES.map(role => (
                <button key={role.key} className="login-role-card" onClick={() => handleRoleSelect(role.key)}
                  style={{ '--role-color': role.color, '--role-bg': role.bg, '--role-border': role.border }}>
                  <div className="login-role-icon">{role.icon}</div>
                  <div className="login-role-label">{t(role.labelKey)}</div>
                  <div className="login-role-subtitle">{t(role.subKey)}</div>
                </button>
              ))}
            </div>
            <div className="login-footer">
              <p>{t('login.demo_pw')} <strong style={{ color: 'var(--text)', letterSpacing: '0.02em' }}>password123</strong></p>
            </div>
          </>
        ) : (
          <>
            <button className="login-back-btn" onClick={handleBack}>{t('login.back')}</button>
            <div className="login-role-header" style={{ '--role-color': activeRole.color, '--role-bg': activeRole.bg, '--role-border': activeRole.border }}>
              <div className="login-role-header-icon">{activeRole.icon}</div>
              <div>
                <div className="login-role-header-label">{t('login.signin_as')} {t(activeRole.labelKey)}</div>
                <div className="login-role-header-sub">{t(activeRole.subKey)}</div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="login-form">
              {error && <div className="login-error">{error}</div>}
              <div className="form-group">
                <label>{t('login.username')}</label>
                <input className="form-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={activeRole.hint} required autoFocus />
              </div>
              <div className="form-group">
                <label>{t('login.password')}</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('login.placeholder_pw')} required />
              </div>
              <button className="btn btn-primary login-btn" type="submit" disabled={loading}
                style={{ background: `linear-gradient(135deg, ${activeRole.color}, ${activeRole.color}dd)` }}>
                {loading ? (<><span className="login-spinner" /> {t('login.authenticating')}</>) : (`🔐 ${t('login.signin_as')} ${t(activeRole.labelKey)}`)}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
