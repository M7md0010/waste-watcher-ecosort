import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const AUTH_KEY = 'wwe_client_user';
const LANG_KEY = 'wwe_lang';

const T = {
  en: {
    'brand': 'Waste-Watcher', 'tagline': 'Resident Services Portal', 'lang_switch': 'عربي',
    'signout': '🚪 Sign Out',
    'login.title': 'Resident Portal', 'login.subtitle': 'Sign in to monitor your local bins and report issues',
    'login.username': 'Username', 'login.password': 'Password', 'login.pw_placeholder': 'Enter your password',
    'login.btn': '🔐 Sign In', 'login.loading': 'Signing in…',
    'login.demo': 'Demo account:', 'login.demo_user': 'lena_client', 'login.demo_pw': 'password123',
    'login.error_role': 'This portal is for residents only. Admins and drivers should use the operations dashboard.',
    'hero.title': 'Your Local Bins', 'hero.subtitle': 'Monitor fill levels for bins in your zone and report issues',
    'stat.bins': 'Local Bins', 'stat.avg': 'Avg Fill Level', 'stat.critical': 'Critical Bins',
    'col.cleaned': 'Last Cleaned',
    'report.btn': '⚠ Report Issue', 'report.sending': '⏳ Sending…',
    'report.overflow': '🚨 Overflowing', 'report.odor': '💀 Foul Odor',
    'report.vandal': '🔨 Vandalism', 'report.dumping': '🗑️ Illegal Dumping',
    'report.success': 'Report submitted for Bin', 'report.emergency': 'Emergency clearance requested for Bin',
    'status.critical': 'Critical', 'status.moderate': 'Moderate', 'status.optimal': 'Optimal',
    'footer': '© 2026 Waste-Watcher — EcoSort Platform',
  },
  ar: {
    'brand': 'حارس النفايات', 'tagline': 'بوابة خدمات السكان', 'lang_switch': 'English',
    'signout': '🚪 تسجيل الخروج',
    'login.title': 'بوابة السكان', 'login.subtitle': 'سجّل الدخول لمراقبة حاوياتك المحلية والإبلاغ عن المشاكل',
    'login.username': 'اسم المستخدم', 'login.password': 'كلمة المرور', 'login.pw_placeholder': 'أدخل كلمة المرور',
    'login.btn': '🔐 تسجيل الدخول', 'login.loading': 'جارٍ التحقق…',
    'login.demo': 'حساب تجريبي:', 'login.demo_user': 'lena_client', 'login.demo_pw': 'password123',
    'login.error_role': 'هذه البوابة للسكان فقط. المديرون والسائقون يستخدمون لوحة العمليات.',
    'hero.title': 'حاوياتك المحلية', 'hero.subtitle': 'راقب مستويات الامتلاء في منطقتك وأبلغ عن المشاكل',
    'stat.bins': 'الحاويات المحلية', 'stat.avg': 'متوسط الامتلاء', 'stat.critical': 'حاويات حرجة',
    'col.cleaned': 'آخر تنظيف',
    'report.btn': '⚠ إبلاغ', 'report.sending': '⏳ جارٍ الإرسال…',
    'report.overflow': '🚨 ممتلئة', 'report.odor': '💀 رائحة كريهة',
    'report.vandal': '🔨 تخريب', 'report.dumping': '🗑️ إلقاء غير قانوني',
    'report.success': 'تم إرسال البلاغ للحاوية', 'report.emergency': 'تم طلب إخلاء طارئ للحاوية',
    'status.critical': 'حرج', 'status.moderate': 'متوسط', 'status.optimal': 'مثالي',
    'footer': '© 2026 حارس النفايات — منصة الفرز الذكي',
  },
};

function useLangState() {
  const [lang, setLangRaw] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'en'; } catch { return 'en'; }
  });
  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  const setLang = useCallback((l) => setLangRaw(l), []);
  const t = useCallback((key) => T[lang]?.[key] || T['en']?.[key] || key, [lang]);
  return { lang, setLang, t };
}

function LoginPage({ onLogin, langCtx }) {
  const { t, lang, setLang } = langCtx;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { username, password });
      if (res.data.role !== 'client') {
        setError(t('login.error_role'));
        setLoading(false);
        return;
      }
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-login-screen">
      <div className="cp-login-particles">
        {[...Array(6)].map((_, i) => <div key={i} className="cp-login-particle" style={{ animationDelay: `${i * 0.8}s` }} />)}
      </div>
      <div className="cp-login-card">
        <div className="cp-login-lang">
          <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
            🌐 {t('lang_switch')}
          </button>
        </div>
        <div className="cp-login-brand">
          <div className="cp-login-logo">♻️</div>
          <h1>{t('brand')}</h1>
          <span className="cp-login-tagline">{t('tagline')}</span>
        </div>
        <h2 className="cp-login-title">{t('login.title')}</h2>
        <p className="cp-login-subtitle">{t('login.subtitle')}</p>

        <form onSubmit={handleSubmit} className="cp-login-form">
          {error && <div className="cp-login-error">{error}</div>}
          <div className="cp-form-group">
            <label>{t('login.username')}</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('login.demo_user')} required autoFocus />
          </div>
          <div className="cp-form-group">
            <label>{t('login.password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('login.pw_placeholder')} required />
          </div>
          <button className="cp-btn cp-btn-primary cp-login-submit" type="submit" disabled={loading}>
            {loading ? t('login.loading') : t('login.btn')}
          </button>
        </form>
        <div className="cp-login-demo">
          <span>{t('login.demo')}</span>
          <code>{t('login.demo_user')} / {t('login.demo_pw')}</code>
        </div>
      </div>
    </div>
  );
}

function Portal({ user, onLogout, langCtx }) {
  const { t, lang, setLang } = langCtx;
  const [bins, setBins] = useState([]);
  const [toast, setToast] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const [openReport, setOpenReport] = useState(null);
  const reportRef = useRef(null);

  const zone = user?.zone || 'Sector 4';

  const load = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/client/bins?zone=${encodeURIComponent(zone)}`);
      setBins(res.data);
    } catch {}
  };

  useEffect(() => { load(); const iv = setInterval(load, 6000); return () => clearInterval(iv); }, [zone]);

  useEffect(() => {
    const h = (e) => { if (reportRef.current && !reportRef.current.contains(e.target)) setOpenReport(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const handleReport = async (binId, reportType) => {
    setRequesting(binId); setOpenReport(null);
    try {
      await axios.post(`${API}/dashboard/bin-reports`, { bin_id: binId, user_id: user.user_id, report_type: reportType, description: null });
      flash(reportType === 'OVERFLOWING' ? `${t('report.emergency')} #${binId}` : `${t('report.success')} #${binId}`);
      load();
    } catch { flash('Request failed', 'error'); }
    finally { setRequesting(null); }
  };

  const avgFill = bins.length > 0 ? bins.reduce((s, b) => s + b.current_level, 0) / bins.length : 0;
  const criticalBins = bins.filter(b => b.current_level * b.importance_weight >= 70);

  const getStatus = (b) => {
    const score = b.current_level * b.importance_weight;
    if (score >= 70) return { cls: 'critical', label: t('status.critical') };
    if (score > 40) return { cls: 'moderate', label: t('status.moderate') };
    return { cls: 'optimal', label: t('status.optimal') };
  };

  const reportOptions = [
    { type: 'OVERFLOWING', label: t('report.overflow') },
    { type: 'ODOR', label: t('report.odor') },
    { type: 'VANDALIZED', label: t('report.vandal') },
    { type: 'ILLEGAL_DUMPING', label: t('report.dumping') },
  ];

  return (
    <div className="cp-portal">
      <header className="cp-header">
        <div className="cp-header-inner">
          <div className="cp-header-brand">
            <span className="cp-header-logo">♻️</span>
            <div>
              <h1>{t('brand')}</h1>
              <span>{t('tagline')}</span>
            </div>
          </div>
          <div className="cp-header-actions">
            <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
              🌐 {t('lang_switch')}
            </button>
            <div className="cp-header-user">
              <div className="cp-header-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <span className="cp-header-name">{user.username}</span>
            </div>
            <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={onLogout}>{t('signout')}</button>
          </div>
        </div>
      </header>

      {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}

      <main className="cp-main">
        <div className="cp-hero">
          <div className="cp-hero-text">
            <h2>{t('hero.title')}</h2>
            <p>{t('hero.subtitle')}</p>
          </div>
          <div className="cp-hero-zone">
            <span className="cp-zone-badge">📍 {zone}</span>
          </div>
        </div>

        <div className="cp-stats">
          <div className="cp-stat">
            <div className="cp-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>🗑️</div>
            <div className="cp-stat-value">{bins.length}</div>
            <div className="cp-stat-label">{t('stat.bins')}</div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>📊</div>
            <div className="cp-stat-value">{avgFill.toFixed(0)}%</div>
            <div className="cp-stat-label">{t('stat.avg')}</div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>🚩</div>
            <div className="cp-stat-value">{criticalBins.length}</div>
            <div className="cp-stat-label">{t('stat.critical')}</div>
          </div>
        </div>

        <div className="cp-bins-grid">
          {bins.map(b => {
            const st = getStatus(b);
            return (
              <div key={b.bin_id} className={`cp-bin-card ${st.cls}`}>
                <div className="cp-bin-top">
                  <div className="cp-bin-id">
                    <span className="cp-bin-hash">#{b.bin_id}</span>
                    <span className={`cp-badge ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="cp-fill-ring">
                    <svg viewBox="0 0 36 36" className="cp-fill-svg">
                      <path className="cp-fill-track" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className={`cp-fill-progress ${st.cls}`} strokeDasharray={`${Math.min(b.current_level, 100)}, 100`} d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span className="cp-fill-pct">{b.current_level.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="cp-bin-body">
                  <div className="cp-bin-street">📍 {b.street_name}</div>
                  <div className="cp-bin-meta">
                    <span>{b.waste_type}</span>
                    {b.last_cleaned && <span>{t('col.cleaned')}: {new Date(b.last_cleaned).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="cp-bin-actions" style={{ position: 'relative' }}>
                  <button className="cp-btn cp-report-btn" onClick={() => setOpenReport(openReport === b.bin_id ? null : b.bin_id)} disabled={requesting === b.bin_id}>
                    {requesting === b.bin_id ? t('report.sending') : t('report.btn')}
                  </button>
                  {openReport === b.bin_id && (
                    <div className="cp-report-dropdown" ref={reportRef}>
                      {reportOptions.map(opt => (
                        <button key={opt.type} className="cp-report-item" onClick={() => handleReport(b.bin_id, opt.type)}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="cp-footer">
        <span>{t('footer')}</span>
      </footer>
    </div>
  );
}

export default function App() {
  const langCtx = useLangState();
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  if (!user) return <LoginPage onLogin={handleLogin} langCtx={langCtx} />;
  return <Portal user={user} onLogout={handleLogout} langCtx={langCtx} />;
}
