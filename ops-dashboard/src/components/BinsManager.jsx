import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLang } from '../LangContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const EMPTY_BIN = { street_id: '', waste_type: 'General', current_level: 0, latitude: 40.712, longitude: -74.006, importance_weight: 1.0 };

export default function BinsManager() {
  const { t } = useLang();
  const [bins, setBins] = useState([]);
  const [streets, setStreets] = useState([]);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const load = async () => {
    const [b, s] = await Promise.all([
      axios.get(`${API}/dashboard/bins`),
      axios.get(`${API}/dashboard/streets`),
    ]);
    setBins(b.data);
    setStreets(s.data);
  };

  useEffect(() => { load(); }, []);

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const openAdd = () => setModal({ mode: 'add', data: { ...EMPTY_BIN, street_id: streets[0]?.street_id || '' } });
  const openEdit = (bin) => setModal({ mode: 'edit', data: { ...bin } });
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    const d = modal.data;
    try {
      if (modal.mode === 'add') {
        await axios.post(`${API}/dashboard/bins`, {
          street_id: parseInt(d.street_id), waste_type: d.waste_type,
          current_level: parseFloat(d.current_level), latitude: parseFloat(d.latitude),
          longitude: parseFloat(d.longitude), importance_weight: parseFloat(d.importance_weight),
        });
        flash('Bin created');
      } else {
        await axios.patch(`${API}/dashboard/bins/${d.bin_id}`, {
          current_level: parseFloat(d.current_level),
          importance_weight: parseFloat(d.importance_weight),
          waste_type: d.waste_type,
        });
        flash(`Bin #${d.bin_id} updated`);
      }
      closeModal();
      load();
    } catch { flash('Operation failed', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete Bin #${id}?`)) return;
    try { await axios.delete(`${API}/dashboard/bins/${id}`); flash(`Bin #${id} deleted`); load(); }
    catch { flash('Delete failed', 'error'); }
  };

  const setField = (key, val) => setModal(m => ({ ...m, data: { ...m.data, [key]: val } }));

  const getStatus = (b) => {
    const score = b.current_level * b.importance_weight;
    if (score >= 70) return { cls: 'critical', label: t('status.critical') };
    if (score > 40) return { cls: 'moderate', label: t('status.moderate') };
    return { cls: 'optimal', label: t('status.optimal') };
  };

  const getImportanceLabel = (w) => {
    if (w >= 2.0) return <span className="badge hospital">🏥 {t('bins.hospital')}</span>;
    if (w >= 1.5) return <span className="badge industrial">🏭 {t('bins.industrial')}</span>;
    return <span className="badge optimal">{t('bins.standard')}</span>;
  };

  return (
    <>
      <div className="page-header">
        <h2>{t('bins.title')}</h2>
        <p>{t('bins.subtitle')}</p>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="card">
        <div className="card-header">
          <h3>{bins.length} {t('nav.bins')}</h3>
          <button className="btn btn-primary" onClick={openAdd}>{t('bins.add')}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('bins.col_id')}</th><th>{t('bins.col_location')}</th><th>{t('bins.col_type')}</th><th>{t('bins.col_importance')}</th>
                <th>{t('bins.col_fill')}</th><th>{t('bins.col_score')}</th><th>{t('bins.col_status')}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {bins.map(b => {
                const score = b.current_level * b.importance_weight;
                const st = getStatus(b);
                return (
                  <tr key={b.bin_id}>
                    <td style={{ fontWeight: 600 }}>#{b.bin_id}</td>
                    <td>{b.street_name}<span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.8rem' }}>{b.neighborhood}</span></td>
                    <td>{b.waste_type}</td>
                    <td>{getImportanceLabel(b.importance_weight)}</td>
                    <td>
                      <div className="fill-bar"><div className={`fill-bar-inner ${st.cls}`} style={{ width: `${Math.min(b.current_level, 100)}%` }} /></div>
                      <span className="fill-text">{b.current_level.toFixed(1)}%</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{score.toFixed(0)}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-icon" onClick={() => openEdit(b)} title="Edit">✏️</button>
                        <button className="btn-icon danger" onClick={() => handleDelete(b.bin_id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'add' ? t('bins.add_title') : t('bins.edit_title')}</h3>
              <button className="btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              {modal.mode === 'add' && (
                <div className="form-group">
                  <label>{t('bins.street')}</label>
                  <select className="form-select" value={modal.data.street_id} onChange={e => setField('street_id', e.target.value)}>
                    {streets.map(s => <option key={s.street_id} value={s.street_id}>{s.street_name} — {s.neighborhood}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>{t('bins.waste_type')}</label>
                  <select className="form-select" value={modal.data.waste_type} onChange={e => setField('waste_type', e.target.value)}>
                    <option>General</option><option>Recyclable</option><option>Organic</option><option>Hazardous</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('bins.importance')}</label>
                  <select className="form-select" value={modal.data.importance_weight} onChange={e => setField('importance_weight', e.target.value)}>
                    <option value="1.0">{t('bins.standard')}</option>
                    <option value="1.5">{t('bins.industrial')}</option>
                    <option value="2.0">{t('bins.hospital')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{t('bins.fill_level')}</label>
                <input className="form-input" type="number" min="0" max="100" value={modal.data.current_level} onChange={e => setField('current_level', e.target.value)} />
              </div>
              {modal.mode === 'add' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('bins.latitude')}</label>
                    <input className="form-input" type="number" step="0.0001" value={modal.data.latitude} onChange={e => setField('latitude', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('bins.longitude')}</label>
                    <input className="form-input" type="number" step="0.0001" value={modal.data.longitude} onChange={e => setField('longitude', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>{t('bins.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave}>{modal.mode === 'add' ? t('bins.create') : t('bins.save')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
