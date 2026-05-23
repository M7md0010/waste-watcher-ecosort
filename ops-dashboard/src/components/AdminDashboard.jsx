import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLang } from '../LangContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function AdminDashboard() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);
  const [bins, setBins] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simMsg, setSimMsg] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [s, b, tr, r, a, d] = await Promise.all([
        axios.get(`${API}/dashboard/admin/stats`),
        axios.get(`${API}/dashboard/bins`),
        axios.get(`${API}/dashboard/trucks`),
        axios.get(`${API}/dashboard/routes`),
        axios.get(`${API}/dashboard/alerts?resolved=false`),
        axios.get(`${API}/dashboard/drivers`),
      ]);
      setStats(s.data); setBins(b.data); setTrucks(tr.data); setRoutes(r.data); setAlerts(a.data); setDrivers(d.data);
    };
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  const activeRoutes = routes.filter(r => r.status === 'IN_PROGRESS');
  const activeTrucks = trucks.filter(tr => tr.is_active);
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedAlerts = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  return (
    <>
      <div className="page-header">
        <h2>{t('admin.title')}</h2>
        <p>{t('admin.subtitle')}</p>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card"><div className="stat-icon blue">🗑️</div><div className="stat-info"><h4>{t('admin.total_bins')}</h4><div className="stat-value">{stats.total_bins}</div></div></div>
          <div className="stat-card"><div className="stat-icon red">🚩</div><div className="stat-info"><h4>{t('admin.critical_bins')}</h4><div className="stat-value">{stats.critical_bins}</div></div></div>
          <div className="stat-card"><div className="stat-icon green">🗺️</div><div className="stat-info"><h4>{t('admin.active_routes')}</h4><div className="stat-value">{stats.active_routes}</div></div></div>
          <div className="stat-card"><div className="stat-icon yellow">🚛</div><div className="stat-info"><h4>{t('admin.active_trucks')}</h4><div className="stat-value">{stats.active_trucks}</div></div></div>
          <div className="stat-card"><div className="stat-icon red">⚠️</div><div className="stat-info"><h4>{t('admin.unresolved_alerts')}</h4><div className="stat-value">{stats.unresolved_alerts}</div></div></div>
          <div className="stat-card"><div className="stat-icon yellow">📡</div><div className="stat-info"><h4>{t('admin.sensor_errors')}</h4><div className="stat-value">{stats.sensor_errors}</div></div></div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>{t('admin.bin_health')}</h3>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--success)',marginRight:4,verticalAlign:'middle'}}></span> {t('admin.legend_optimal')}</span>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--warning)',marginRight:4,verticalAlign:'middle'}}></span> {t('admin.legend_moderate')}</span>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--danger)',marginRight:4,verticalAlign:'middle'}}></span> {t('admin.legend_critical')}</span>
          </div>
        </div>
        <div className="health-grid">
          {bins.map(b => {
            const score = b.current_level * b.importance_weight;
            const cls = score >= 70 ? 'critical' : score > 40 ? 'moderate' : 'optimal';
            return <div key={b.bin_id} className={`health-dot ${cls}`} title={`Bin #${b.bin_id} — ${b.street_name} (${b.current_level.toFixed(0)}%)`} />;
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header"><h3>{t('admin.sim_title')}</h3></div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            disabled={simLoading}
            onClick={async () => {
              setSimLoading(true);
              try {
                const res = await axios.post(`${API}/simulation/emergency-overflow`, { sector: 'Sector 4' });
                setSimMsg({ type: 'success', text: `${t('admin.sim_overflow_ok')} — ${res.data.bins_overflowed} bins` });
              } catch { setSimMsg({ type: 'error', text: t('admin.sim_fail') }); }
              finally { setSimLoading(false); }
            }}
            style={{ flex: 1, minWidth: 200, padding: '0.85rem', fontSize: '0.9rem' }}
          >
            {simLoading ? '⏳…' : `🚨 ${t('admin.sim_overflow_btn')}`}
          </button>
          <button
            className="btn btn-primary"
            disabled={simLoading}
            onClick={async () => {
              setSimLoading(true);
              try {
                const res = await axios.post(`${API}/simulation/network-disconnect`);
                setSimMsg({ type: 'success', text: `${t('admin.sim_disconnect_ok')} — ${res.data.disconnected.length} sensors` });
              } catch { setSimMsg({ type: 'error', text: t('admin.sim_fail') }); }
              finally { setSimLoading(false); }
            }}
            style={{ flex: 1, minWidth: 200, padding: '0.85rem', fontSize: '0.9rem', background: 'var(--warning)', color: '#000', border: 'none' }}
          >
            {simLoading ? '⏳…' : `📡 ${t('admin.sim_disconnect_btn')}`}
          </button>
        </div>
        {simMsg && <div className={`toast ${simMsg.type}`} style={{ marginTop: '0.75rem' }}>{simMsg.text}</div>}
      </div>

      {sortedAlerts.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header"><h3>{t('admin.alerts_title')} ({sortedAlerts.length})</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('admin.col_id')}</th><th>{t('admin.col_type')}</th><th>{t('admin.col_severity')}</th><th>{t('admin.col_message')}</th><th>{t('admin.col_created')}</th></tr></thead>
              <tbody>
                {sortedAlerts.slice(0, 20).map(a => (
                  <tr key={a.alert_id}>
                    <td style={{ fontWeight: 600 }}>#{a.alert_id}</td>
                    <td><span className="badge moderate">{a.alert_type}</span></td>
                    <td><span className={`badge ${a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'critical' : a.severity === 'MEDIUM' ? 'moderate' : 'optimal'}`}>{a.severity}</span></td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeRoutes.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header"><h3>{t('admin.routes_title')} ({activeRoutes.length})</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('admin.col_route')}</th><th>{t('admin.col_truck')}</th><th>{t('admin.col_driver')}</th><th>{t('admin.col_started')}</th><th>{t('admin.col_status')}</th></tr></thead>
              <tbody>
                {activeRoutes.map(r => (
                  <tr key={r.route_id}>
                    <td style={{ fontWeight: 600 }}>#{r.route_id}</td>
                    <td>{r.plate_number}</td>
                    <td>{r.driver_name || '—'}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(r.start_time).toLocaleString()}</td>
                    <td><span className="badge optimal">{t('admin.in_progress')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header"><h3>{t('admin.fleet_title')} ({activeTrucks.length} / {trucks.length})</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('admin.col_truck')}</th><th>{t('admin.col_plate')}</th><th>{t('admin.col_capacity')}</th><th>{t('admin.col_status')}</th></tr></thead>
            <tbody>
              {trucks.map(tr => (
                <tr key={tr.truck_id}>
                  <td style={{ fontWeight: 600 }}>#{tr.truck_id}</td>
                  <td>{tr.plate_number}</td>
                  <td>{tr.capacity.toLocaleString()} kg</td>
                  <td><span className={`badge ${tr.is_active ? 'optimal' : 'moderate'}`}>{tr.is_active ? t('admin.active') : t('admin.inactive')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header"><h3>{t('admin.drivers_title')} ({drivers.length})</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('admin.col_id')}</th><th>{t('admin.col_name')}</th><th>{t('admin.col_license')}</th><th>{t('admin.col_status')}</th></tr></thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.driver_id}>
                  <td style={{ fontWeight: 600 }}>#{d.driver_id}</td>
                  <td>{d.name}</td>
                  <td>{d.license_no}</td>
                  <td><span className={`badge ${d.is_active ? 'optimal' : 'moderate'}`}>{d.is_active ? t('admin.active') : t('admin.inactive')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
