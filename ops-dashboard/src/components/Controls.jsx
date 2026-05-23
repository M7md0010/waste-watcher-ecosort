import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import { useLang } from '../LangContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function googleMapsLink(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function Controls() {
  const { user } = useAuth();
  const { t } = useLang();
  const [trucks, setTrucks] = useState([]);
  const [truckId, setTruckId] = useState('');
  const [message, setMessage] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [allRoutes, setAllRoutes] = useState([]);
  const [efficiency, setEfficiency] = useState(null);

  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [tripLogs, setTripLogs] = useState([]);
  const [savingTrip, setSavingTrip] = useState(false);

  const [openReport, setOpenReport] = useState(null);
  const [reporting, setReporting] = useState(null);
  const reportRef = useRef(null);

  const driverId = user?.driver_id;

  const loadRoutes = () => axios.get(`${API}/dashboard/routes`).then(r => setAllRoutes(r.data));

  const loadTripLogs = async () => {
    if (!driverId) return;
    try {
      const res = await axios.get(`${API}/dashboard/trip-logs?driver_id=${driverId}`);
      setTripLogs(res.data);
    } catch {}
  };

  useEffect(() => {
    axios.get(`${API}/dashboard/trucks`).then(res => {
      const active = res.data.filter(t => t.is_active);
      setTrucks(active);
      if (active.length > 0) setTruckId(String(active[0].truck_id));
    });
    loadRoutes();
    loadTripLogs();
  }, []);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  useEffect(() => {
    const handleClick = (e) => {
      if (reportRef.current && !reportRef.current.contains(e.target)) setOpenReport(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const startTimer = () => { setElapsed(0); setTimerRunning(true); };

  const endTripAndSave = async () => {
    setTimerRunning(false);
    if (!driverId || elapsed === 0) return;
    setSavingTrip(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await axios.post(`${API}/dashboard/trip-logs`, { driver_id: driverId, trip_date: today, time_taken_seconds: elapsed });
      setMessage({ type: 'success', text: `${t('driver.trip_saved')} — ${formatDuration(elapsed)}` });
      setElapsed(0);
      loadTripLogs();
    } catch {
      setMessage({ type: 'error', text: 'Failed to save trip log' });
    } finally {
      setSavingTrip(false);
    }
  };

  const handleReport = async (binId, reportType) => {
    setReporting(binId);
    setOpenReport(null);
    try {
      await axios.post(`${API}/dashboard/bin-reports`, { bin_id: binId, user_id: user.user_id, report_type: reportType, description: null });
      setMessage({ type: 'success', text: `Report submitted for Bin #${binId}` });
    } catch {
      setMessage({ type: 'error', text: 'Report failed' });
    } finally {
      setReporting(null);
    }
  };

  const driverReportOptions = [
    { type: 'BLOCKED', label: t('driver.report_blocked') },
    { type: 'VANDALIZED', label: t('driver.report_vandalized') },
    { type: 'OTHER', label: t('driver.report_inaccessible') },
    { type: 'OTHER', label: t('driver.report_other') },
  ];

  const deleteRoute = async (id) => {
    if (!confirm(`Delete Route #${id}?`)) return;
    try {
      await axios.delete(`${API}/dashboard/routes/${id}`);
      setMessage({ type: 'success', text: `Route #${id} deleted` });
      if (routeData && routeData.route_id === id) setRouteData(null);
      loadRoutes();
    } catch { setMessage({ type: 'error', text: 'Delete failed' }); }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setMessage(null);
    setRouteData(null);
    setEfficiency(null);
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/dashboard/routes`, { truck_id: parseInt(truckId) });
      const routeId = res.data.route_id;
      const [stopsRes, effRes] = await Promise.all([
        axios.get(`${API}/dashboard/routes/${routeId}/stops`),
        axios.get(`${API}/dashboard/routes/${routeId}/efficiency`),
      ]);
      setRouteData({
        route_id: routeId,
        stops: stopsRes.data.stops,
        total_distance_km: stopsRes.data.total_distance_km,
        total_distance_m: stopsRes.data.total_distance_m,
        stops_created: res.data.stops_created,
      });
      setEfficiency(effRes.data);
      setMessage({ type: 'success', text: `Route generated — ${res.data.stops_created} bins, ${res.data.total_distance_m} m` });
      loadRoutes();
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate route' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>{t('driver.title')}</h2>
        <p>{t('driver.subtitle')}</p>
      </div>

      {message && <div className={`toast ${message.type}`}>{message.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ maxWidth: 'none' }}>
          <div className="card-header"><h3>{t('driver.generate')}</h3></div>
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label>{t('driver.assign_truck')}</label>
              <select className="form-select" value={truckId} onChange={e => setTruckId(e.target.value)} required>
                {trucks.map(tr => (
                  <option key={tr.truck_id} value={tr.truck_id}>{tr.plate_number} — {tr.capacity.toLocaleString()} kg</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={generating} style={{ padding: '0.75rem', fontSize: '0.95rem' }}>
              {generating ? t('driver.computing') : t('driver.btn_generate')}
            </button>
          </form>
        </div>

        <div className="card trip-timer-card">
          <div className="card-header"><h3>{t('driver.timer_title')}</h3></div>
          <div className="trip-timer-display">
            <div className={`trip-timer-clock ${timerRunning ? 'running' : ''}`}>{formatDuration(elapsed)}</div>
            <div className="timer-controls">
              {!timerRunning ? (
                <button className="btn btn-success" onClick={startTimer} disabled={savingTrip}>{t('driver.start_timer')}</button>
              ) : (
                <button className="btn btn-danger" onClick={endTripAndSave} disabled={savingTrip} style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>
                  {savingTrip ? t('driver.saving') : t('driver.end_trip')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {routeData && routeData.stops.length > 0 && (
        <>
          <div className="stats-row" style={{ marginTop: '1.5rem' }}>
            <div className="stat-card"><div className="stat-icon blue">📏</div><div className="stat-info"><h4>{t('driver.total_dist')}</h4><div className="stat-value">{routeData.total_distance_m.toLocaleString()} m</div></div></div>
            <div className="stat-card"><div className="stat-icon green">📍</div><div className="stat-info"><h4>{t('driver.total_stops')}</h4><div className="stat-value">{routeData.stops.length}</div></div></div>
            <div className="stat-card"><div className="stat-icon yellow">📐</div><div className="stat-info"><h4>{t('driver.avg_leg')}</h4><div className="stat-value">{Math.round(routeData.total_distance_m / routeData.stops.length)} m</div></div></div>
          </div>

          {efficiency && (
            <div className="card" style={{ marginTop: '1rem', border: '1px solid var(--accent)', background: 'rgba(99,102,241,0.05)' }}>
              <div className="card-header"><h3>{t('driver.eff_title')}</h3></div>
              <div className="stats-row">
                <div className="stat-card"><div className="stat-icon green">✅</div><div className="stat-info"><h4>{t('driver.eff_optimized')}</h4><div className="stat-value">{efficiency.optimized_km.toFixed(2)} km</div></div></div>
                <div className="stat-card"><div className="stat-icon red">❌</div><div className="stat-info"><h4>{t('driver.eff_unoptimized')}</h4><div className="stat-value">{efficiency.unoptimized_km.toFixed(2)} km</div></div></div>
                <div className="stat-card"><div className="stat-icon blue">💰</div><div className="stat-info"><h4>{t('driver.eff_saved')}</h4><div className="stat-value">{efficiency.saved_km.toFixed(2)} km</div></div></div>
                <div className="stat-card"><div className="stat-icon yellow">📊</div><div className="stat-info"><h4>{t('driver.eff_gain')}</h4><div className="stat-value">{efficiency.saved_pct}%</div></div></div>
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header">
              <h3>{t('driver.itinerary')} — #{routeData.route_id}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href={`${API}/dashboard/routes/${routeData.route_id}/pdf`} download className="btn btn-primary btn-sm">{t('driver.download_pdf')}</a>
                <a href={`${API}/dashboard/routes/${routeData.route_id}/pdf-ar`} download className="btn btn-primary btn-sm">{t('driver.download_pdf_ar')}</a>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('driver.col_stop')}</th>
                    <th>{t('driver.col_bin')}</th>
                    <th>{t('driver.col_location')}</th>
                    <th>{t('driver.col_coords')}</th>
                    <th>{t('driver.col_fill')}</th>
                    <th>{t('driver.col_priority')}</th>
                    <th>{t('driver.col_leg')}</th>
                    <th>{t('driver.col_cumulative')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {routeData.stops.map((stop) => (
                    <tr key={stop.bin_id}>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>{stop.stop_sequence}</td>
                      <td style={{ fontWeight: 600 }}>#{stop.bin_id}</td>
                      <td>
                        {stop.street_name}
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.8rem' }}>{stop.neighborhood}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                      </td>
                      <td>
                        <div className="fill-bar">
                          <div className={`fill-bar-inner ${stop.current_level * stop.importance_weight >= 70 ? 'critical' : 'moderate'}`} style={{ width: `${Math.min(stop.current_level, 100)}%` }} />
                        </div>
                        <span className="fill-text">{stop.current_level.toFixed(1)}%</span>
                      </td>
                      <td>
                        {stop.importance_weight >= 2.0 ? <span className="badge hospital">🏥 {t('driver.hospital')}</span> :
                         stop.importance_weight >= 1.5 ? <span className="badge industrial">🏭 {t('driver.industrial')}</span> :
                         <span className="badge optimal">{t('driver.standard')}</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {stop.distance_from_prev_m >= 1000 ? `${(stop.distance_from_prev_m / 1000).toFixed(2)} km` : `${stop.distance_from_prev_m.toFixed(0)} m`}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {stop.stop_sequence === 1 ? t('driver.from_depot') : `${t('driver.from_stop')} ${stop.stop_sequence - 1}`}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{stop.cumulative_distance_km.toFixed(3)} km</td>
                      <td>
                        <div className="stop-actions">
                          <a href={googleMapsLink(stop.latitude, stop.longitude)} target="_blank" rel="noopener noreferrer" className="btn btn-navigate btn-sm">
                            {t('driver.navigate')}
                          </a>
                          <div style={{ position: 'relative' }}>
                            <button className="btn report-trigger-btn btn-sm" onClick={() => setOpenReport(openReport === stop.bin_id ? null : stop.bin_id)} disabled={reporting === stop.bin_id}>
                              {t('driver.report_issue')}
                            </button>
                            {openReport === stop.bin_id && (
                              <div className="report-dropdown" ref={reportRef}>
                                {driverReportOptions.map((opt, idx) => (
                                  <button key={idx} className="report-dropdown-item" onClick={() => handleReport(stop.bin_id, opt.type)}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header"><h3>{t('driver.visual_map')}</h3></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--success-bg)', border: '2px solid var(--success)', color: 'var(--success)', fontWeight: 700, fontSize: '0.75rem' }}>🏠</div>
                  <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 20 }} />
                </div>
                <div style={{ flex: 1, padding: '0.5rem 0' }}>
                  <span style={{ fontWeight: 600 }}>{t('driver.depot')}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>40.7128, -74.0060</span>
                </div>
              </div>

              {routeData.stops.map((stop, i) => (
                <div key={stop.bin_id} style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stop.importance_weight >= 2.0 ? 'rgba(168,85,247,0.2)' : 'rgba(99,102,241,0.15)', border: `2px solid ${stop.importance_weight >= 2.0 ? '#a855f7' : 'var(--accent)'}`, color: stop.importance_weight >= 2.0 ? '#a855f7' : 'var(--accent)', fontWeight: 700, fontSize: '0.8rem', zIndex: 2 }}>
                      {stop.stop_sequence}
                    </div>
                    {i < routeData.stops.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 30, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', background: 'var(--bg-card)', padding: '0 4px' }}>
                          ↓ {routeData.stops[i + 1].distance_from_prev_m.toFixed(0)} m
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>Bin #{stop.bin_id}</span>
                      <span className={`badge ${stop.current_level * stop.importance_weight >= 70 ? 'critical' : 'moderate'}`}>{stop.current_level.toFixed(0)}%</span>
                      {stop.importance_weight >= 2.0 && <span className="badge hospital">🏥</span>}
                      {stop.importance_weight >= 1.5 && stop.importance_weight < 2.0 && <span className="badge industrial">🏭</span>}
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                        +{stop.distance_from_prev_m.toFixed(0)} m → {stop.cumulative_distance_km.toFixed(3)} km
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>📍 {stop.street_name}, {stop.neighborhood}</span>
                      <span style={{ fontFamily: 'monospace' }}>({stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)})</span>
                      <a href={googleMapsLink(stop.latitude, stop.longitude)} target="_blank" rel="noopener noreferrer" className="btn btn-navigate btn-xs" style={{ marginLeft: 'auto' }}>
                        {t('driver.navigate')}
                      </a>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{t('driver.route_complete')}</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
                  {routeData.total_distance_m.toLocaleString()} m ({routeData.total_distance_km.toFixed(3)} km)
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {allRoutes.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header"><h3>{t('driver.route_history')} ({allRoutes.length})</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('admin.col_route')}</th><th>{t('admin.col_truck')}</th><th>{t('admin.col_created')}</th><th>{t('admin.col_status')}</th><th></th></tr></thead>
              <tbody>
                {allRoutes.map(r => (
                  <tr key={r.route_id}>
                    <td style={{ fontWeight: 600 }}>#{r.route_id}</td>
                    <td>{r.plate_number}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(r.start_time).toLocaleString()}</td>
                    <td><span className={`badge ${r.status === 'IN_PROGRESS' ? 'optimal' : 'moderate'}`}>{r.status}</span></td>
                    <td><button className="btn-icon danger" onClick={() => deleteRoute(r.route_id)} title="Delete">🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header"><h3>{t('driver.trip_history')}</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('driver.col_log')}</th><th>{t('driver.col_date')}</th><th>{t('driver.col_duration')}</th></tr></thead>
            <tbody>
              {tripLogs.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t('driver.no_trips')}</td></tr>
              ) : (
                tripLogs.map(log => (
                  <tr key={log.log_id}>
                    <td style={{ fontWeight: 600 }}>#{log.log_id}</td>
                    <td>{new Date(log.trip_date).toLocaleDateString()}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{formatDuration(log.time_taken_seconds)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
