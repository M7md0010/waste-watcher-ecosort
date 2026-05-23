import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLang } from '../LangContext';

const API = 'http://localhost:8000/api/v1';

export default function FleetManager() {
  const { t } = useLang();
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const load = async () => {
    const [tr, d] = await Promise.all([
      axios.get(`${API}/dashboard/trucks`),
      axios.get(`${API}/dashboard/drivers`),
    ]);
    setTrucks(tr.data);
    setDrivers(d.data);
  };

  useEffect(() => { load(); }, []);

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const openAddTruck = () => setModal({ entity: 'truck', mode: 'add', data: { plate_number: '', capacity: 5000 } });
  const openEditTruck = (tr) => setModal({ entity: 'truck', mode: 'edit', data: { ...tr } });

  const saveTruck = async () => {
    const d = modal.data;
    try {
      if (modal.mode === 'add') {
        await axios.post(`${API}/dashboard/trucks`, { plate_number: d.plate_number, capacity: parseFloat(d.capacity) });
        flash('Truck added');
      } else {
        await axios.patch(`${API}/dashboard/trucks/${d.truck_id}`, { plate_number: d.plate_number, capacity: parseFloat(d.capacity), is_active: d.is_active });
        flash(`Truck #${d.truck_id} updated`);
      }
      setModal(null); load();
    } catch { flash('Operation failed', 'error'); }
  };

  const deleteTruck = async (id) => {
    if (!confirm(`Delete Truck #${id}?`)) return;
    try { await axios.delete(`${API}/dashboard/trucks/${id}`); flash(`Truck #${id} deleted`); load(); }
    catch { flash('Delete failed', 'error'); }
  };

  const openAddDriver = () => setModal({ entity: 'driver', mode: 'add', data: { name: '', license_no: '' } });
  const openEditDriver = (d) => setModal({ entity: 'driver', mode: 'edit', data: { ...d } });

  const saveDriver = async () => {
    const d = modal.data;
    try {
      if (modal.mode === 'add') {
        await axios.post(`${API}/dashboard/drivers`, { name: d.name, license_no: d.license_no });
        flash('Driver added');
      } else {
        await axios.patch(`${API}/dashboard/drivers/${d.driver_id}`, { name: d.name, license_no: d.license_no });
        flash(`Driver #${d.driver_id} updated`);
      }
      setModal(null); load();
    } catch { flash('Operation failed', 'error'); }
  };

  const deleteDriver = async (id) => {
    if (!confirm(`Delete Driver #${id}?`)) return;
    try { await axios.delete(`${API}/dashboard/drivers/${id}`); flash(`Driver #${id} deleted`); load(); }
    catch { flash('Delete failed', 'error'); }
  };

  const setField = (key, val) => setModal(m => ({ ...m, data: { ...m.data, [key]: val } }));
  const closeModal = () => setModal(null);

  const getModalTitle = () => {
    if (modal.entity === 'truck') {
      return modal.mode === 'add' ? t('fleet.add_truck_title') : t('fleet.edit_truck_title');
    }
    return modal.mode === 'add' ? t('fleet.add_driver_title') : t('fleet.edit_driver_title');
  };

  return (
    <>
      <div className="page-header">
        <h2>{t('fleet.title')}</h2>
        <p>{t('fleet.subtitle')}</p>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <h3>🚛 {t('fleet.trucks')} ({trucks.length})</h3>
          <button className="btn btn-primary" onClick={openAddTruck}>{t('fleet.add_truck')}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('fleet.col_id')}</th><th>{t('fleet.col_plate')}</th><th>{t('fleet.col_capacity')}</th><th>{t('fleet.col_status')}</th><th></th></tr></thead>
            <tbody>
              {trucks.map(tr => (
                <tr key={tr.truck_id}>
                  <td style={{ fontWeight: 600 }}>#{tr.truck_id}</td>
                  <td>{tr.plate_number}</td>
                  <td>{tr.capacity.toLocaleString()}</td>
                  <td><span className={`badge ${tr.is_active ? 'optimal' : 'moderate'}`}>{tr.is_active ? t('fleet.active') : t('fleet.inactive')}</span></td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-icon" onClick={() => openEditTruck(tr)} title="Edit">✏️</button>
                      <button className="btn-icon danger" onClick={() => deleteTruck(tr.truck_id)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>👤 {t('fleet.drivers')} ({drivers.length})</h3>
          <button className="btn btn-primary" onClick={openAddDriver}>{t('fleet.add_driver')}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('fleet.col_id')}</th><th>{t('fleet.col_name')}</th><th>{t('fleet.col_license')}</th><th></th></tr></thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.driver_id}>
                  <td style={{ fontWeight: 600 }}>#{d.driver_id}</td>
                  <td>{d.name}</td>
                  <td>{d.license_no}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-icon" onClick={() => openEditDriver(d)} title="Edit">✏️</button>
                      <button className="btn-icon danger" onClick={() => deleteDriver(d.driver_id)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{getModalTitle()}</h3>
              <button className="btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              {modal.entity === 'truck' ? (
                <>
                  <div className="form-group">
                    <label>{t('fleet.plate_number')}</label>
                    <input className="form-input" value={modal.data.plate_number} onChange={e => setField('plate_number', e.target.value)} placeholder="e.g. ABC-123" />
                  </div>
                  <div className="form-group">
                    <label>{t('fleet.capacity')}</label>
                    <input className="form-input" type="number" value={modal.data.capacity} onChange={e => setField('capacity', e.target.value)} />
                  </div>
                  {modal.mode === 'edit' && (
                    <div className="form-group">
                      <label>{t('fleet.status')}</label>
                      <select className="form-select" value={modal.data.is_active ? 'true' : 'false'} onChange={e => setField('is_active', e.target.value === 'true')}>
                        <option value="true">{t('fleet.active')}</option>
                        <option value="false">{t('fleet.inactive')}</option>
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>{t('fleet.full_name')}</label>
                    <input className="form-input" value={modal.data.name} onChange={e => setField('name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('fleet.license_no')}</label>
                    <input className="form-input" value={modal.data.license_no} onChange={e => setField('license_no', e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>{t('fleet.cancel')}</button>
              <button className="btn btn-primary" onClick={modal.entity === 'truck' ? saveTruck : saveDriver}>
                {modal.mode === 'add' ? t('fleet.create') : t('fleet.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
