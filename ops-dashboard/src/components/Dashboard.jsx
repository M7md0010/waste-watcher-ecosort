import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Dashboard() {
  const [bins, setBins] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [b, t, r] = await Promise.all([
        axios.get(`${API}/dashboard/bins`),
        axios.get(`${API}/dashboard/trucks`),
        axios.get(`${API}/dashboard/routes`),
      ]);
      setBins(b.data);
      setTrucks(t.data);
      setRoutes(r.data);
    };
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, []);

  const criticalBins = bins.filter(b => b.current_level * b.importance_weight >= 70);
  const activeRoutes = routes.filter(r => r.status === 'IN_PROGRESS');
  const activeTrucks = trucks.filter(t => t.is_active);

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>System health overview at a glance</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon blue">🗑️</div>
          <div className="stat-info">
            <h4>Total Bins</h4>
            <div className="stat-value">{bins.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">🚩</div>
          <div className="stat-info">
            <h4>Priority Bins</h4>
            <div className="stat-value">{criticalBins.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🗺️</div>
          <div className="stat-info">
            <h4>Active Routes</h4>
            <div className="stat-value">{activeRoutes.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">🚛</div>
          <div className="stat-info">
            <h4>Active Trucks</h4>
            <div className="stat-value">{activeTrucks.length}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Bin Health Map</h3>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--success)',marginRight:4,verticalAlign:'middle'}}></span> Optimal</span>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--warning)',marginRight:4,verticalAlign:'middle'}}></span> Moderate</span>
            <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--danger)',marginRight:4,verticalAlign:'middle'}}></span> Critical</span>
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

      {activeRoutes.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header"><h3>Active Routes</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Route ID</th><th>Truck</th><th>Started</th><th>Status</th></tr></thead>
              <tbody>
                {activeRoutes.map(r => (
                  <tr key={r.route_id}>
                    <td>#{r.route_id}</td>
                    <td>{r.plate_number}</td>
                    <td>{new Date(r.start_time).toLocaleString()}</td>
                    <td><span className="badge optimal">In Progress</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
