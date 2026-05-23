import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import { useLang } from '../LangContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function ClientPortal() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const [bins, setBins] = useState([]);
  const [toast, setToast] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const [openReport, setOpenReport] = useState(null);
  const reportRef = useRef(null);

  const zone = user?.zone || 'Sector 4';

  const load = async () => {
    const res = await axios.get(`${API}/dashboard/client/bins?zone=${encodeURIComponent(zone)}`);
    setBins(res.data);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [zone]);

  useEffect(() => {
    const handleClick = (e) => {
      if (reportRef.current && !reportRef.current.contains(e.target)) setOpenReport(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const flash = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleReport = async (binId, reportType) => {
    setRequesting(binId);
    setOpenReport(null);
    try {
      await axios.post(`${API}/dashboard/bin-reports`, {
        bin_id: binId, user_id: user.user_id, report_type: reportType, description: null,
      });
      if (reportType === 'OVERFLOWING') {
        flash(`${t('client.emergency_success')} #${binId}`);
      } else {
        flash(`${t('client.report_success')} #${binId}`);
      }
      load();
    } catch {
      flash('Request failed', 'error');
    } finally {
      setRequesting(null);
    }
  };

  const avgFill = bins.length > 0 ? (bins.reduce((s, b) => s + b.current_level, 0) / bins.length) : 0;
  const criticalBins = bins.filter(b => b.current_level * b.importance_weight >= 70);

  const getStatus = (b) => {
    const score = b.current_level * b.importance_weight;
    if (score >= 70) return { cls: 'critical', label: t('status.critical') };
    if (score > 40) return { cls: 'moderate', label: t('status.moderate') };
    return { cls: 'optimal', label: t('status.optimal') };
  };

  const reportOptions = [
    { type: 'OVERFLOWING', label: t('client.report_overflow') },
    { type: 'ODOR', label: t('client.report_odor') },
    { type: 'VANDALIZED', label: t('client.report_vandal') },
    { type: 'ILLEGAL_DUMPING', label: t('client.report_dumping') },
  ];

  return (
    <div className="client-portal">
      <header className="client-header">
        <div className="client-header-inner">
          <div className="client-header-brand">
            <span className="client-header-logo">♻️</span>
            <div>
              <h1>{t('app.title')}</h1>
              <span>{t('client.portal_tagline')}</span>
            </div>
          </div>
          <div className="client-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
              🌐 {t('app.lang_switch')}
            </button>
            <div className="client-header-user">
              <div className="client-header-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <span className="client-header-name">{user.username}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout}>{t('app.signout')}</button>
          </div>
        </div>
      </header>

      {toast && <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: '5rem', right: '1.5rem', zIndex: 1000 }}>{toast.msg}</div>}

      <main className="client-main">
        <div className="client-hero">
          <div className="client-hero-text">
            <h2>{t('client.title')}</h2>
            <p>{t('client.subtitle')}</p>
          </div>
          <div className="client-hero-zone">
            <span className="client-zone-badge">📍 {zone}</span>
          </div>
        </div>

        <div className="client-stats">
          <div className="client-stat">
            <div className="client-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>🗑️</div>
            <div className="client-stat-value">{bins.length}</div>
            <div className="client-stat-label">{t('client.local_bins')}</div>
          </div>
          <div className="client-stat">
            <div className="client-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>📊</div>
            <div className="client-stat-value">{avgFill.toFixed(0)}%</div>
            <div className="client-stat-label">{t('client.avg_fill')}</div>
          </div>
          <div className="client-stat">
            <div className="client-stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>🚩</div>
            <div className="client-stat-value">{criticalBins.length}</div>
            <div className="client-stat-label">{t('client.critical')}</div>
          </div>
        </div>

        <div className="client-bins-grid">
          {bins.map(b => {
            const st = getStatus(b);
            return (
              <div key={b.bin_id} className={`client-bin-card ${st.cls}`}>
                <div className="client-bin-card-top">
                  <div className="client-bin-id">
                    <span className="client-bin-hash">#{b.bin_id}</span>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="client-bin-fill-ring">
                    <svg viewBox="0 0 36 36" className="client-fill-svg">
                      <path className="client-fill-track" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className={`client-fill-progress ${st.cls}`} strokeDasharray={`${Math.min(b.current_level, 100)}, 100`} d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span className="client-fill-pct">{b.current_level.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="client-bin-card-body">
                  <div className="client-bin-street">📍 {b.street_name}</div>
                  <div className="client-bin-meta">
                    <span>{b.waste_type}</span>
                    {b.last_cleaned && <span>{t('client.col_cleaned')}: {new Date(b.last_cleaned).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="client-bin-card-actions" style={{ position: 'relative' }}>
                  <button
                    className="btn client-report-btn"
                    onClick={() => setOpenReport(openReport === b.bin_id ? null : b.bin_id)}
                    disabled={requesting === b.bin_id}
                  >
                    {requesting === b.bin_id ? t('client.sending') : t('client.report_btn')}
                  </button>
                  {openReport === b.bin_id && (
                    <div className="report-dropdown client-report-dropdown" ref={reportRef}>
                      {reportOptions.map(opt => (
                        <button key={opt.type} className="report-dropdown-item" onClick={() => handleReport(b.bin_id, opt.type)}>
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

      <footer className="client-footer">
        <span>© 2026 {t('app.title')} — {t('app.subtitle')}</span>
      </footer>
    </div>
  );
}
