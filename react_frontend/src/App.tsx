import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

type Point = [number, number];
type Device = {
  id: string;
  name: string;
  category: 'lights' | 'fans' | 'ac';
  status: 'ON' | 'OFF' | 'Standby';
  relay?: number;
  quadrant?: string;
  quadrantNum?: number;
  powerWatts?: number;
  isAutomated?: boolean;
};
type Zone = {
  id: string;
  name: string;
  points: Point[];
  assignedDeviceIds: string[];
  color: string;
  occupantCount: number;
};
type Section = { id: string; name: string; subtitle: string; zones: Zone[] };
type Box = { x1: number; y1: number; x2: number; y2: number; confidence: number };

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

const QUADRANT_CONFIG: Array<{
  id: string;
  num: number;
  name: string;
  pos: string;
  relay: number;
  pin: number;
  points: Point[];
}> = [
  { id: '1', num: 1, name: 'Quadrant 1', pos: 'Top-Left', relay: 1, pin: 16, points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] },
  { id: '2', num: 2, name: 'Quadrant 2', pos: 'Top-Right', relay: 2, pin: 17, points: [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]] },
  { id: '3', num: 3, name: 'Quadrant 3', pos: 'Bottom-Left', relay: 3, pin: 18, points: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]] },
  { id: '4', num: 4, name: 'Quadrant 4', pos: 'Bottom-Right', relay: 4, pin: 19, points: [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]] },
];

const QUADRANT_MAP: Record<number, { pos: string; pin: number }> = {
  1: { pos: 'Top-Left', pin: 16 },
  2: { pos: 'Top-Right', pin: 17 },
  3: { pos: 'Bottom-Left', pin: 18 },
  4: { pos: 'Bottom-Right', pin: 19 },
};

function normalizeZones(zones: Array<Zone & { points: string }>): Zone[] {
  return zones.map((zone, index) => ({
    ...zone,
    points: index < 4 ? QUADRANT_CONFIG[index].points : (zone.points as any),
    name: index < 4 ? `Quadrant ${index + 1}` : zone.name,
  }));
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionInFlight = useRef(false);
  const captureRef = useRef<() => void>(() => undefined);

  const [connected, setConnected] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [cameraError, setCameraError] = useState('');
  const [modelError, setModelError] = useState('');
  const [cameraFps, setCameraFps] = useState<number | null>(null);

  const [isCameraOn, setIsCameraOn] = useState(() => window.localStorage.getItem('seros_camera_enabled') !== 'false');
  const [mirror, setMirror] = useState(() => window.localStorage.getItem('seros_camera_mirror') === 'true');
  const [captureInterval, setCaptureInterval] = useState(() => Number(window.localStorage.getItem('seros_capture_interval') || 3));
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');

  // Device management state
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'lights' | 'fans' | 'ac'>('all');
  const [newDeviceQuadrant, setNewDeviceQuadrant] = useState('1');
  const [newDeviceCat, setNewDeviceCat] = useState<'lights' | 'fans' | 'ac'>('lights');
  const [newDeviceName, setNewDeviceName] = useState('Quadrant 1 Light');
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit Device State
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editDeviceName, setEditDeviceName] = useState('');
  const [editDeviceQuadrant, setEditDeviceQuadrant] = useState('1');
  const [editDeviceCat, setEditDeviceCat] = useState<'lights' | 'fans' | 'ac'>('lights');
  const [isUpdatingDevice, setIsUpdatingDevice] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/state/`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setConnected(true);
      setDevices(data.devices || []);
      const nextSections = (data.sections || []).map((section: Section & { zones: Array<Zone & { points: string }> }) => ({
        ...section,
        zones: normalizeZones(section.zones || []),
      }));
      setSections(nextSections);
      setSectionId(current => current || nextSections[0]?.id || '');
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
    const timer = window.setInterval(loadState, 3000);
    return () => window.clearInterval(timer);
  }, [loadState]);

  const handleQuadrantSelect = (q: string) => {
    setNewDeviceQuadrant(q);
    const catName = newDeviceCat === 'lights' ? 'Light' : newDeviceCat === 'fans' ? 'Fan' : 'AC';
    setNewDeviceName(`Quadrant ${q} ${catName}`);
  };

  const handleCategorySelect = (cat: 'lights' | 'fans' | 'ac') => {
    setNewDeviceCat(cat);
    const catName = cat === 'lights' ? 'Light' : cat === 'fans' ? 'Fan' : 'AC';
    setNewDeviceName(`Quadrant ${newDeviceQuadrant} ${catName}`);
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const quadNum = parseInt(newDeviceQuadrant, 10) || 1;
    const catName = newDeviceCat === 'lights' ? 'Light' : newDeviceCat === 'fans' ? 'Fan' : 'AC';
    const name = newDeviceName.trim() || `Quadrant ${quadNum} ${catName}`;
    setIsAddingDevice(true);
    try {
      const res = await fetch(`${API}/api/devices/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quadrant: quadNum,
          relay: quadNum,
          name,
          category: newDeviceCat,
        }),
      });
      if (res.ok) {
        setNewDeviceName(`Quadrant ${quadNum} ${catName}`);
        await loadState();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingDevice(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const res = await fetch(`${API}/api/devices/${deviceId}/`, { method: 'DELETE' });
      if (res.ok) {
        await loadState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEdit = (device: Device) => {
    const qNum = getDeviceQuadrantNum(device);
    setEditingDevice(device);
    setEditDeviceName(device.name);
    setEditDeviceQuadrant(String(qNum));
    setEditDeviceCat(device.category);
  };

  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    const quadNum = parseInt(editDeviceQuadrant, 10) || 1;
    const trimmed = editDeviceName.trim();
    if (!trimmed) return;
    setIsUpdatingDevice(true);
    try {
      const res = await fetch(`${API}/api/devices/${editingDevice.id}/update/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          category: editDeviceCat,
          quadrant: quadNum,
          relay: quadNum,
        }),
      });
      if (res.ok) {
        setEditingDevice(null);
        await loadState();
      }
    } catch (err) {
      console.error('Failed to update device:', err);
    } finally {
      setIsUpdatingDevice(false);
    }
  };

  const handleToggleDevice = async (device: Device) => {
    setTogglingId(device.id);
    try {
      const nextOn = device.status !== 'ON';
      await fetch(`${API}/api/devices/${device.id}/control/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: nextOn }),
      });
      await loadState();
    } catch (err) {
      console.error('Failed to toggle device:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const toggleCamera = async (nextState: boolean) => {
    setIsCameraOn(nextState);
    if (!nextState) {
      setBoxes([]);
    }
    try {
      await fetch(`${API}/api/camera/status/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      await loadState();
    } catch (err) {
      console.error('Failed to notify backend of camera status:', err);
    }
  };

  const capture = useCallback(async () => {
    if (!isCameraOn) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !sectionId || detectionInFlight.current) return;
    detectionInFlight.current = true;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (context) {
      context.save();
      if (mirror) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();
    }
    try {
      const response = await fetch(`${API}/api/detect/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          image: canvas.toDataURL('image/jpeg', 0.72),
          include_processed_frame: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setBoxes(data.boxes || []);
      if (Array.isArray(data.devices)) {
        setDevices(data.devices);
      }
      setModelError('');
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Detection failed.');
    } finally {
      detectionInFlight.current = false;
    }
  }, [mirror, sectionId, isCameraOn]);

  captureRef.current = () => { void capture(); };

  useEffect(() => {
    if (!isCameraOn) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraFps(null);
      setBoxes([]);
      return;
    }

    let stream: MediaStream | undefined;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: cameraId ? { exact: cameraId } : undefined,
            frameRate: { min: 30, ideal: 30 },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        const available = await navigator.mediaDevices.enumerateDevices();
        setCameras(available.filter(device => device.kind === 'videoinput'));
        const track = stream.getVideoTracks()[0];
        const actualFps = track.getSettings().frameRate;
        if (actualFps) setCameraFps(Math.round(actualFps));
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraError('');
      } catch {
        setCameraError('Camera permission was denied or no webcam is available.');
      }
    };
    void start();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [cameraId, isCameraOn]);

  useEffect(() => {
    if (!isCameraOn) return;
    const timer = window.setInterval(() => captureRef.current(), captureInterval * 1000);
    return () => window.clearInterval(timer);
  }, [captureInterval, isCameraOn]);

  useEffect(() => {
    window.localStorage.setItem('seros_camera_enabled', String(isCameraOn));
  }, [isCameraOn]);

  useEffect(() => {
    window.localStorage.setItem('seros_camera_mirror', String(mirror));
  }, [mirror]);

  useEffect(() => {
    window.localStorage.setItem('seros_capture_interval', String(captureInterval));
  }, [captureInterval]);

  const getDeviceQuadrantNum = (d: Device): number => {
    if (d.quadrantNum && d.quadrantNum >= 1 && d.quadrantNum <= 4) return d.quadrantNum;
    if (d.relay && d.relay >= 1 && d.relay <= 4) return d.relay;
    const nameMatch = (d.name || '').match(/quadrant\s*([1-4])/i) || (d.name || '').match(/q([1-4])/i);
    if (nameMatch) return parseInt(nameMatch[1], 10);
    const quadMatch = (d.quadrant || '').match(/quadrant\s*([1-4])/i) || (d.quadrant || '').match(/q([1-4])/i);
    if (quadMatch) return parseInt(quadMatch[1], 10);
    const idMatch = (d.id || '').match(/q([1-4])/i);
    if (idMatch) return parseInt(idMatch[1], 10);
    return 1;
  };

  const peopleInZone = (zoneIndex: number): number => {
    return boxes.filter(box => {
      const cx = (box.x1 + box.x2) / 2;
      const cy = (box.y1 + box.y2) / 2;
      if (zoneIndex === 0) return cx < 0.5 && cy < 0.5;
      if (zoneIndex === 1) return cx >= 0.5 && cy < 0.5;
      if (zoneIndex === 2) return cx < 0.5 && cy >= 0.5;
      if (zoneIndex === 3) return cx >= 0.5 && cy >= 0.5;
      return false;
    }).length;
  };

  const occupiedQuadrantsCount = [0, 1, 2, 3].filter(i => peopleInZone(i) > 0).length;
  const activeDevicesCount = devices.filter(d => d.status === 'ON').length;

  const filteredDevices = devices.filter(d => {
    if (deviceFilter === 'all') return true;
    return d.category === deviceFilter;
  });

  return (
    <div className="seros-app-shell">
      {/* Top Navigation Bar */}
      <header className="seros-topbar">
        <div className="seros-brand">
          <div className="brand-logo-icon">
            <Icon name="eco" size={20} color="#FFFFFF" />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <span className="brand-name">S.E.R.O.S.</span>
              <span className="brand-badge">Camera Center</span>
            </div>
            <span className="brand-subtitle">Smart Energy & Room Operating System</span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="eco-saver-pill">
            <Icon name="bolt" size={16} color="#9f6800" />
            <span>Eco-Saver Active</span>
          </div>

          <div className={`status-pill ${connected ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            <span>{connected ? 'Backend Online' : 'Backend Offline'}</span>
          </div>
        </div>
      </header>

      {/* Control Toolbar */}
      <section className="seros-toolbar">
        <button
          type="button"
          className={`btn-cam-toggle ${isCameraOn ? 'cam-on' : 'cam-off'}`}
          onClick={() => toggleCamera(!isCameraOn)}
          title={isCameraOn ? 'Click to turn camera OFF' : 'Click to turn camera ON'}
        >
          <Icon name={isCameraOn ? 'videocam' : 'videocam_off'} size={18} />
          <span>{isCameraOn ? 'Camera: Active' : 'Camera: Paused'}</span>
        </button>

        <div className="toolbar-input-group">
          <Icon name="camera" size={17} color="#68766B" />
          <select
            value={cameraId}
            disabled={!isCameraOn}
            onChange={e => setCameraId(e.target.value)}
            className="toolbar-select"
          >
            <option value="">Default Webcam</option>
            {cameras.map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Webcam ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-input-group">
          <Icon name="timer" size={17} color="#68766B" />
          <select
            value={captureInterval}
            disabled={!isCameraOn}
            onChange={e => setCaptureInterval(Number(e.target.value))}
            className="toolbar-select"
          >
            <option value={3}>Every 3 seconds</option>
            <option value={5}>Every 5 seconds</option>
            <option value={10}>Every 10 seconds</option>
          </select>
        </div>

        <button
          type="button"
          className={`toolbar-btn ${mirror ? 'active' : ''}`}
          disabled={!isCameraOn}
          onClick={() => setMirror(v => !v)}
          title="Mirror camera display"
        >
          <Icon name="flip" size={17} />
          <span>{mirror ? 'Mirrored' : 'Mirror'}</span>
        </button>

        <div className="toolbar-right-meta">
          <span className="sync-chip">
            <Icon name="refresh" size={14} color="#006934" />
            <span>{isCameraOn ? `Snapshots every ${captureInterval}s (Humans only)` : 'Camera Standby'}</span>
          </span>

          <span className={`fps-chip ${cameraFps !== null && cameraFps >= 25 ? 'good' : ''}`}>
            <Icon name="speed" size={14} />
            <span>{isCameraOn ? `${cameraFps ?? '--'} FPS` : 'OFF'}</span>
          </span>
        </div>
      </section>

      {/* Main Grid Layout */}
      <main className="seros-main-layout">
        {/* Left Side: Camera Stage + KPIs */}
        <section className="stage-column">
          <div className="camera-card">
            <div className="camera-head">
              <div className="camera-head-left">
                <div className="camera-icon-badge">
                  <Icon name="videocam" size={20} color="#006934" />
                </div>
                <div>
                  <h1 className="camera-card-title">Live 4-Quadrant Camera</h1>
                  <p className="camera-card-sub">Automated human presence detection & 4-relay hardware control</p>
                </div>
              </div>

              {isCameraOn ? (
                <div className="live-status-pill on">
                  <span className="pulse-dot" />
                  <span>LIVE FEED</span>
                </div>
              ) : (
                <div className="live-status-pill off">
                  <span className="pause-dot" />
                  <span>STANDBY</span>
                </div>
              )}
            </div>

            {/* Video Viewport Container */}
            <div className="camera-viewport-wrap">
              {isCameraOn ? (
                <>
                  <video ref={videoRef} muted playsInline className={`camera-video ${mirror ? 'mirrored' : ''}`} />
                  <canvas ref={canvasRef} hidden />

                  {/* SVG Quadrant Overlays */}
                  <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="camera-overlay-svg" aria-label="Camera quadrants">
                    {QUADRANT_CONFIG.map((q, idx) => {
                      const count = peopleInZone(idx);
                      const isOccupied = count > 0;
                      return (
                        <g key={q.id}>
                          <polygon
                            points={q.points.map(p => p.join(',')).join(' ')}
                            className={`zone-polygon ${isOccupied ? 'occupied' : ''}`}
                          />
                        </g>
                      );
                    })}

                    {/* Quadrant Crosshair Grid Lines */}
                    <line x1="0.5" y1="0" x2="0.5" y2="1" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.003" strokeDasharray="0.012 0.008" />
                    <line x1="0" y1="0.5" x2="1" y2="0.5" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.003" strokeDasharray="0.012 0.008" />

                    {/* Quadrant Watermark Identifiers */}
                    <text x="0.25" y="0.25" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.22)" fontSize="0.038" fontWeight="700">Q1 • TOP-LEFT</text>
                    <text x="0.75" y="0.25" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.22)" fontSize="0.038" fontWeight="700">Q2 • TOP-RIGHT</text>
                    <text x="0.25" y="0.75" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.22)" fontSize="0.038" fontWeight="700">Q3 • BOTTOM-LEFT</text>
                    <text x="0.75" y="0.75" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.22)" fontSize="0.038" fontWeight="700">Q4 • BOTTOM-RIGHT</text>

                    {/* Detected Person Dots & Auras */}
                    {boxes.map((box, idx) => (
                      <g key={idx}>
                        <circle
                          cx={(box.x1 + box.x2) / 2}
                          cy={(box.y1 + box.y2) / 2}
                          r="0.026"
                          className="person-pulse-aura"
                        />
                        <circle
                          cx={(box.x1 + box.x2) / 2}
                          cy={(box.y1 + box.y2) / 2}
                          r="0.014"
                          className="person-dot"
                        />
                      </g>
                    ))}
                  </svg>

                  {/* HTML Overlay Floating Quadrant Badges */}
                  <div className="quadrant-overlay-grid">
                    {QUADRANT_CONFIG.map((q, idx) => {
                      const count = peopleInZone(idx);
                      const isOccupied = count > 0;
                      return (
                        <div key={q.id} className={`quadrant-badge-card q-${q.num} ${isOccupied ? 'occupied' : ''}`}>
                          <div className="q-badge-header">
                            <span className="q-number-pill">Quadrant {q.num}</span>
                            <span className="q-pos-text">{q.pos}</span>
                            <span className="q-relay-pill">Relay {q.relay} (Pin {q.pin})</span>
                          </div>
                          <div className="q-presence-row">
                            <span className={`q-status-indicator ${isOccupied ? 'active' : ''}`} />
                            <span className="q-presence-text">
                              {isOccupied ? `${count} ${count === 1 ? 'Person' : 'People'} • Light ON` : 'Empty • Light OFF'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="camera-standby-view">
                  <div className="standby-icon-circle">
                    <Icon name="videocam_off" size={42} color="#006934" />
                  </div>
                  <h3>Camera Is In Standby</h3>
                  <p>Webcam capture and background person detection inference are paused to conserve energy.</p>
                  <button type="button" className="btn-wake-camera" onClick={() => toggleCamera(true)}>
                    <Icon name="videocam" size={18} color="#FFFFFF" />
                    <span>Turn Camera ON</span>
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="notice-box error">
                <Icon name="close" size={16} color="#B93832" />
                <span>{cameraError}</span>
              </div>
            )}
            {modelError && (
              <div className="notice-box error">
                <Icon name="close" size={16} color="#B93832" />
                <span>{modelError}</span>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar (Matching mobile app stat tiles) */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon-circle green">
                <Icon name="groups" size={24} color="#006934" />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Human Presence</span>
                <span className="kpi-value">{isCameraOn ? boxes.length : 0}</span>
                <span className="kpi-meta">{isCameraOn ? 'Detected across all 4 zones' : 'Camera is offline'}</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-circle amber">
                <Icon name="apps" size={24} color="#9f6800" />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Active Quadrants</span>
                <span className="kpi-value">{isCameraOn ? `${occupiedQuadrantsCount} / 4` : '0 / 4'}</span>
                <span className="kpi-meta">Occupied zone automated routing</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-circle lime">
                <Icon name="bolt" size={24} color="#006934" />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Active Relays</span>
                <span className="kpi-value">{activeDevicesCount}</span>
                <span className="kpi-meta">Devices powered ON</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-circle blue">
                <Icon name="verified" size={24} color="#1e6585" />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Hardware Link</span>
                <span className="kpi-value">4 Pins</span>
                <span className="kpi-meta">ESP32 Relays: 16, 17, 18, 19</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Quadrant Relays + Devices Management */}
        <aside className="control-sidebar">
          {/* Panel 1: Four Quadrant Relays Overview */}
          <div className="sidebar-panel">
            <div className="panel-header-row">
              <div className="panel-header-title">
                <Icon name="apps" size={18} color="#006934" />
                <h2>Camera Quadrants & Relays</h2>
              </div>
              <span className="panel-badge-pill">4 Zones</span>
            </div>
            <p className="panel-desc">
              When a person is detected in a quadrant, its assigned devices and hardware relay trigger automatically.
            </p>

            <div className="quadrant-status-list">
              {QUADRANT_CONFIG.map((q, idx) => {
                const count = peopleInZone(idx);
                const isOccupied = count > 0;
                const assigned = devices.filter(d => getDeviceQuadrantNum(d) === q.num);

                return (
                  <div key={q.id} className={`quadrant-row-item ${isOccupied ? 'active' : ''}`}>
                    <div className="quadrant-row-top">
                      <div className="quadrant-info">
                        <span className="quadrant-title">{q.name}</span>
                        <span className="quadrant-sub">{q.pos} • Relay {q.relay} (Pin {q.pin})</span>
                      </div>
                      <span className={`presence-pill ${isOccupied ? 'occupied' : 'empty'}`}>
                        {isOccupied ? (
                          <>
                            <Icon name="check_circle" size={13} color="#006934" />
                            <span>{count} {count === 1 ? 'person' : 'people'}</span>
                          </>
                        ) : (
                          <>
                            <span className="empty-circle" />
                            <span>Empty</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="quadrant-assigned-devices">
                      <span className="assigned-label">Assigned:</span>
                      {assigned.length === 0 ? (
                        <span className="assigned-empty">No devices assigned</span>
                      ) : (
                        <span className="assigned-names">
                          {assigned.map(d => `${d.name} (${d.status})`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel 2: Quadrant Devices Management */}
          <div className="sidebar-panel">
            <div className="panel-header-row">
              <div className="panel-header-title">
                <Icon name="lightbulb" size={18} color="#006934" />
                <h2>Quadrant Devices</h2>
              </div>
              <span className="panel-badge-pill">{devices.length} Total</span>
            </div>

            {/* Filter Tabs (All, Lights, Fans, AC) */}
            <div className="category-filter-bar">
              <button
                type="button"
                className={`filter-tab-btn ${deviceFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDeviceFilter('all')}
              >
                <Icon name="apps" size={14} />
                <span>All ({devices.length})</span>
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${deviceFilter === 'lights' ? 'active' : ''}`}
                onClick={() => setDeviceFilter('lights')}
              >
                <Icon name="lightbulb" size={14} />
                <span>Lights</span>
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${deviceFilter === 'fans' ? 'active' : ''}`}
                onClick={() => setDeviceFilter('fans')}
              >
                <Icon name="mode_fan" size={14} />
                <span>Fans</span>
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${deviceFilter === 'ac' ? 'active' : ''}`}
                onClick={() => setDeviceFilter('ac')}
              >
                <Icon name="ac_unit" size={14} />
                <span>AC</span>
              </button>
            </div>

            {/* Device Cards List */}
            <div className="devices-cards-list">
              {filteredDevices.length === 0 ? (
                <div className="empty-devices-state">
                  <Icon name="apps" size={28} color="#68766B" />
                  <p>No {deviceFilter === 'all' ? 'devices' : deviceFilter} configured yet.</p>
                  <span>Add devices to any quadrant below to enable presence automation.</span>
                </div>
              ) : (
                filteredDevices.map(device => {
                  const qNum = getDeviceQuadrantNum(device);
                  const isLight = device.category === 'lights';
                  const isFan = device.category === 'fans';
                  const isOn = device.status === 'ON';
                  const isToggling = togglingId === device.id;

                  return (
                    <div key={device.id} className="device-card-item">
                      <div className="device-item-left">
                        <div className={`device-icon-circle ${device.category} ${isOn ? 'on' : 'off'}`}>
                          <Icon
                            name={
                              isLight
                                ? (isOn ? 'lightbulb' : 'light_off')
                                : isFan
                                ? (isOn ? 'mode_fan' : 'mode_fan_off')
                                : 'ac_unit'
                            }
                            size={18}
                            color={
                              isOn
                                ? (isLight ? '#9f6800' : isFan ? '#006934' : '#1e6585')
                                : '#68766B'
                            }
                          />
                        </div>

                        <div className="device-item-meta">
                          <span className="device-item-name">{device.name}</span>
                          <div className="device-badges-row">
                            <span className="device-quadrant-tag">
                              Q{qNum} ({QUADRANT_MAP[qNum]?.pos || 'Area'}) • Relay {device.relay || qNum} (GPIO {QUADRANT_MAP[qNum]?.pin || 15 + qNum})
                            </span>
                            <span className={`device-status-badge ${isOn ? 'on' : 'off'}`}>
                              {isOn ? '● Active (ON)' : '○ Standby (OFF)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="device-item-actions">
                        <button
                          type="button"
                          className={`btn-device-toggle ${isOn ? 'active' : ''}`}
                          onClick={() => handleToggleDevice(device)}
                          disabled={isToggling}
                          title={isOn ? 'Turn OFF' : 'Turn ON'}
                        >
                          <Icon name="power_settings_new" size={16} />
                          <span>{isOn ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-device-edit"
                          onClick={() => handleOpenEdit(device)}
                          title={`Edit ${device.name}`}
                        >
                          <Icon name="edit" size={15} color="#006934" />
                        </button>

                        <button
                          type="button"
                          className="btn-device-delete"
                          onClick={() => handleDeleteDevice(device.id)}
                          title={`Delete ${device.name}`}
                        >
                          <Icon name="delete" size={15} color="#B93832" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Device Form */}
            <form onSubmit={handleAddDevice} className="add-device-card-form">
              <div className="form-title-row">
                <Icon name="add_circle" size={16} color="#006934" />
                <span className="form-section-title">Add Quadrant Device</span>
              </div>

              {/* Quadrant Selector Grid */}
              <div className="form-field-group">
                <label className="field-label">TARGET CAMERA QUADRANT</label>
                <div className="quadrant-chip-grid">
                  {QUADRANT_CONFIG.map(q => {
                    const isSelected = newDeviceQuadrant === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={`quadrant-chip-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleQuadrantSelect(q.id)}
                      >
                        <span className="chip-q-title">{q.name}</span>
                        <span className="chip-q-sub">{q.pos} • Relay {q.relay}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Selector Chips */}
              <div className="form-field-group">
                <label className="field-label">DEVICE TYPE</label>
                <div className="category-choice-grid">
                  <button
                    type="button"
                    className={`category-choice-btn ${newDeviceCat === 'lights' ? 'selected' : ''}`}
                    onClick={() => handleCategorySelect('lights')}
                  >
                    <Icon name="lightbulb" size={16} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    className={`category-choice-btn ${newDeviceCat === 'fans' ? 'selected' : ''}`}
                    onClick={() => handleCategorySelect('fans')}
                  >
                    <Icon name="mode_fan" size={16} />
                    <span>Fan</span>
                  </button>
                  <button
                    type="button"
                    className={`category-choice-btn ${newDeviceCat === 'ac' ? 'selected' : ''}`}
                    onClick={() => handleCategorySelect('ac')}
                  >
                    <Icon name="ac_unit" size={16} />
                    <span>AC</span>
                  </button>
                </div>
              </div>

              {/* Device Name Input & Submit */}
              <div className="form-field-group">
                <label className="field-label">DEVICE NAME</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={e => setNewDeviceName(e.target.value)}
                  placeholder="e.g. Quadrant 1 Light"
                  className="device-text-input"
                />
              </div>

              <button type="submit" className="btn-add-device-submit" disabled={isAddingDevice}>
                <Icon name="add" size={17} color="#FFFFFF" />
                <span>{isAddingDevice ? 'Adding...' : 'Add Device to Quadrant'}</span>
              </button>
            </form>
          </div>
        </aside>
      </main>

      {/* Edit Device Modal */}
      {editingDevice && (
        <div className="modal-overlay" onClick={() => !isUpdatingDevice && setEditingDevice(null)}>
          <div className="edit-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-header-title">
                <Icon name="edit" size={18} color="#006934" />
                <span>Update Device</span>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setEditingDevice(null)}
                disabled={isUpdatingDevice}
              >
                <Icon name="close" size={16} color="#68766B" />
              </button>
            </div>

            <form onSubmit={handleUpdateDevice} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-field-group">
                <label className="field-label">TARGET CAMERA QUADRANT</label>
                <div className="quadrant-chip-grid">
                  {QUADRANT_CONFIG.map(q => {
                    const isSelected = editDeviceQuadrant === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={`quadrant-chip-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setEditDeviceQuadrant(q.id)}
                      >
                        <span className="chip-q-title">{q.name}</span>
                        <span className="chip-q-sub">{q.pos} • Relay {q.relay}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-field-group">
                <label className="field-label">DEVICE TYPE</label>
                <div className="category-choice-grid">
                  <button
                    type="button"
                    className={`category-choice-btn ${editDeviceCat === 'lights' ? 'selected' : ''}`}
                    onClick={() => setEditDeviceCat('lights')}
                  >
                    <Icon name="lightbulb" size={16} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    className={`category-choice-btn ${editDeviceCat === 'fans' ? 'selected' : ''}`}
                    onClick={() => setEditDeviceCat('fans')}
                  >
                    <Icon name="mode_fan" size={16} />
                    <span>Fan</span>
                  </button>
                  <button
                    type="button"
                    className={`category-choice-btn ${editDeviceCat === 'ac' ? 'selected' : ''}`}
                    onClick={() => setEditDeviceCat('ac')}
                  >
                    <Icon name="ac_unit" size={16} />
                    <span>AC</span>
                  </button>
                </div>
              </div>

              <div className="form-field-group">
                <label className="field-label">DEVICE NAME</label>
                <input
                  type="text"
                  value={editDeviceName}
                  onChange={e => setEditDeviceName(e.target.value)}
                  placeholder="Device Name"
                  className="device-text-input"
                  required
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setEditingDevice(null)}
                  disabled={isUpdatingDevice}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isUpdatingDevice}
                >
                  <Icon name="check" size={16} color="#FFFFFF" />
                  <span>{isUpdatingDevice ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
