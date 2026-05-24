import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLang } from '../LangContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function loadCSS(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

export default function RouteMap() {
  const { t } = useLang();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routeLayerRef = useRef(null);
  const [bins, setBins] = useState([]);
  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadCSS(LEAFLET_CSS);
    loadScript(LEAFLET_JS).then(() => {
      if (!cancelled) setMapReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;

    const L = window.L;
    const map = L.map(mapRef.current, {
      center: [29.9726, 30.9443],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    axios.get(`${API}/map/bins`).then(res => {
      setBins(res.data);
      res.data.forEach(b => {
        const score = b.current_level * b.importance_weight;
        const color = score >= 70 ? '#ef4444' : score > 40 ? '#f59e0b' : '#10b981';
        const circle = L.circleMarker([Number(b.latitude), Number(b.longitude)], {
          radius: 8,
          fillColor: color,
          color: '#1e1e2e',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map);
        circle.bindPopup(
          `<div style="font-family:Inter,sans-serif;min-width:160px">` +
          `<b style="font-size:14px">Bin #${b.bin_id}</b><br>` +
          `<span style="color:${color};font-weight:700">${Number(b.current_level).toFixed(0)}%</span> fill<br>` +
          `${b.waste_type} &middot; ${b.street_name}<br>` +
          `<span style="font-size:11px;color:#888">Weight: ${b.importance_weight}x</span>` +
          `</div>`
        );
      });

      L.marker([29.9726, 30.9443], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#6366f1;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏠</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      }).addTo(map).bindPopup('<b>Depot</b><br>Al Hosary Square');
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [mapReady]);

  const calculateRoute = async () => {
    setLoading(true);
    setMessage(null);
    setRouteResult(null);

    if (routeLayerRef.current && mapInstance.current) {
      mapInstance.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    try {
      const res = await axios.post(`${API}/map/route`);
      const data = res.data;
      setRouteResult(data);

      if (data.polyline && data.polyline.length > 1 && mapInstance.current) {
        const L = window.L;
        const polyline = L.polyline(data.polyline, {
          color: '#6366f1',
          weight: 5,
          opacity: 0.85,
          smoothFactor: 1,
        }).addTo(mapInstance.current);
        routeLayerRef.current = L.layerGroup().addTo(mapInstance.current);
        routeLayerRef.current.addLayer(polyline);

        data.stops.forEach((stop, i) => {
          const marker = L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
              className: '',
              html: `<div style="background:#6366f1;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${i + 1}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
          });
          marker.bindPopup(
            `<div style="font-family:Inter,sans-serif">` +
            `<b>Stop ${i + 1} - Bin #${stop.bin_id}</b><br>` +
            `${stop.waste_type} &middot; ${stop.street}<br>` +
            `Fill: <b style="color:#ef4444">${stop.fill.toFixed(0)}%</b><br>` +
            `Leg: ${stop.distance_from_prev_m.toFixed(0)} m` +
            `</div>`
          );
          routeLayerRef.current.addLayer(marker);
        });

        mapInstance.current.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      }

      setMessage({ type: 'success', text: `${t('map.route_ok')} ${data.stops.length} stops, ${(data.total_distance_m / 1000).toFixed(2)} km` });
    } catch {
      setMessage({ type: 'error', text: t('map.route_fail') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>{t('map.title')}</h2>
        <p>{t('map.subtitle')}</p>
      </div>

      {message && <div className={`toast ${message.type}`}>{message.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1rem', marginTop: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 500 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 500 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div className="card-header"><h3>{t('map.controls')}</h3></div>
            <button
              className="btn btn-primary"
              onClick={calculateRoute}
              disabled={loading}
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
            >
              {loading ? t('map.computing') : t('map.btn_calculate')}
            </button>
          </div>

          <div className="card">
            <div className="card-header"><h3>{t('map.legend')}</h3></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                {t('map.legend_optimal')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                {t('map.legend_moderate')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                {t('map.legend_critical')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                {t('map.legend_route')}
              </div>
            </div>
          </div>

          {routeResult && routeResult.stops.length > 0 && (
            <div className="card" style={{ border: '1px solid var(--accent)' }}>
              <div className="card-header"><h3>{t('map.stats')}</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('map.total_dist')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{(routeResult.total_distance_m / 1000).toFixed(2)} km</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('map.stops')}</span>
                  <span style={{ fontWeight: 700 }}>{routeResult.stops.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('map.est_time')}</span>
                  <span style={{ fontWeight: 700 }}>{Math.ceil(routeResult.total_distance_m / 1000 / 25 * 60)} min</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontSize: '0.8rem' }}>
                  {routeResult.stops.map((s, i) => (
                    <div key={s.bin_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                      <span>{i + 1}. Bin #{s.bin_id}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{s.fill.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
