import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import { useLang } from '../LangContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function ClientDashboard() {
  const { user } = useAuth();
  const { t } = useLang();
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
        bin_id: binId,
        user_id: user.user_id,
        report_type: reportType,
        description: null,
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
    <>
      <div className="page-header">
        <h2>{t('client.title')} — {zone}</h2>
        <p>{t('client.subtitle')}</p>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="stats-row">
        <div className="stat-card"><div className="stat-icon blue">🗑️</div><div className="stat-info"><h4>{t('client.local_bins')}</h4><div className="stat-value">{bins.length}</div></div></div>
        <div className="stat-card"><div className="stat-icon yellow">📊</div><div className="stat-info"><h4>{t('client.avg_fill')}</h4><div className="stat-value">{avgFill.toFixed(0)}%</div></div></div>
        <div className="stat-card"><div className="stat-icon red">🚩</div><div className="stat-info"><h4>{t('client.critical')}</h4><div className="stat-value">{criticalBins.length}</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{t('client.bin_status')} ({bins.length})</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('client.col_bin')}</th>
                <th>{t('client.col_street')}</th>
                <th>{t('client.col_type')}</th>
                <th>{t('client.col_fill')}</th>
                <th>{t('client.col_status')}</th>
                <th>{t('client.col_cleaned')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bins.map(b => {
                const st = getStatus(b);
                return (
                  <tr key={b.bin_id}>
                    <td style={{ fontWeight: 600 }}>#{b.bin_id}</td>
                    <td>{b.street_name}</td>
                    <td>{b.waste_type}</td>
                    <td>
                      <div className="fill-bar" style={{ maxWidth: 160 }}>
                        <div className={`fill-bar-inner ${st.cls}`} style={{ width: `${Math.min(b.current_level, 100)}%` }} />
                      </div>
                      <span className="fill-text">{b.current_level.toFixed(1)}%</span>
                    </td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {b.last_cleaned ? new Date(b.last_cleaned).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button
                        className="btn report-trigger-btn btn-sm"
                        onClick={() => setOpenReport(openReport === b.bin_id ? null : b.bin_id)}
                        disabled={requesting === b.bin_id}
                      >
                        {requesting === b.bin_id ? t('client.sending') : t('client.report_btn')}
                      </button>
                      {openReport === b.bin_id && (
                        <div className="report-dropdown" ref={reportRef}>
                          {reportOptions.map(opt => (
                            <button key={opt.type} className="report-dropdown-item" onClick={() => handleReport(b.bin_id, opt.type)}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
