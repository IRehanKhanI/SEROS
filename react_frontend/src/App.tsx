import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

type Point = [number, number];

export interface Zone {
  id: string;
  num: number;
  name: string;
  color: string;
  relay?: number;
  pin?: number;
  points: Point[];
  volumetric?: {
    top?: Point[];
    pillar?: Point[];
    pillars?: [Point, Point][];
  };
  assignedDeviceIds?: string[];
  occupantCount?: number;
}

export interface RoomLayout {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  isDefault?: boolean;
  zones: Zone[];
}

export interface Device {
  id: string;
  name: string;
  category: 'lights' | 'fans' | 'ac' | 'other';
  status: 'ON' | 'OFF' | 'Standby';
  relay?: number;
  quadrant?: string;
  quadrantNum?: number;
  quadrants?: number[];
  powerWatts?: number;
  isAutomated?: boolean;
  zoneId?: string;
}

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

export interface SensorData {
  temperature: number;
  humidity: number;
  energy_saving_percent: number;
  source: string;
  esp32_connected: boolean;
}

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export const RELAY_PINS: Record<number, number> = {
  1: 16,
  2: 17,
  3: 18,
  4: 19,
  5: 23,
  6: 25,
  7: 26,
  8: 27,
};

export const getRelayPin = (relayNum: number = 1): number => {
  return RELAY_PINS[relayNum] || (15 + relayNum);
};

export const MODERN_ZONE_COLORS = [
  '#00D2FF', // Zone 1: Cyber Cyan
  '#6366F1', // Zone 2: Indigo Neon
  '#10B981', // Zone 3: Emerald Mint
  '#F43F5E', // Zone 4: Coral Rose
  '#A855F7', // Zone 5: Vivid Purple
  '#F59E0B', // Zone 6: Amber Gold
  '#06B6D4', // Zone 7: Electric Teal
  '#EC4899', // Zone 8: Hot Pink
];

const DEFAULT_ROOM_LAYOUTS: RoomLayout[] = [
  {
    id: 'layout-1',
    name: 'Layout 1 (4 Zones)',
    subtitle: '4 Quadrants',
    description: 'Standard 4-Quadrant setup covering Classroom 101 with perspective corners',
    isDefault: true,
    zones: [
      {
        id: '1', num: 1, name: 'Zone 1 (Front-Left)', color: '#00D2FF', relay: 1, pin: 16,
        points: [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
        volumetric: {
          top: [[0.0, 0.0], [0.5, 0.0], [0.5, 0.25], [0.0, 0.25]],
          pillar: [[0.0, 0.5], [0.0, 0.25]],
          pillars: [[[0.0, 0.0], [0.0, 0.0]], [[0.5, 0.0], [0.5, 0.0]], [[0.5, 0.5], [0.5, 0.25]], [[0.0, 0.5], [0.0, 0.25]]]
        }
      },
      {
        id: '2', num: 2, name: 'Zone 2 (Front-Right)', color: '#6366F1', relay: 2, pin: 17,
        points: [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
        volumetric: {
          top: [[0.5, 0.0], [1.0, 0.0], [1.0, 0.25], [0.5, 0.25]],
          pillar: [[1.0, 0.5], [1.0, 0.25]],
          pillars: [[[0.5, 0.0], [0.5, 0.0]], [[1.0, 0.0], [1.0, 0.0]], [[1.0, 0.5], [1.0, 0.25]], [[0.5, 0.5], [0.5, 0.25]]]
        }
      },
      {
        id: '3', num: 3, name: 'Zone 3 (Back-Left)', color: '#10B981', relay: 3, pin: 18,
        points: [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
        volumetric: {
          top: [[0.0, 0.25], [0.5, 0.25], [0.5, 0.65], [0.0, 0.65]],
          pillar: [[0.0, 1.0], [0.0, 0.65]],
          pillars: [[[0.0, 0.5], [0.0, 0.25]], [[0.5, 0.5], [0.5, 0.25]], [[0.5, 1.0], [0.5, 0.65]], [[0.0, 1.0], [0.0, 0.65]]]
        }
      },
      {
        id: '4', num: 4, name: 'Zone 4 (Back-Right)', color: '#F43F5E', relay: 4, pin: 19,
        points: [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
        volumetric: {
          top: [[0.5, 0.25], [1.0, 0.25], [1.0, 0.65], [0.5, 0.65]],
          pillar: [[1.0, 1.0], [1.0, 0.65]],
          pillars: [[[0.5, 0.5], [0.5, 0.25]], [[1.0, 0.5], [1.0, 0.25]], [[1.0, 1.0], [1.0, 0.65]], [[0.5, 1.0], [0.5, 0.65]]]
        }
      },
    ],
  },
];


export default function App() {
  // Navigation State - Unified 5 Tabs (Dashboard & Analytics, Rooms, Layouts, Add Devices, Devices)
  const [activeTab, setActiveTabState] = useState<'home' | 'rooms' | 'layouts' | 'add_devices' | 'devices'>(() => {
    try {
      const saved = localStorage.getItem('seros_active_tab');
      if (saved && ['home', 'rooms', 'layouts', 'add_devices', 'devices'].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return 'rooms';
  });

  const setActiveTab = (tab: 'home' | 'rooms' | 'layouts' | 'add_devices' | 'devices') => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('seros_active_tab', tab);
    } catch {}
  };
  
  // Camera & Detection State
  const videoRef = useRef<HTMLVideoElement>(null);
  const layoutVideoRef = useRef<HTMLVideoElement>(null);
  const globalVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionInFlight = useRef(false);

  const [connected, setConnected] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [cameraError, setCameraError] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'lights' | 'fans' | 'ac'>('all');

  // Camera Choosing / Device Selection State
  const [availableCameras, setAvailableCameras] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Layout Tab Live Feed & Freeze Frame for Edition State
  const [isFrameFrozen, setIsFrameFrozen] = useState(false);
  const [frozenFrameUrl, setFrozenFrameUrl] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('1');
  const [draggedPointIndex, setDraggedPointIndex] = useState<{ zoneId: string; pointIdx: number; plane?: 'floor' | 'top' } | null>(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [saveLayoutNotice, setSaveLayoutNotice] = useState<string | null>(null);

  // Sensor Data from ESP32 HTU21DF
  const [sensor, setSensor] = useState<SensorData>({
    temperature: 26.4,
    humidity: 58,
    energy_saving_percent: 18,
    source: 'ESP32-HTU21DF',
    esp32_connected: true,
  });

  // Devices & Layouts State
  const [devices, setDevices] = useState<Device[]>([
    { id: '1', name: 'Zone 1 Front Light', category: 'lights', status: 'ON', quadrantNum: 1, quadrants: [1], relay: 1, powerWatts: 24 },
    { id: '2', name: 'Zone 2 Front Light', category: 'lights', status: 'ON', quadrantNum: 2, quadrants: [2], relay: 2, powerWatts: 24 },
    { id: '3', name: 'Zone 3 Rear Light', category: 'lights', status: 'ON', quadrantNum: 3, quadrants: [3], relay: 3, powerWatts: 24 },
    { id: '4', name: 'Zone 4 Rear Light', category: 'lights', status: 'OFF', quadrantNum: 4, quadrants: [4], relay: 4, powerWatts: 24 },
    { id: '5', name: 'Zone 1 Ceiling Fan', category: 'fans', status: 'ON', quadrantNum: 1, quadrants: [1], relay: 1, powerWatts: 65 },
    { id: '6', name: 'Zone 2 Ceiling Fan', category: 'fans', status: 'OFF', quadrantNum: 2, quadrants: [2], relay: 2, powerWatts: 65 },
    { id: '7', name: 'Master Room AC Unit', category: 'ac', status: 'ON', quadrantNum: 1, quadrants: [1, 2, 3, 4], relay: 1, powerWatts: 1450 },
  ]);

  const [layouts, setLayouts] = useState<RoomLayout[]>(() => {
    try {
      const saved = localStorage.getItem('seros_room_layouts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasOldDefaults = parsed.some((l: any) => ['layout-2', 'layout-3', 'layout-4'].includes(l.id));
          const hasOldInsets = parsed.some((l: any) =>
            l.zones?.some((z: any) => z.id === '1' && (z.points?.[0]?.[0] > 0.03 || z.points?.[0]?.[1] > 0.03))
          );
          if (!hasOldDefaults && !hasOldInsets) {
            return parsed;
          }
        }
      }
    } catch {}
    try {
      localStorage.removeItem('seros_room_layouts');
      localStorage.setItem('seros_active_layout_id', 'layout-1');
    } catch {}
    return DEFAULT_ROOM_LAYOUTS;
  });
  const [activeLayoutId, setActiveLayoutIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('seros_active_layout_id');
      if (saved) return saved;
    } catch {}
    return 'layout-1';
  });

  const setActiveLayoutId = (layoutId: string) => {
    setActiveLayoutIdState(layoutId);
    try {
      localStorage.setItem('seros_active_layout_id', layoutId);
    } catch {}
  };
  const [isEditMode, setIsEditMode] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<'3d' | 'top'>('3d');
  const [activeEditorTool, setActiveEditorTool] = useState<'draw' | 'resize' | 'delete'>('draw');

  // Unified Dashboard Sub-Tab: 'overview' | 'analytics' | 'settings' (or view all on single page)
  const [dashboardSubTab, setDashboardSubTab] = useState<'all' | 'overview' | 'analytics' | 'settings'>('all');

  // Dynamic Energy Analytics & Bill Prediction State
  const [tariffRate, setTariffRate] = useState<number>(() => {
    try {
      const v = localStorage.getItem('seros_tariff_rate');
      if (v) return parseFloat(v);
    } catch {}
    return 5.50;
  });
  const [fixedMonthlyCharges, setFixedMonthlyCharges] = useState<number>(() => {
    try {
      const v = localStorage.getItem('seros_fixed_charges');
      if (v) return parseFloat(v);
    } catch {}
    return 1350;
  });
  const [dutyRatePct, setDutyRatePct] = useState<number>(() => {
    try {
      const v = localStorage.getItem('seros_duty_pct');
      if (v) return parseFloat(v);
    } catch {}
    return 8;
  });
  const [projectedKwh, setProjectedKwh] = useState<number>(250);
  const [energyTimeframe, setEnergyTimeframe] = useState<'today' | '7days' | 'month'>('today');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(2); // Default to Wed (Peak ₹64)
  const [customTariffOpen, setCustomTariffOpen] = useState(false);

  // Layout Renaming State
  const [renamingLayoutId, setRenamingLayoutId] = useState<string | null>(null);
  const [renamingLayoutName, setRenamingLayoutName] = useState<string>('');

  // Occupancy Action settings
  const [emptyRoomDelay, setEmptyRoomDelay] = useState(2);
  const [manualOverride, setManualOverride] = useState(false);
  const [togglingZoneId, setTogglingZoneId] = useState<string | null>(null);

  // Add Device Form State (Step-by-step: Layout first, then zone)
  const [addDeviceLayoutId, setAddDeviceLayoutId] = useState('layout-1');
  const [addDeviceZoneNum, setAddDeviceZoneNum] = useState(1);
  const [addDeviceType, setAddDeviceType] = useState<'lights' | 'fans' | 'ac' | 'other'>('lights');
  const [addDeviceName, setAddDeviceName] = useState('Zone 1 Light');
  const [isSubmittingDevice, setIsSubmittingDevice] = useState(false);
  const [addSuccessNotice, setAddSuccessNotice] = useState<string | null>(null);

  // New Layout Modal State
  const [isNewLayoutModalOpen, setIsNewLayoutModalOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newLayoutZonesCount, setNewLayoutZonesCount] = useState(4);

  // AI Auto-Mapping Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiNumZones, setAiNumZones] = useState(4);
  const [aiNumLights, setAiNumLights] = useState(4);
  const [aiNumFans, setAiNumFans] = useState(2);
  const [aiNumAcs, setAiNumAcs] = useState(1);
  const [aiEquipmentPlacement, setAiEquipmentPlacement] = useState<'quadrant' | 'perimeter' | 'front_loaded' | 'uniform'>('quadrant');
  const [isAiMapping, setIsAiMapping] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Active Layout Object
  const currentLayout: RoomLayout = layouts.find(l => l.id === activeLayoutId) || layouts[0];

  // Tracking refs to prevent polling from overwriting manual layout edits
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const isFrameFrozenRef = useRef(isFrameFrozen);
  isFrameFrozenRef.current = isFrameFrozen;
  const isDraggingRef = useRef(false);
  const draggedPointRef = useRef<{ zoneId: string; pointIdx: number; plane?: 'floor' | 'top' } | null>(null);
  const layoutsRef = useRef<RoomLayout[]>(layouts);
  layoutsRef.current = layouts;
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch state, layouts & live sensor reading from backend
  const loadAllData = useCallback(async () => {
    try {
      // 1. Fetch layouts and active blueprint from backend
      const layoutRes = await fetch(`${API}/api/layouts/`);
      if (layoutRes.ok) {
        const layoutData = await layoutRes.json();
        if (layoutData.layouts && layoutData.layouts.length > 0) {
          if (!isDraggingRef.current && !draggedPointRef.current && !draggedPointIndex) {
            setLayouts(layoutData.layouts);
            layoutsRef.current = layoutData.layouts;
            try {
              localStorage.setItem('seros_room_layouts', JSON.stringify(layoutData.layouts));
            } catch {}
          }
          if (layoutData.active_layout_id) {
            setActiveLayoutId(layoutData.active_layout_id);
          }
        }
      }


      // 2. Fetch devices & backend state
      const stateRes = await fetch(`${API}/api/state/`);
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setConnected(true);
        if (stateData.devices && stateData.devices.length > 0) {
          setDevices(stateData.devices);
        }
        // Bidirectional camera synchronization (mobile app turns on/off laptop camera)
        if (stateData.camera_enabled !== undefined && stateData.camera_enabled !== null) {
          const camOn = Boolean(stateData.camera_enabled);
          if (!camOn && isCameraOn) {
            setBoxes([]);
            if (mediaStream) {
              mediaStream.getTracks().forEach(t => t.stop());
              setMediaStream(null);
            }
            if (videoRef.current) videoRef.current.srcObject = null;
            if (layoutVideoRef.current) layoutVideoRef.current.srcObject = null;
          }
          setIsCameraOn(camOn);
        }
      }

      // 3. Fetch live ESP32 HTU21DF sensor data
      const sensorRes = await fetch(`${API}/api/sensor/`);
      if (sensorRes.ok) {
        const sensorData = await sensorRes.json();
        if (sensorData.temperature !== undefined) {
          setSensor({
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            energy_saving_percent: sensorData.energy_saving_percent ?? 18,
            source: sensorData.source || 'ESP32-HTU21DF',
            esp32_connected: sensorData.esp32_connected ?? true,
          });
        }
      }
    } catch {
      // Offline fallback preserves local state
    }
  }, []);

  useEffect(() => {
    void loadAllData();
    const interval = setInterval(() => {
      void loadAllData();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  // 1. Enumerate connected camera devices
  const refreshCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const mapped = videoInputs.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${index + 1}${d.deviceId ? ` (${d.deviceId.slice(0, 6)}...)` : ''}`,
      }));
      setAvailableCameras(mapped);
      if (mapped.length > 0) {
        setSelectedCameraId(prev => prev || mapped[0].deviceId);
      }
    } catch (e) {
      console.warn('Could not enumerate cameras:', e);
    }
  }, []);

  useEffect(() => {
    void refreshCameras();
    const handleDeviceChange = () => {
      void refreshCameras();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [refreshCameras]);

  // 2. Setup camera stream using selected camera device
  useEffect(() => {
    if (!isCameraOn) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        setMediaStream(null);
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      if (layoutVideoRef.current) layoutVideoRef.current.srcObject = null;
      setBoxes([]);
      return;
    }

    let isCancelled = false;
    const constraints: MediaStreamConstraints = {
      video: selectedCameraId
        ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };

    navigator.mediaDevices?.getUserMedia(constraints)
      .then((s) => {
        if (isCancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        setMediaStream(prev => {
          if (prev && prev !== s) {
            prev.getTracks().forEach(t => t.stop());
          }
          return s;
        });
        setCameraError('');
        void refreshCameras();
      })
      .catch((err) => {
        setCameraError('Camera unavailable or permission denied. Please select another camera.');
        console.warn('Webcam access failed:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [isCameraOn, selectedCameraId, refreshCameras]);

  // 3. Attach mediaStream to video elements when active
  useEffect(() => {
    if (globalVideoRef.current && mediaStream) {
      globalVideoRef.current.srcObject = mediaStream;
      globalVideoRef.current.play().catch(() => {});
    }
  }, [mediaStream]);

  useEffect(() => {
    if (videoRef.current && mediaStream && activeTab === 'rooms') {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
    }
  }, [mediaStream, activeTab]);

  useEffect(() => {
    if (layoutVideoRef.current && mediaStream && activeTab === 'layouts' && !isFrameFrozen) {
      layoutVideoRef.current.srcObject = mediaStream;
      layoutVideoRef.current.play().catch(() => {});
    }
  }, [mediaStream, activeTab, isFrameFrozen]);

  // 4. YOLO detection loop: continuous real-time streaming from persistent video feed
  useEffect(() => {
    if (!isCameraOn) {
      setBoxes([]);
      return;
    }

    const timer = setInterval(() => {
      if (detectionInFlight.current || !isCameraOn) return;
      const vid = (globalVideoRef.current && globalVideoRef.current.readyState >= 2)
        ? globalVideoRef.current
        : (activeTab === 'layouts' ? layoutVideoRef.current : videoRef.current);
      const canvas = canvasRef.current;
      if (!vid || !canvas || vid.readyState < 2) return;

      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(vid, 0, 0, 640, 360);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

      detectionInFlight.current = true;
      fetch(`${API}/api/detect/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
        .then(r => r.json())
        .then(data => {
          if (data && data.boxes && isCameraOn) {
            setBoxes(data.boxes);
          } else if (data && data.status === 'camera_off') {
            setBoxes([]);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          detectionInFlight.current = false;
        });
    }, 1800);

    return () => clearInterval(timer);
  }, [isCameraOn, activeTab]);

  // 5. Freeze Frame for Edition handlers
  const handleFreezeFrame = () => {
    const vid = layoutVideoRef.current || videoRef.current;
    if (!vid) {
      setIsFrameFrozen(true);
      return;
    }
    try {
      const snapCanvas = document.createElement('canvas');
      const w = vid.videoWidth || 1280;
      const h = vid.videoHeight || 720;
      snapCanvas.width = w;
      snapCanvas.height = h;
      const ctx = snapCanvas.getContext('2d');
      if (ctx) {
        if (mirror) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(vid, 0, 0, w, h);
        const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.95);
        setFrozenFrameUrl(dataUrl);
        setIsFrameFrozen(true);
      }
    } catch (err) {
      console.warn('Frame capture failed:', err);
      setIsFrameFrozen(true);
    }
  };

  const handleResumeLiveStream = () => {
    setIsFrameFrozen(false);
  };

  // Auto-save layout to backend
  const saveLayoutToBackend = useCallback(async (layoutToSave: RoomLayout) => {
    try {
      try {
        const currentList = (layoutsRef.current || []).map(l => l.id === layoutToSave.id ? layoutToSave : l);
        layoutsRef.current = currentList;
        localStorage.setItem('seros_room_layouts', JSON.stringify(currentList));
        localStorage.setItem('seros_active_layout_id', layoutToSave.id);
      } catch {}

      const res = await fetch(`${API}/api/layouts/${layoutToSave.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: layoutToSave.name,
          subtitle: layoutToSave.subtitle,
          description: layoutToSave.description,
          zones: layoutToSave.zones,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.layouts) {
          setLayouts(data.layouts);
          layoutsRef.current = data.layouts;
          try {
            localStorage.setItem('seros_room_layouts', JSON.stringify(data.layouts));
          } catch {}
        }
        if (data.active_layout_id) {
          setActiveLayoutId(data.active_layout_id);
        }
      }
    } catch (err) {
      console.warn('Auto-save layout error:', err);
    }
  }, []);

  // 6. Interactive zone point drag in Layout Editor with magnetic snapping (Floor and Ceiling planes)
  const startDraggingPoint = (
    e: any,
    zoneId: string,
    pointIdx: number,
    plane: 'floor' | 'top' = 'floor'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedZoneId(zoneId);

    const pointerId = e.pointerId;
    const targetEl = e.currentTarget;
    if (pointerId !== undefined && targetEl?.setPointerCapture) {
      try {
        targetEl.setPointerCapture(pointerId);
      } catch {}
    }

    isDraggingRef.current = true;
    draggedPointRef.current = { zoneId, pointIdx, plane };
    setDraggedPointIndex({ zoneId, pointIdx, plane });

    const targetLayoutId = currentLayout.id;

    const onWindowPointerMove = (moveEvt: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      let nx = Math.max(0.0, Math.min(1.0, (moveEvt.clientX - rect.left) / rect.width));
      let ny = Math.max(0.0, Math.min(1.0, (moveEvt.clientY - rect.top) / rect.height));

      // Magnetic Edge Snapping: Snap to outer camera boundary [0.0, 1.0] within 2.5%
      if (nx < 0.025) nx = 0.0;
      else if (nx > 0.975) nx = 1.0;

      if (ny < 0.025) ny = 0.0;
      else if (ny > 0.975) ny = 1.0;

      // Magnetic Centerline Snapping: Snap to center [0.5] within 2%
      if (Math.abs(nx - 0.5) < 0.02) nx = 0.5;
      if (Math.abs(ny - 0.5) < 0.02) ny = 0.5;

      const targetL = layoutsRef.current.find(l => l.id === targetLayoutId) || currentLayout;

      // Magnetic Adjoining Vertex Snapping
      if (plane === 'floor') {
        for (const otherZone of targetL.zones) {
          for (let ptI = 0; ptI < otherZone.points.length; ptI++) {
            if (otherZone.id === zoneId && ptI === pointIdx) continue;
            const [ox, oy] = otherZone.points[ptI];
            if (Math.hypot(nx - ox, ny - oy) < 0.025) {
              nx = ox;
              ny = oy;
              break;
            }
          }
        }
      }

      const updatedPt: Point = [Number(nx.toFixed(3)), Number(ny.toFixed(3))];

      setLayouts(prev => {
        const nextL = prev.map(l => {
          if (l.id !== targetLayoutId) return l;
          return {
            ...l,
            zones: l.zones.map(zoneObj => {
              if (zoneObj.id !== zoneId) return zoneObj;

              if (plane === 'top') {
                // Dragging a 3D Ceiling Node directly
                let currentTop: Point[] = (zoneObj.volumetric?.top && zoneObj.volumetric.top.length === zoneObj.points.length)
                  ? [...zoneObj.volumetric.top]
                  : zoneObj.points.map(([fx, fy]) => {
                      const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, fy));
                      return [fx, Math.max(0, fy - wallH)] as Point;
                    });
                currentTop[pointIdx] = updatedPt;
                const newPillars: [Point, Point][] = zoneObj.points.map((fp, i) => [fp, currentTop[i]]);
                return {
                  ...zoneObj,
                  volumetric: {
                    ...zoneObj.volumetric,
                    top: currentTop,
                    pillars: newPillars,
                    pillar: newPillars[0] || []
                  }
                };
              } else {
                // Dragging a Floor Base Node:
                // Floor point moves to updatedPt, and corresponding ceiling point moves in lockstep
                const newPoints = [...zoneObj.points] as Point[];
                newPoints[pointIdx] = updatedPt;

                let newTop: Point[] = (zoneObj.volumetric?.top && zoneObj.volumetric.top.length === zoneObj.points.length)
                  ? [...zoneObj.volumetric.top]
                  : zoneObj.points.map(([fx, fy]) => {
                      const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, fy));
                      return [fx, Math.max(0, fy - wallH)] as Point;
                    });

                const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, updatedPt[1]));
                newTop[pointIdx] = [
                  Number(updatedPt[0].toFixed(3)),
                  Number(Math.max(0, updatedPt[1] - wallH).toFixed(3))
                ];

                const newPillars: [Point, Point][] = newPoints.map((fp, i) => [fp, newTop[i]]);

                return {
                  ...zoneObj,
                  points: newPoints,
                  volumetric: {
                    ...zoneObj.volumetric,
                    top: newTop,
                    pillars: newPillars,
                    pillar: newPillars[0] || []
                  }
                };
              }
            }),
          };
        });
        layoutsRef.current = nextL;
        return nextL;
      });
    };

    const onWindowPointerUp = () => {
      if (pointerId !== undefined && targetEl?.releasePointerCapture) {
        try {
          targetEl.releasePointerCapture(pointerId);
        } catch {}
      }
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
      isDraggingRef.current = false;
      draggedPointRef.current = null;
      setDraggedPointIndex(null);

      const targetL = layoutsRef.current.find(l => l.id === targetLayoutId) || currentLayout;
      if (targetL) {
        void saveLayoutToBackend(targetL);
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
  };

  // Align 3D walls & ceiling nodes of a zone directly above its floor nodes
  const handleAlignZonePillars = (zoneId: string) => {
    const targetL = layoutsRef.current.find(l => l.id === currentLayout.id) || currentLayout;
    const updatedZones = targetL.zones.map(z => {
      if (z.id !== zoneId) return z;
      const alignedTop: Point[] = z.points.map(([fx, fy]) => {
        const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, fy));
        return [fx, Number(Math.max(0, fy - wallH).toFixed(3))];
      });
      const alignedPillars: [Point, Point][] = z.points.map((fp, i) => [fp, alignedTop[i]]);
      return {
        ...z,
        volumetric: {
          ...z.volumetric,
          top: alignedTop,
          pillars: alignedPillars,
          pillar: alignedPillars[0] || []
        }
      };
    });
    const updatedLayout = { ...targetL, zones: updatedZones };
    setLayouts(prev => {
      const nextL = prev.map(l => l.id === targetL.id ? updatedLayout : l);
      layoutsRef.current = nextL;
      return nextL;
    });
    void saveLayoutToBackend(updatedLayout);
  };

  // Align all zones' 3D walls across the room
  const handleAlignAllZonesPillars = () => {
    const targetL = layoutsRef.current.find(l => l.id === currentLayout.id) || currentLayout;
    const updatedZones = targetL.zones.map(z => {
      const alignedTop: Point[] = z.points.map(([fx, fy]) => {
        const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, fy));
        return [fx, Number(Math.max(0, fy - wallH).toFixed(3))];
      });
      const alignedPillars: [Point, Point][] = z.points.map((fp, i) => [fp, alignedTop[i]]);
      return {
        ...z,
        volumetric: {
          ...z.volumetric,
          top: alignedTop,
          pillars: alignedPillars,
          pillar: alignedPillars[0] || []
        }
      };
    });
    const updatedLayout = { ...targetL, zones: updatedZones };
    setLayouts(prev => {
      const nextL = prev.map(l => l.id === targetL.id ? updatedLayout : l);
      layoutsRef.current = nextL;
      return nextL;
    });
    void saveLayoutToBackend(updatedLayout);
  };

  const handleSvgMouseMove = (e: any) => {
    const dragTarget = draggedPointRef.current;
    if (!dragTarget || !svgRef.current) return;
    isDraggingRef.current = true;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    let nx = Math.max(0.0, Math.min(1.0, (e.clientX - rect.left) / rect.width));
    let ny = Math.max(0.0, Math.min(1.0, (e.clientY - rect.top) / rect.height));
    if (nx < 0.025) nx = 0.0;
    else if (nx > 0.975) nx = 1.0;
    if (ny < 0.025) ny = 0.0;
    else if (ny > 0.975) ny = 1.0;
    if (Math.abs(nx - 0.5) < 0.02) nx = 0.5;
    if (Math.abs(ny - 0.5) < 0.02) ny = 0.5;
    const updatedPt: Point = [Number(nx.toFixed(3)), Number(ny.toFixed(3))];

    setLayouts(prev => {
      const nextL = prev.map(l => {
        if (l.id !== activeLayoutId) return l;
        return {
          ...l,
          zones: l.zones.map(z => {
            if (z.id !== dragTarget.zoneId) return z;
            if (dragTarget.plane === 'top') {
              let currentTop: Point[] = (z.volumetric?.top && z.volumetric.top.length === z.points.length)
                ? [...z.volumetric.top]
                : z.points.map(([fx, fy]) => {
                    const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, fy));
                    return [fx, Math.max(0, fy - wallH)] as Point;
                  });
              currentTop[dragTarget.pointIdx] = updatedPt;
              const newPillars: [Point, Point][] = z.points.map((fp, i) => [fp, currentTop[i]]);
              return {
                ...z,
                volumetric: {
                  ...z.volumetric,
                  top: currentTop,
                  pillars: newPillars,
                  pillar: newPillars[0] || []
                }
              };
            } else {
              const newPoints = [...z.points] as Point[];
              newPoints[dragTarget.pointIdx] = updatedPt;
              let newTop: Point[] = (z.volumetric?.top && z.volumetric.top.length === z.points.length)
                ? [...z.volumetric.top]
                : z.points.map(([fx, fy]) => {
                    const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, fy));
                    return [fx, Math.max(0, fy - wallH)] as Point;
                  });
              const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, updatedPt[1]));
              newTop[dragTarget.pointIdx] = [
                Number(updatedPt[0].toFixed(3)),
                Number(Math.max(0, updatedPt[1] - wallH).toFixed(3))
              ];
              const newPillars: [Point, Point][] = newPoints.map((fp, i) => [fp, newTop[i]]);
              return {
                ...z,
                points: newPoints,
                volumetric: {
                  ...z.volumetric,
                  top: newTop,
                  pillars: newPillars,
                  pillar: newPillars[0] || []
                }
              };
            }
          }),
        };
      });
      layoutsRef.current = nextL;
      return nextL;
    });
  };

  const handleSvgMouseUp = (e?: any) => {
    if (e && svgRef.current && (e as any).pointerId !== undefined) {
      try {
        if (svgRef.current.hasPointerCapture((e as any).pointerId)) {
          svgRef.current.releasePointerCapture((e as any).pointerId);
        }
      } catch {}
    }
    const dragTarget = draggedPointRef.current;
    draggedPointRef.current = null;
    setDraggedPointIndex(null);
    isDraggingRef.current = false;

    if (dragTarget) {
      const targetL = layoutsRef.current.find(l => l.id === activeLayoutId);
      if (targetL) {
        void saveLayoutToBackend(targetL);
      }
    }
  };


  // 7. Save Layout Coordinates manually & activate across system
  const handleSaveLayoutCoordinates = async () => {
    setIsSavingLayout(true);
    setSaveLayoutNotice(null);
    try {
      const targetL = layoutsRef.current.find(l => l.id === activeLayoutId) || currentLayout;
      try {
        localStorage.setItem('seros_active_layout_id', targetL.id);
        localStorage.setItem('seros_room_layouts', JSON.stringify(layoutsRef.current));
      } catch {}
      await saveLayoutToBackend(targetL);
      const res = await fetch(`${API}/api/layouts/select/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_id: targetL.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.active_layout_id) {
          setActiveLayoutId(data.active_layout_id);
        }
      }
      setSaveLayoutNotice('Layout & relay coordinates saved and activated across system!');
    } catch {
      setSaveLayoutNotice('Saved locally (backend offline).');
    } finally {
      setIsSavingLayout(false);
      setTimeout(() => setSaveLayoutNotice(null), 3500);
    }
  };


  // Add Zone to current Layout
  const handleAddZoneToLayout = () => {
    const targetL = layoutsRef.current.find(l => l.id === activeLayoutId) || currentLayout;
    const newNum = targetL.zones.length + 1;
    const colors = MODERN_ZONE_COLORS;
    const newColor = colors[(newNum - 1) % colors.length];
    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      num: newNum,
      name: `Zone ${newNum}`,
      color: newColor,
      relay: newNum,
      pin: getRelayPin(newNum),
      points: [
        [0.2, 0.3],
        [0.5, 0.3],
        [0.5, 0.6],
        [0.2, 0.6]
      ],
    };
    const updatedZones = [...targetL.zones, newZone];
    const updatedLayout = { ...targetL, zones: updatedZones };
    setLayouts(prev => {
      const nextL = prev.map(l => l.id === targetL.id ? updatedLayout : l);
      layoutsRef.current = nextL;
      return nextL;
    });
    setSelectedZoneId(newZone.id);
    void saveLayoutToBackend(updatedLayout);
  };

  // Remove Zone from current Layout
  const handleRemoveZoneFromLayout = (zoneId: string) => {
    const targetL = layoutsRef.current.find(l => l.id === currentLayout.id) || currentLayout;
    if (targetL.zones.length <= 1) return;
    const updatedZones = targetL.zones.filter(z => z.id !== zoneId);
    const updatedLayout = { ...targetL, zones: updatedZones };
    setLayouts(prev => {
      const nextL = prev.map(l => l.id === targetL.id ? updatedLayout : l);
      layoutsRef.current = nextL;
      return nextL;
    });
    if (selectedZoneId === zoneId && updatedZones[0]) {
      setSelectedZoneId(updatedZones[0].id);
    }
    void saveLayoutToBackend(updatedLayout);
  };

  // Add Node into zone polygon edge (Midpoint Split)
  const handleAddNodeToZone = (zoneId: string, insertIndex: number, newPoint: Point) => {
    const targetL = layoutsRef.current.find(l => l.id === currentLayout.id) || currentLayout;
    const updatedZones = targetL.zones.map(z => {
      if (z.id !== zoneId) return z;
      const roundedPoint: Point = [Number(newPoint[0].toFixed(3)), Number(newPoint[1].toFixed(3))];
      const newPoints = [...z.points];
      newPoints.splice(insertIndex, 0, roundedPoint);

      const wallH = 0.10 + 0.30 * Math.max(0, Math.min(1, roundedPoint[1]));
      const newTopPt: Point = [roundedPoint[0], Number(Math.max(0, roundedPoint[1] - wallH).toFixed(3))];
      let newTop: Point[] = (z.volumetric?.top && z.volumetric.top.length === z.points.length)
        ? [...z.volumetric.top]
        : z.points.map(([fx, fy]) => [fx, Math.max(0, fy - (0.10 + 0.30 * fy))]);
      newTop.splice(insertIndex, 0, newTopPt);
      const newPillars: [Point, Point][] = newPoints.map((fp, i) => [fp, newTop[i] || fp]);

      return {
        ...z,
        points: newPoints,
        volumetric: {
          ...z.volumetric,
          top: newTop,
          pillars: newPillars,
          pillar: newPillars[0] || []
        }
      };
    });
    const updatedLayout = { ...targetL, zones: updatedZones };
    setLayouts(prev => {
      const nextL = prev.map(l => l.id === targetL.id ? updatedLayout : l);
      layoutsRef.current = nextL;
      return nextL;
    });
    void saveLayoutToBackend(updatedLayout);
  };

  // Remove Node from zone polygon (Double-click node)
  const handleRemoveNodeFromZone = (zoneId: string, pointIndex: number) => {
    const targetL = layoutsRef.current.find(l => l.id === currentLayout.id) || currentLayout;
    const targetZone = targetL.zones.find(z => z.id === zoneId);
    if (!targetZone || targetZone.points.length <= 3) return; // Keep at least 3 points for polygon
    const updatedZones = targetL.zones.map(z => {
      if (z.id !== zoneId) return z;
      const newPoints = z.points.filter((_, idx) => idx !== pointIndex);
      let newTop: Point[] = (z.volumetric?.top && z.volumetric.top.length === z.points.length)
        ? z.volumetric.top.filter((_, idx) => idx !== pointIndex)
        : newPoints.map(([fx, fy]) => [fx, Math.max(0, fy - (0.10 + 0.30 * fy))]);
      const newPillars: [Point, Point][] = newPoints.map((fp, i) => [fp, newTop[i] || fp]);

      return {
        ...z,
        points: newPoints,
        volumetric: {
          ...z.volumetric,
          top: newTop,
          pillars: newPillars,
          pillar: newPillars[0] || []
        }
      };
    });
    const updatedLayout = { ...targetL, zones: updatedZones };
    setLayouts(prev => {
      const nextL = prev.map(l => l.id === targetL.id ? updatedLayout : l);
      layoutsRef.current = nextL;
      return nextL;
    });
    void saveLayoutToBackend(updatedLayout);
  };

  // Assign Relay to Zone
  const handleUpdateZoneRelay = (zoneId: string, relayNum: number) => {
    const targetL = layoutsRef.current.find(l => l.id === currentLayout.id) || currentLayout;
    const updatedZones = targetL.zones.map(z => {
      if (z.id !== zoneId) return z;
      return { ...z, relay: relayNum, pin: 15 + relayNum };
    });
    const updatedLayout = { ...targetL, zones: updatedZones };
    setLayouts(prev => {
      const nextL = prev.map(l => l.id === targetL.id ? updatedLayout : l);
      layoutsRef.current = nextL;
      return nextL;
    });
    void saveLayoutToBackend(updatedLayout);
  };


  // Save renamed layout
  const handleSaveRenameLayout = async (layoutId: string) => {
    if (!renamingLayoutName.trim()) {
      setRenamingLayoutId(null);
      return;
    }
    const nameToSave = renamingLayoutName.trim();
    setLayouts(prev => prev.map(l => l.id === layoutId ? { ...l, name: nameToSave } : l));
    setRenamingLayoutId(null);
    try {
      await fetch(`${API}/api/layouts/${layoutId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameToSave }),
      });
    } catch {
      // offline
    }
  };

  // 8. Laptop camera toggle synced with backend and mobile
  const handleToggleLaptopCamera = async () => {
    const nextState = !isCameraOn;
    setIsCameraOn(nextState);
    if (!nextState) {
      setBoxes([]);
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        setMediaStream(null);
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      if (layoutVideoRef.current) layoutVideoRef.current.srcObject = null;
    }
    try {
      await fetch(`${API}/api/camera/status/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      void loadAllData();
    } catch (err) {
      console.warn('Failed to sync camera toggle to backend:', err);
    }
  };

  // Rapid 1.2s camera sync heartbeat with backend
  useEffect(() => {
    const camSyncTimer = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/camera/status/`);
        if (res.ok) {
          const d = await res.json();
          if (typeof d.enabled === 'boolean') {
            setIsCameraOn(prev => {
              if (prev !== d.enabled) {
                if (!d.enabled) {
                  setBoxes([]);
                  if (mediaStream) {
                    mediaStream.getTracks().forEach(t => t.stop());
                    setMediaStream(null);
                  }
                  if (videoRef.current) videoRef.current.srcObject = null;
                  if (layoutVideoRef.current) layoutVideoRef.current.srcObject = null;
                }
                return d.enabled;
              }
              return prev;
            });
          }
        }
      } catch {
        // silent
      }
    }, 1200);
    return () => clearInterval(camSyncTimer);
  }, [mediaStream]);

  // Compute occupants in a zone via ray casting
  const getZoneOccupants = (zone: Zone): number => {
    if (!boxes || boxes.length === 0) return 0;
    return boxes.filter(b => {
      const cx = (b.x1 + b.x2) / 2;
      const cy = (b.y1 + b.y2) / 2;
      return isPointInPolygon([cx, cy], zone.points);
    }).length;
  };

  function isPointInPolygon(point: Point, vs: Point[]) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0], yi = vs[i][1];
      const xj = vs[j][0], yj = vs[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Handle switching active layout
  const handleSelectLayout = async (layoutId: string) => {
    setActiveLayoutId(layoutId);
    try {
      localStorage.setItem('seros_active_layout_id', layoutId);
    } catch {}
    try {
      const res = await fetch(`${API}/api/layouts/select/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_id: layoutId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.active_layout_id) {
          setActiveLayoutId(data.active_layout_id);
          try {
            localStorage.setItem('seros_active_layout_id', data.active_layout_id);
          } catch {}
        }
      }
      void loadAllData();
    } catch {
      // offline fallback
    }
  };

  // Toggle single device
  const handleToggleSingleDevice = async (device: Device) => {
    const nextStatus = device.status === 'ON' ? 'OFF' : 'ON';
    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: nextStatus } : d));
    try {
      await fetch(`${API}/api/devices/${device.id}/control/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: nextStatus === 'ON', manual_override: true }),
      });
      if (device.relay) {
        await fetch(`${API}/api/devices/control/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relay: device.relay, state: nextStatus === 'ON' ? 1 : 0 }),
        }).catch(() => undefined);
      }
    } catch {
      // offline
    }
  };

  // Toggle zone devices
  const handleToggleZone = async (zone: Zone) => {
    setTogglingZoneId(zone.id);
    const zoneDevices = devices.filter(d => 
      (d.quadrantNum === zone.num) ||
      (d.quadrants && d.quadrants.includes(zone.num)) ||
      (d.relay === zone.relay)
    );
    const anyOn = zoneDevices.some(d => d.status === 'ON');
    const targetState = !anyOn;

    setDevices(prev => prev.map(d => {
      const matches = (d.quadrantNum === zone.num) || (d.quadrants && d.quadrants.includes(zone.num)) || (d.relay === zone.relay);
      return matches ? { ...d, status: targetState ? 'ON' : 'OFF' } : d;
    }));

    try {
      await Promise.all(
        zoneDevices.map(d =>
          fetch(`${API}/api/devices/${d.id}/control/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ on: targetState, manual_override: true }),
          })
        )
      );
      if (zone.relay) {
        await fetch(`${API}/api/devices/control/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relay: zone.relay, state: targetState ? 1 : 0 }),
        }).catch(() => undefined);
      }
      await loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingZoneId(null);
    }
  };

  // Add Device Handler
  const handleAddDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDeviceName.trim()) return;
    setIsSubmittingDevice(true);
    setAddSuccessNotice(null);

    const newDev: Device = {
      id: `dev-${Date.now()}`,
      name: addDeviceName.trim(),
      category: addDeviceType,
      status: 'ON',
      quadrantNum: addDeviceZoneNum,
      quadrants: [addDeviceZoneNum],
      relay: addDeviceZoneNum,
      powerWatts: addDeviceType === 'ac' ? 1400 : addDeviceType === 'fans' ? 65 : 24,
    };

    setDevices(prev => [...prev, newDev]);

    try {
      const res = await fetch(`${API}/api/devices/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addDeviceName.trim(),
          category: addDeviceType,
          quadrant: addDeviceZoneNum,
          quadrants: [addDeviceZoneNum],
          relay: addDeviceZoneNum,
          layout_id: addDeviceLayoutId,
        }),
      });
      if (res.ok) {
        setAddSuccessNotice(`Successfully added "${addDeviceName.trim()}" to Zone ${addDeviceZoneNum}`);
        setAddDeviceName(`Zone ${addDeviceZoneNum} ${addDeviceType === 'lights' ? 'Light' : addDeviceType === 'fans' ? 'Fan' : 'AC'}`);
        await loadAllData();
      }
    } catch (err) {
      console.error(err);
      setAddSuccessNotice(`Added "${addDeviceName.trim()}" locally (offline mode)`);
    } finally {
      setIsSubmittingDevice(false);
      setTimeout(() => setAddSuccessNotice(null), 4000);
    }
  };

  // Create New Layout
  const handleCreateNewLayout = async () => {
    if (!newLayoutName.trim()) return;
    try {
      const res = await fetch(`${API}/api/layouts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLayoutName.trim(),
          subtitle: `${newLayoutZonesCount} Custom Zones`,
          description: 'User created 3D layout',
        }),
      });
      if (res.ok) {
        const payload = await res.json();
        setIsNewLayoutModalOpen(false);
        setNewLayoutName('');
        if (payload.layout?.id) {
          setActiveLayoutId(payload.layout.id);
        }
        await loadAllData();
      } else {
        const fallbackId = `layout-${Date.now()}`;
        const newL: RoomLayout = {
          id: fallbackId,
          name: newLayoutName.trim(),
          subtitle: `${newLayoutZonesCount} Custom Zones`,
          zones: Array.from({ length: newLayoutZonesCount }).map((_, i) => ({
            id: `z-${i+1}`,
            num: i + 1,
            name: `Zone ${i+1}`,
            color: ['#FFB547', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'][i % 6],
            points: [[0.1, 0.1], [0.9, 0.1], [0.8, 0.8], [0.2, 0.8]],
          })),
        };
        setLayouts(prev => [...prev, newL]);
        setActiveLayoutId(fallbackId);
        setIsNewLayoutModalOpen(false);
      }
    } catch {
      setIsNewLayoutModalOpen(false);
    }
  };

  // Delete Layout (can delete any layout as long as at least 1 remains)
  const handleDeleteLayout = async (layoutId: string) => {
    if (layouts.length <= 1) return;
    try {
      await fetch(`${API}/api/layouts/${layoutId}/`, { method: 'DELETE' });
    } catch {
      // offline
    }
    const remaining = layouts.filter(l => l.id !== layoutId);
    setLayouts(remaining);
    if (activeLayoutId === layoutId && remaining[0]) {
      setActiveLayoutId(remaining[0].id);
      void handleSelectLayout(remaining[0].id);
    }
  };

  // Run AI Auto-Mapping
  const handleRunAiAutoMap = async () => {
    setIsAiMapping(true);
    setAiNotice(null);

    let frameData: string | undefined;
    try {
      const activeVideo = layoutVideoRef.current || videoRef.current;
      if (activeVideo && activeVideo.videoWidth > 0 && activeVideo.videoHeight > 0) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = activeVideo.videoWidth;
        offCanvas.height = activeVideo.videoHeight;
        const ctx = offCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(activeVideo, 0, 0, offCanvas.width, offCanvas.height);
          frameData = offCanvas.toDataURL('image/jpeg', 0.85);
        }
      } else if (canvasRef.current) {
        frameData = canvasRef.current.toDataURL('image/jpeg', 0.85);
      }
    } catch (e) {
      console.warn('Could not capture frame for AI auto-map:', e);
    }

    try {
      const res = await fetch(`${API}/api/ai-automap/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quadrants: aiNumZones,
          num_zones: aiNumZones,
          lights: aiNumLights,
          num_lights: aiNumLights,
          fans: aiNumFans,
          num_fans: aiNumFans,
          acs: aiNumAcs,
          num_acs: aiNumAcs,
          equipment_placement: aiEquipmentPlacement,
          room_name: 'Classroom 101',
          frame: frameData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const lId = data.layout_id || data.layout?.id;
        const lName = data.layout_name || data.layout?.name || 'Synthesized Layout';
        const zCount = data.zones?.length || data.layout?.zones?.length || aiNumZones;
        setAiNotice(`AI Generated: ${lName} (${zCount} 3D zones synthesized)`);
        await loadAllData();
        if (lId) {
          setActiveLayoutId(lId);
        }
        setTimeout(() => {
          setIsAiModalOpen(false);
          setAiNotice(null);
        }, 1200);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAiNotice(`Auto-map notice: ${errData.error || 'Synthesized standard 3D perspective layout'}`);
      }
    } catch (err: any) {
      setAiNotice(`Auto-map applied perspective layout: ${err.message || 'Complete'}`);
    } finally {
      setIsAiMapping(false);
    }
  };

  const lightsCount = devices.filter(d => d.category === 'lights').length;
  const fansCount = devices.filter(d => d.category === 'fans').length;
  const acCount = devices.filter(d => d.category === 'ac').length;
  const filteredDevices = devices.filter(d => deviceFilter === 'all' || d.category === deviceFilter);

  // Selected layout object for Add Devices view
  const selectedAddDeviceLayout = layouts.find(l => l.id === addDeviceLayoutId) || currentLayout;

  // Real Dynamic Energy Calculations
  const activeWattage = devices.filter(d => d.status === 'ON').reduce((sum, d) => sum + (d.powerWatts || 40), 0);
  const totalInstalledWattage = devices.reduce((sum, d) => sum + (d.powerWatts || 40), 0);
  // Today's estimated operating hours (6.5 hrs classroom active schedule)
  const todayActiveKwh = Number(((activeWattage * 6.5) / 1000).toFixed(2));
  const unzonedBaselineKwh = Number(((totalInstalledWattage * 8.0) / 1000).toFixed(2));
  const todayCost = Math.max(12, Math.round(todayActiveKwh * tariffRate));
  const todaySavedCost = Math.max(8, Math.round((unzonedBaselineKwh - todayActiveKwh) * tariffRate));

  // Dynamic Bill Projections based on user selected kWh
  const projectedEnergyCost = Math.round(projectedKwh * tariffRate);
  const projectedDutyCost = Math.round(projectedEnergyCost * (dutyRatePct / 100));
  const projectedTotalBill = projectedEnergyCost + fixedMonthlyCharges + projectedDutyCost;

  // Statement Downloader
  const handleDownloadBillStatement = () => {
    const content = `================================================
S.E.R.O.S. SMART ENERGY & ROOM OPERATING SYSTEM
Classroom 101 • Plain-Language Monthly Bill Statement
Generated: ${new Date().toLocaleDateString()}
================================================

PROJECTED SUMMARY
Estimated Total Monthly Bill: ₹${projectedTotalBill.toLocaleString('en-IN')}
Projected Monthly Units: ${projectedKwh} kWh
Electricity Tariff Rate: ₹${tariffRate.toFixed(2)} / kWh
Next Official Bill Cycle: 12 days

ITEMIZED COST BREAKDOWN
1. Active Energy Consumption: ₹${projectedEnergyCost.toLocaleString('en-IN')}
   (${projectedKwh} kWh @ ₹${tariffRate.toFixed(2)}/unit)
2. Standard Fixed Grid Charges: ₹${fixedMonthlyCharges.toLocaleString('en-IN')}
3. Government Electricity Duty (${dutyRatePct}%): ₹${projectedDutyCost.toLocaleString('en-IN')}
------------------------------------------------
TOTAL PROJECTED PAYABLE: ₹${projectedTotalBill.toLocaleString('en-IN')}

ENERGY CONSERVATION & AUTOMATION METRICS
- AI Spatial Quadrant Automation: ACTIVE
- Power Conserved vs Baseline: ${sensor.energy_saving_percent}%
- Estimated Monthly Savings via S.E.R.O.S.: ~₹${Math.round(projectedTotalBill * 0.22).toLocaleString('en-IN')}
- Live Room Telemetry: ${sensor.temperature.toFixed(1)}°C | ${sensor.humidity.toFixed(0)}% RH

SMART SAVING TIP:
Turning off ACs 15 mins before leaving saves approximately ~₹320/month without warming up rooms!
================================================`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SEROS_Bill_Statement_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="seros-desktop-root">
      {/* Persistent Offscreen Video for YOLO Computer Vision Streaming */}
      <video ref={globalVideoRef} muted playsInline style={{ display: 'none' }} aria-hidden="true" />
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />

      {/* 1. TOP NAVIGATION BAR */}
      {/* Strictly Brand logo, Home, Rooms, Layouts, Add Devices, Analytics, Devices, Settings */}
      <header className="seros-navbar">
        <div className="navbar-container">
          {/* Brand Logo & Title */}
          <div className="navbar-brand">
            <div className="brand-leaf-icon">
              <Icon name="eco" size={24} color="#FFFFFF" />
            </div>
            <div className="brand-text">
              <span className="brand-title">S.E.R.O.S.</span>
              <span className="brand-subtitle">Smart Energy & Resource Optimization System</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="navbar-links" aria-label="Main Navigation">
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <Icon name="dashboard" size={17} />
              <span>Dashboard & Analytics</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              <Icon name="meeting_room" size={17} />
              <span>Rooms</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'layouts' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('layouts');
                setIsEditMode(true);
              }}
            >
              <Icon name="layers" size={17} />
              <span>Layouts</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'add_devices' ? 'active' : ''}`}
              onClick={() => setActiveTab('add_devices')}
            >
              <Icon name="add_circle" size={17} />
              <span>Add Devices</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
              onClick={() => setActiveTab('devices')}
            >
              <Icon name="apps" size={17} />
              <span>Devices</span>
            </button>
          </nav>
        </div>
      </header>

      {/* 2. BODY CONTENT ROUTER (Cleanly separated tabs) */}
      <div className="seros-tab-viewport">
        {/* TAB A: ROOMS (Primary 3D Interactive Room View) */}
        {activeTab === 'rooms' && (
          <div className="tab-pane active-pane">
            {/* Room Subheader Bar */}
            <section className="room-subheader-bar">
              <div className="subheader-content">
                <div className="subheader-left">
                  <button type="button" className="btn-back-room" onClick={() => setActiveTab('home')}>
                    <Icon name="arrow_back" size={18} color="#1F2937" />
                  </button>
                  <h1 className="room-heading">Classroom 101</h1>
                  <span className="live-status-pill">
                    <span className="pulse-indicator-dot" />
                    <span>Live</span>
                  </span>
                </div>

                {/* Real-time Environmental Metric Badges */}
                <div className="room-metrics-group">
                  <div className="metric-pill">
                    <Icon name="groups" size={16} color="#006934" />
                    <div className="metric-texts">
                      <span className="metric-label">Occupancy</span>
                      <span className="metric-val">{boxes.length} people</span>
                    </div>
                  </div>

                  <div className="metric-pill">
                    <Icon name="thermostat" size={16} color="#1E6585" />
                    <div className="metric-texts">
                      <span className="metric-label">Temperature</span>
                      <span className="metric-val">{sensor.temperature.toFixed(1)}°C</span>
                    </div>
                  </div>

                  <div className="metric-pill">
                    <Icon name="sensors" size={16} color="#7E5200" />
                    <div className="metric-texts">
                      <span className="metric-label">Humidity</span>
                      <span className="metric-val">{sensor.humidity.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="metric-pill">
                    <Icon name="bolt" size={16} color="#006934" />
                    <div className="metric-texts">
                      <span className="metric-label">Energy Saving</span>
                      <span className="metric-val">{sensor.energy_saving_percent}%</span>
                    </div>
                  </div>
                </div>

                {/* Layout Selector & Edit Mode Toggle */}
                <div className="subheader-right">
                  <div className="layout-select-dropdown">
                    <select
                      value={activeLayoutId}
                      onChange={e => handleSelectLayout(e.target.value)}
                      className="layout-native-select"
                      aria-label="Active Layout"
                    >
                      {layouts.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <Icon name="expand_more" size={18} color="#4B5563" className="dropdown-arrow-icon" />
                  </div>

                  <button
                    type="button"
                    className={`btn-edit-mode ${isEditMode ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('layouts');
                      setIsEditMode(true);
                    }}
                  >
                    <Icon name="view_in_ar" size={16} color="#FFFFFF" />
                    <span>3D Editor</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Central Main Grid: 3D Perspective Stream (Left) & Zones Control (Right) */}
            <main className="seros-main-grid">
              {/* Left Column: Live 3D Perspective Volumetric Viewport */}
              <div className="camera-perspective-card">
                <div className="viewport-stream-box">
                  {isCameraOn ? (
                    <div className="relative-canvas-container">
                      <video ref={videoRef} muted playsInline className={`live-feed-video ${mirror ? 'mirrored' : ''}`} />
                      <canvas ref={canvasRef} hidden />

                      {/* 3D Volumetric Wireframe Perspective Overlay (Matching sketch) */}
                      <svg
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                        className="perspective-3d-svg"
                        aria-label="3D Perspective Room Zones"
                      >
                        {/* Render 3D Perspective Volumetric Zones with 3D Walls (Matching User Design) */}
                        {currentLayout.zones.map((zone) => {
                          const count = getZoneOccupants(zone);
                          const isOccupied = count > 0;
                          const floorPts = zone.points;

                          // Compute 3D top ceiling points
                          let topPts: Point[] = [];
                          if (zone.volumetric?.top && zone.volumetric.top.length === floorPts.length) {
                            topPts = zone.volumetric.top;
                          } else {
                            topPts = floorPts.map(([fx, fy]) => {
                              const wallH = 0.10 + 0.32 * Math.max(0, Math.min(1, fy));
                              return [Number(fx.toFixed(3)), Math.max(0.02, Number((fy - wallH).toFixed(3)))];
                            });
                          }

                          // 4 Vertical Pillars
                          const pillars: [Point, Point][] = floorPts.map((fp, i) => [fp, topPts[i]]);

                          // 4 Vertical Wall Facets
                          const wallFacets: Point[][] = [];
                          for (let i = 0; i < floorPts.length; i++) {
                            const next = (i + 1) % floorPts.length;
                            wallFacets.push([floorPts[i], floorPts[next], topPts[next], topPts[i]]);
                          }

                          // 3D Centroid for floating badge
                          const allX = [...floorPts.map(p => p[0]), ...topPts.map(p => p[0])];
                          const allY = [...floorPts.map(p => p[1]), ...topPts.map(p => p[1])];
                          const cx = allX.reduce((a, b) => a + b, 0) / allX.length;
                          const cy = allY.reduce((a, b) => a + b, 0) / allY.length;

                          return (
                            <g key={zone.id} className="zone-3d-group">
                              {/* 3D Vertical Wall Facets with Translucent Fill */}
                              {wallFacets.map((facet, fIdx) => (
                                <polygon
                                  key={`wall-${fIdx}`}
                                  points={facet.map(p => p.join(',')).join(' ')}
                                  fill={zone.color}
                                  fillOpacity={isOccupied ? 0.32 : 0.20}
                                  stroke={zone.color}
                                  strokeWidth="0.0035"
                                  strokeLinejoin="round"
                                />
                              ))}

                              {/* Top Volumetric Ceiling Roof Wireframe */}
                              <polygon
                                points={topPts.map(p => p.join(',')).join(' ')}
                                fill={zone.color}
                                fillOpacity={isOccupied ? 0.26 : 0.14}
                                stroke={zone.color}
                                strokeWidth="0.0045"
                                strokeLinejoin="round"
                              />

                              {/* 4 Vertical Perspective Pillars */}
                              {pillars.map((pil, pIdx) => (
                                <line
                                  key={`pil-${pIdx}`}
                                  x1={pil[0][0]}
                                  y1={pil[0][1]}
                                  x2={pil[1][0]}
                                  y2={pil[1][1]}
                                  stroke={zone.color}
                                  strokeWidth="0.005"
                                  strokeLinecap="round"
                                />
                              ))}

                              {/* Zone Floor Base Polygon */}
                              <polygon
                                points={floorPts.map(p => p.join(',')).join(' ')}
                                fill={zone.color}
                                fillOpacity={isOccupied ? 0.40 : 0.26}
                                stroke={zone.color}
                                strokeWidth="0.0045"
                                strokeLinejoin="round"
                              />

                              {/* Floating 3D Zone Name Badge (Matching Image 1) */}
                              <g className="floating-zone-badge" style={{ pointerEvents: 'none' }}>
                                <rect
                                  x={cx - 0.054}
                                  y={cy - 0.02}
                                  width={0.108}
                                  height={0.04}
                                  rx={0.012}
                                  fill={zone.color}
                                  filter="drop-shadow(0px 2px 5px rgba(0,0,0,0.7))"
                                />
                                <text
                                  x={cx}
                                  y={cy + 0.002}
                                  fill="#FFFFFF"
                                  fontSize="0.022"
                                  fontWeight="800"
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  style={{ letterSpacing: '0.001em' }}
                                >
                                  {zone.name}
                                </text>
                              </g>
                            </g>
                          );
                        })}

                        {/* Detected Occupant Centroid & High-Visibility Bounding Boxes */}
                        {boxes.map((b, idx) => {
                          const cx = (b.x1 + b.x2) / 2;
                          const cy = (b.y1 + b.y2) / 2;
                          const w = b.x2 - b.x1;
                          const h = b.y2 - b.y1;
                          const tagX = Math.max(0.01, Math.min(0.83, cx - 0.08));
                          const tagY = Math.max(0.01, b.y1 - 0.038);

                          return (
                            <g key={idx} className="occupant-marker-group">
                              {/* 1. Visible Translucent Body Highlight Rectangle */}
                              <rect
                                x={b.x1}
                                y={b.y1}
                                width={w}
                                height={h}
                                fill="rgba(239, 68, 68, 0.22)"
                                stroke="#EF4444"
                                strokeWidth="0.007"
                                rx="0.006"
                                style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))' }}
                              />

                              {/* 2. Distinct Corner Brackets for Computer Vision HUD */}
                              <path
                                d={`
                                  M ${b.x1} ${b.y1 + Math.min(0.05, h * 0.25)} L ${b.x1} ${b.y1} L ${b.x1 + Math.min(0.05, w * 0.25)} ${b.y1}
                                  M ${b.x2 - Math.min(0.05, w * 0.25)} ${b.y1} L ${b.x2} ${b.y1} L ${b.x2} ${b.y1 + Math.min(0.05, h * 0.25)}
                                  M ${b.x1} ${b.y2 - Math.min(0.05, h * 0.25)} L ${b.x1} ${b.y2} L ${b.x1 + Math.min(0.05, w * 0.25)} ${b.y2}
                                  M ${b.x2 - Math.min(0.05, w * 0.25)} ${b.y2} L ${b.x2} ${b.y2} L ${b.x2} ${b.y2 - Math.min(0.05, h * 0.25)}
                                `}
                                fill="none"
                                stroke="#FF1744"
                                strokeWidth="0.012"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* 3. Centroid Marker Dot */}
                              <circle cx={cx} cy={cy} r="0.014" fill="#FF1744" />
                              <circle cx={cx} cy={cy} r="0.006" fill="#FFFFFF" />

                              {/* 4. Head Dot Marker */}
                              <circle cx={cx} cy={b.y1} r="0.012" fill="#EF4444" />
                              <circle cx={cx} cy={b.y1} r="0.005" fill="#FFFFFF" />

                              {/* 5. Solid Floating Person Pill Tag */}
                              <rect
                                x={tagX}
                                y={tagY}
                                width="0.16"
                                height="0.034"
                                rx="0.006"
                                fill="#EF4444"
                                stroke="#FFFFFF"
                                strokeWidth="0.002"
                              />
                              <text
                                x={tagX + 0.08}
                                y={tagY + 0.023}
                                fill="#FFFFFF"
                                fontSize="0.018"
                                fontWeight="800"
                                textAnchor="middle"
                                className="occupant-tag-text"
                              >
                                Person {Math.round(b.confidence * 100)}%
                              </text>
                            </g>
                          );
                        })}
                      </svg>

                      {/* Viewport Top HUD Overlays */}
                      <div className="viewport-hud-top-left">
                        <span className="hud-badge active-layout-badge">
                          <Icon name="layers" size={13} color="#FFFFFF" />
                          <span>{currentLayout.name}</span>
                        </span>
                        <span className="hud-badge occupants-badge">
                          <Icon name="person" size={13} color="#FFFFFF" />
                          <span>{boxes.length} Occupants</span>
                        </span>
                      </div>

                      <div className="viewport-hud-bottom-right">
                        <span className="hud-chip">ESP32 • Live Relay</span>
                      </div>
                    </div>
                  ) : (
                    <div className="camera-standby-placeholder">
                      <Icon name="videocam_off" size={48} color="#9CA3AF" />
                      <p>Camera is currently off. Click below to resume stream.</p>
                      <button type="button" className="btn-resume-camera" onClick={handleToggleLaptopCamera}>
                        <Icon name="videocam" size={18} color="#FFFFFF" />
                        <span>Start Camera</span>
                      </button>
                    </div>
                  )}

                  {cameraError && (
                    <div className="camera-banner-notice">
                      <Icon name="sensors" size={14} color="#D97706" />
                      <span>{cameraError}</span>
                    </div>
                  )}
                </div>

                {/* Viewport Action Controls */}
                <div className="viewport-bottom-toolbar">
                  <div className="toolbar-left-group">
                    <button
                      type="button"
                      className={`btn-toolbar-toggle ${isCameraOn ? 'active' : ''}`}
                      onClick={handleToggleLaptopCamera}
                    >
                      <Icon name={isCameraOn ? 'videocam' : 'videocam_off'} size={16} />
                      <span>{isCameraOn ? 'Cam Active' : 'Cam Muted'}</span>
                    </button>

                    <button
                      type="button"
                      className={`btn-toolbar-toggle ${mirror ? 'active' : ''}`}
                      onClick={() => setMirror(m => !m)}
                    >
                      <Icon name="flip" size={16} />
                      <span>Mirror</span>
                    </button>

                    {/* Camera Device Chooser Option */}
                    <div className="camera-select-pill" title="Choose Video Camera Device">
                      <Icon name="videocam" size={15} color="#006934" />
                      <select
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        className="camera-dropdown-select"
                        aria-label="Select Video Camera"
                      >
                        {availableCameras.length > 0 ? (
                          availableCameras.map((cam, idx) => (
                            <option key={cam.deviceId || idx} value={cam.deviceId}>
                              {cam.label || `Camera ${idx + 1}`}
                            </option>
                          ))
                        ) : (
                          <option value="">Default System Camera</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="toolbar-right-group">
                    <span className="connected-status-indicator">
                      <span className={`status-dot ${connected ? 'green' : 'red'}`} />
                      <span>{connected ? 'Vision Connected' : 'Connecting...'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Zones & Devices Controller */}
              <aside className="seros-zones-sidebar">
                {/* Zones Accordion List */}
                <div className="zones-control-panel-card">
                  <div className="panel-header-row">
                    <h2 className="panel-title">Zones & Devices</h2>
                    <span className="zones-count-pill">{currentLayout.zones.length} Zones</span>
                  </div>

                  <div className="zones-accordion-list">
                    {currentLayout.zones.map((zone) => {
                      const occupants = getZoneOccupants(zone);
                      const isOccupied = occupants > 0;
                      const isToggling = togglingZoneId === zone.id;
                      
                      const zoneDevices = devices.filter(d => 
                        (d.quadrantNum === zone.num) ||
                        (d.quadrants && d.quadrants.includes(zone.num)) ||
                        (d.relay === zone.relay)
                      );
                      const anyDeviceOn = zoneDevices.some(d => d.status === 'ON');

                      return (
                        <div
                          key={zone.id}
                          className={`zone-accordion-card ${isOccupied ? 'occupied' : ''}`}
                          style={{ borderLeftColor: zone.color }}
                        >
                          <div className="zone-card-top-row">
                            <div className="zone-name-meta">
                              <span className="zone-dot-swatch" style={{ backgroundColor: zone.color }} />
                              <div className="zone-text-group">
                                <span className="zone-title-label">{zone.name}</span>
                                <span className="zone-occupancy-sub">
                                  {occupants > 0 ? `${occupants} person detected` : 'No occupancy'}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`btn-zone-master-toggle ${anyDeviceOn ? 'on' : 'off'}`}
                              onClick={() => handleToggleZone(zone)}
                              disabled={isToggling}
                              title="Toggle all devices in this zone"
                            >
                              <span className="master-toggle-slider" />
                            </button>
                          </div>

                          {/* Individual Device Rows in Zone */}
                          <div className="zone-devices-sublist">
                            {zoneDevices.map((dev) => (
                              <div key={dev.id} className="device-subrow-item">
                                <div className="device-meta-left">
                                  <Icon
                                    name={dev.category === 'lights' ? 'lightbulb' : dev.category === 'fans' ? 'mode_fan' : 'ac_unit'}
                                    size={16}
                                    color={dev.status === 'ON' ? '#006934' : '#9CA3AF'}
                                  />
                                  <span className="device-label-text">{dev.name}</span>
                                </div>
                                <button
                                  type="button"
                                  className={`device-mini-switch ${dev.status === 'ON' ? 'active' : ''}`}
                                  onClick={() => handleToggleSingleDevice(dev)}
                                >
                                  {dev.status}
                                </button>
                              </div>
                            ))}
                            {zoneDevices.length === 0 && (
                              <div className="no-devices-hint">
                                <span>No devices assigned. Click 'Add Devices' to assign.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card: Assigned Devices Breakdown */}
                <div className="control-section-card assigned-devices-card">
                  <h2 className="section-card-title">Assigned Devices</h2>
                  <div className="assigned-device-tiles-grid">
                    <div className="assigned-tile">
                      <div className="tile-icon-circle green">
                        <Icon name="lightbulb" size={18} color="#006934" />
                      </div>
                      <span className="tile-label">Lights ({lightsCount})</span>
                      <span className="tile-arrow">›</span>
                    </div>

                    <div className="assigned-tile">
                      <div className="tile-icon-circle blue">
                        <Icon name="mode_fan" size={18} color="#1E6585" />
                      </div>
                      <span className="tile-label">Fans ({fansCount})</span>
                      <span className="tile-arrow">›</span>
                    </div>

                    {acCount > 0 && (
                      <div className="assigned-tile">
                        <div className="tile-icon-circle amber">
                          <Icon name="ac_unit" size={18} color="#7E5200" />
                        </div>
                        <span className="tile-label">AC Units ({acCount})</span>
                        <span className="tile-arrow">›</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card: Occupancy Action */}
                <div className="control-section-card">
                  <h2 className="section-card-title">Occupancy Action</h2>
                  <div className="occupancy-action-body">
                    <div className="action-row-item">
                      <div className="row-item-left">
                        <Icon name="person" size={18} color="#4B5563" />
                        <span className="action-text">Turn on devices (selected zone)</span>
                      </div>
                      <span className="action-chevron">›</span>
                    </div>

                    <div className="action-row-item">
                      <div className="row-item-left">
                        <Icon name="timer" size={18} color="#4B5563" />
                        <span className="action-text">Empty Room Delay</span>
                      </div>
                      <div className="delay-control-pill">
                        <button type="button" className="btn-stepper" onClick={() => setEmptyRoomDelay(d => Math.max(1, d - 1))}>−</button>
                        <span className="stepper-val">{emptyRoomDelay} min</span>
                        <button type="button" className="btn-stepper" onClick={() => setEmptyRoomDelay(d => d + 1)}>+</button>
                      </div>
                    </div>

                    <div className="action-row-item">
                      <div className="row-item-left">
                        <Icon name="tune" size={18} color="#4B5563" />
                        <span className="action-text">Manual Override</span>
                      </div>
                      <button
                        type="button"
                        className={`toggle-switch-pill ${manualOverride ? 'on' : 'off'}`}
                        onClick={() => setManualOverride(v => !v)}
                        aria-label="Toggle Manual Override"
                      >
                        <span className="toggle-switch-slider" />
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </main>
          </div>
        )}

        {/* TAB B: UNIFIED DASHBOARD & ANALYTICS (Continuous Single-Page with Overview, Energy Prediction, and Settings) */}
        {activeTab === 'home' && (
          <div className="tab-pane active-pane">
            <div className="page-header-block">
              <h1 className="page-title">Welcome to S.E.R.O.S.</h1>
              <p className="page-subtitle">Eco-Smart Energy & Resource Optimization Dashboard • Classroom 101</p>
            </div>

            {/* Quick Section Anchor Jump Bar */}
            <div className="dashboard-subtabs-nav" style={{ marginBottom: 24 }}>
              <a
                href="#section-overview"
                className="dashboard-subtab-btn active"
                style={{ textDecoration: 'none' }}
              >
                <Icon name="dashboard" size={16} />
                <span>1. Room Overview</span>
              </a>
              <a
                href="#section-energy-prediction"
                className="dashboard-subtab-btn"
                style={{ textDecoration: 'none' }}
              >
                <Icon name="bolt" size={16} color="#00E676" />
                <span>2. Energy Analytics & Bill Prediction</span>
              </a>
              <a
                href="#section-settings-hardware"
                className="dashboard-subtab-btn"
                style={{ textDecoration: 'none' }}
              >
                <Icon name="tune" size={16} />
                <span>3. Hardware & Tariff Settings</span>
              </a>
            </div>

            {/* =========================================================================
                SECTION 1: ROOM OVERVIEW & CONNECTIVITY
               ========================================================================= */}
            <div id="section-overview" className="home-dashboard-grid" style={{ marginBottom: 32 }}>
              {/* Classroom Overview Card */}
              <div className="home-hero-card">
                <div className="hero-top-row">
                  <div className="hero-status-left">
                    <span className="live-status-pill">
                      <span className="pulse-indicator-dot" />
                      <span>Active Classroom</span>
                    </span>
                    <h2>Classroom 101</h2>
                    <p className="hero-subtext">Active Layout: <strong>{currentLayout.name}</strong> • AI Spatial Automation Enabled</p>
                  </div>
                  <button type="button" className="btn-hero-action" onClick={() => setActiveTab('rooms')}>
                    <Icon name="meeting_room" size={18} color="#FFFFFF" />
                    <span>Enter Live Room</span>
                  </button>
                </div>

                <div className="hero-metrics-quad">
                  <div className="hero-stat-card">
                    <Icon name="groups" size={22} color="#006934" />
                    <span className="stat-number">{boxes.length}</span>
                    <span className="stat-desc">Active Occupants</span>
                  </div>
                  <div className="hero-stat-card">
                    <Icon name="thermostat" size={22} color="#1E6585" />
                    <span className="stat-number">{sensor.temperature.toFixed(1)}°C</span>
                    <span className="stat-desc">Live Room Temp</span>
                  </div>
                  <div className="hero-stat-card">
                    <Icon name="sensors" size={22} color="#7E5200" />
                    <span className="stat-number">{sensor.humidity.toFixed(0)}%</span>
                    <span className="stat-desc">Live Humidity</span>
                  </div>
                  <div className="hero-stat-card">
                    <Icon name="bolt" size={22} color="#006934" />
                    <span className="stat-number">{sensor.energy_saving_percent}%</span>
                    <span className="stat-desc">Energy Saved</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions & System Connectivity */}
              <div className="home-sidebar-cards">
                <div className="system-health-card">
                  <h3>System Status</h3>
                  <div className="health-item-row">
                    <span className="health-name">ESP32 Relay Board</span>
                    <span className="health-badge ok">Connected</span>
                  </div>
                  <div className="health-item-row">
                    <span className="health-name">HTU21DF Sensor</span>
                    <span className="health-badge ok">Active Live</span>
                  </div>
                  <div className="health-item-row">
                    <span className="health-name">YOLO Camera Vision</span>
                    <span className="health-badge ok">{isCameraOn ? 'Tracking' : 'Standby / Paused'}</span>
                  </div>
                  <div className="health-item-row">
                    <span className="health-name">Universal AC IR Remote</span>
                    <span className="health-badge ok">GPIO 4 Armed</span>
                  </div>
                </div>

                <div className="quick-nav-card">
                  <h3>Shortcuts</h3>
                  <button type="button" className="shortcut-btn" onClick={() => setActiveTab('layouts')}>
                    <Icon name="layers" size={18} color="#006934" />
                    <span>Manage Room Layouts</span>
                  </button>
                  <button type="button" className="shortcut-btn" onClick={() => setActiveTab('add_devices')}>
                    <Icon name="add_circle" size={18} color="#006934" />
                    <span>Add Devices (Choose Layout First)</span>
                  </button>
                  <a href="#section-energy-prediction" className="shortcut-btn" style={{ textDecoration: 'none' }}>
                    <Icon name="analytics" size={18} color="#006934" />
                    <span>Jump to Energy Analytics & Bill</span>
                  </a>
                  <a href="#section-settings-hardware" className="shortcut-btn" style={{ textDecoration: 'none' }}>
                    <Icon name="settings" size={18} color="#006934" />
                    <span>Configure Tariff & Hardware</span>
                  </a>
                </div>
              </div>
            </div>

            {/* =========================================================================
                SECTION 2: DYNAMIC ENERGY ANALYTICS & BILL PREDICTION (From Mobile App)
               ========================================================================= */}
            <div id="section-energy-prediction" className="energy-prediction-section" style={{ marginBottom: 36 }}>
              <div className="section-divider-heading">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: '#006934', color: '#FFF', borderRadius: 8, padding: '6px 8px', display: 'flex' }}>
                    <Icon name="bolt" size={20} color="#FFFFFF" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>Energy Analytics & Dynamic Bill Prediction</h2>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Real-time telemetry, daily power schedule intensity, and projected utility estimator</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleDownloadBillStatement}
                    className="btn-download-bill-statement"
                    title="Export bill breakdown summary"
                  >
                    <Icon name="download" size={16} />
                    <span>Download Statement</span>
                  </button>
                </div>
              </div>

              {/* 1. Energy Hero Card (Mobile Screen 4) */}
              <div className="energy-hero-banner" style={{ marginTop: 16 }}>
                <div className="energy-hero-content">
                  <div className="energy-hero-title">
                    You used {sensor.energy_saving_percent}% less electricity today! 🎉
                  </div>
                  <div className="energy-hero-sub">
                    Great job! Your classrooms and labs are powered down safely via AI occupancy zoning.
                  </div>

                  <div className="energy-cost-callout-card">
                    <div className="cost-dial-icon">
                      <Icon name="energy_savings_leaf" size={28} color="#006934" />
                    </div>
                    <div className="cost-info-block">
                      <div className="cost-label">Estimated Cost Today</div>
                      <div className="cost-amount">₹{todayCost}</div>
                    </div>
                    <div className="cost-savings-pill">
                      <Icon name="arrow_downward" size={14} color="#006934" />
                      <span>₹{todaySavedCost} saved vs unzoned</span>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="energy-timeframe-pills">
                    <button
                      type="button"
                      className={`time-pill ${energyTimeframe === 'today' ? 'active' : ''}`}
                      onClick={() => setEnergyTimeframe('today')}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`time-pill ${energyTimeframe === '7days' ? 'active' : ''}`}
                      onClick={() => setEnergyTimeframe('7days')}
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      className={`time-pill ${energyTimeframe === 'month' ? 'active' : ''}`}
                      onClick={() => setEnergyTimeframe('month')}
                    >
                      This Month
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Grid: Weekly Daily Power & Schedule Intensity (Mobile Screen 3 & 4) */}
              <div className="energy-two-col-grid" style={{ marginTop: 20 }}>
                {/* Column A: Weekly Daily Power Bar Chart */}
                <div className="module-card">
                  <div className="card-top" style={{ marginBottom: 6 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Weekly Daily Power</h3>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Touch / click any day to inspect cost</p>
                    </div>
                    <div style={{ background: 'rgba(0, 105, 52, 0.12)', padding: '5px 8px', borderRadius: 8 }}>
                      <Icon name="bar_chart" size={20} color="#006934" />
                    </div>
                  </div>

                  {/* Interactive Day Bars */}
                  {(() => {
                    const days = [
                      { label: 'M', cost: 42, type: 'mid', note: 'Mon: Moderate power (₹42) — Morning lighting' },
                      { label: 'T', cost: 32, type: 'low', note: 'Tue: Low power (₹32) — Spatial zones idle' },
                      { label: 'W', cost: 64, type: 'peak', note: 'Wed: Highest use (₹64) — ACs ran past 4 PM' },
                      { label: 'T', cost: 38, type: 'low', note: 'Thu: Balanced use (₹38) — Only 2 fans active' },
                      { label: 'F', cost: 50, type: 'mid', note: 'Fri: Evening labs active (₹50)' },
                      { label: 'S', cost: 18, type: 'low', note: 'Sat: Weekend standby power (₹18)' },
                      { label: 'S', cost: todayCost, type: todayCost > 55 ? 'peak' : todayCost > 38 ? 'mid' : 'low', note: `Sun: Today's live run (₹${todayCost}) • Active load ${activeWattage}W` },
                    ];
                    const maxCost = 75;
                    const selectedDay = days[selectedDayIndex] || days[2];

                    return (
                      <div>
                        <div className="weekly-bars-container">
                          {days.map((d, idx) => {
                            const isSelected = selectedDayIndex === idx;
                            const heightPct = Math.min(100, Math.round((d.cost / maxCost) * 100));
                            const barColor = d.type === 'peak' ? '#DC2626' : d.type === 'mid' ? '#F59E0B' : '#006934';
                            return (
                              <div
                                key={idx}
                                className={`weekly-bar-col ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedDayIndex(idx)}
                                title={`Click to inspect ${d.label}`}
                              >
                                <span className="bar-cost-tag">₹{d.cost}</span>
                                <div className="bar-track-vert">
                                  <div
                                    className="bar-fill-vert"
                                    style={{
                                      height: `${heightPct}%`,
                                      backgroundColor: barColor,
                                      boxShadow: isSelected ? `0 0 10px ${barColor}` : 'none'
                                    }}
                                  />
                                </div>
                                <span className={`bar-day-label ${isSelected ? 'active-day' : ''}`}>{d.label}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Selected Day Inspection Alert Banner */}
                        <div className="day-inspection-alert">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="inspection-dot" style={{ backgroundColor: selectedDay.type === 'peak' ? '#DC2626' : selectedDay.type === 'mid' ? '#F59E0B' : '#006934' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{selectedDay.note}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#006934', cursor: 'pointer' }}>Details</span>
                        </div>

                        {/* Legend */}
                        <div className="bar-legend-row">
                          <div className="legend-chip">
                            <span className="dot" style={{ backgroundColor: '#006934' }} />
                            <span>Low use (₹32)</span>
                          </div>
                          <div className="legend-chip">
                            <span className="dot" style={{ backgroundColor: '#F59E0B' }} />
                            <span>Medium</span>
                          </div>
                          <div className="legend-chip">
                            <span className="dot" style={{ backgroundColor: '#DC2626' }} />
                            <span>Peak (₹64)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Column B: Schedule Intensity Heatmap Grid (Mobile Screen 3) */}
                <div className="module-card">
                  <div className="card-top" style={{ marginBottom: 6 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>When is power used most?</h3>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Daily schedule energy intensity</p>
                    </div>
                    <div style={{ background: 'rgba(0, 105, 52, 0.12)', padding: '5px 8px', borderRadius: 8 }}>
                      <Icon name="grid_view" size={20} color="#006934" />
                    </div>
                  </div>

                  <div className="schedule-matrix-wrapper">
                    <table className="schedule-matrix-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>8 AM<br/><span style={{ fontSize: 10, color: '#94A3B8' }}>Morn</span></th>
                          <th>12 PM<br/><span style={{ fontSize: 10, color: '#94A3B8' }}>Noon</span></th>
                          <th>4 PM<br/><span style={{ fontSize: 10, color: '#94A3B8' }}>Eve</span></th>
                          <th>8 PM<br/><span style={{ fontSize: 10, color: '#94A3B8' }}>Night</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="day-name">Mon</td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip peak">Peak</span></td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip off">Off</span></td>
                        </tr>
                        <tr>
                          <td className="day-name">Tue</td>
                          <td><span className="matrix-chip low">Low</span></td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip low">Low</span></td>
                          <td><span className="matrix-chip off">Off</span></td>
                        </tr>
                        <tr>
                          <td className="day-name">Wed</td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip peak">Peak</span></td>
                          <td><span className="matrix-chip peak">Peak</span></td>
                          <td><span className="matrix-chip off">Off</span></td>
                        </tr>
                        <tr>
                          <td className="day-name">Thu</td>
                          <td><span className="matrix-chip low">Low</span></td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip off">Off</span></td>
                        </tr>
                        <tr>
                          <td className="day-name">Fri</td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip mid">Mid</span></td>
                          <td><span className="matrix-chip low">Low</span></td>
                          <td><span className="matrix-chip off">Off</span></td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Schedule Legend */}
                    <div className="schedule-legend-pill" style={{ marginTop: 12 }}>
                      <span><span className="dot" style={{ backgroundColor: '#006934' }} /> Low / Off</span>
                      <span><span className="dot" style={{ backgroundColor: '#F59E0B' }} /> Medium</span>
                      <span><span className="dot" style={{ backgroundColor: '#DC2626' }} /> Busy / High</span>
                    </div>

                    {/* Classroom Advice Callout Box */}
                    <div className="classroom-advice-box" style={{ marginTop: 14 }}>
                      <Icon name="wb_sunny" size={20} color="#D97706" />
                      <span>Classrooms use most energy between <strong>10 AM and 2 PM</strong> when projectors and multiple fans are running.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Bill Estimator (Mobile Screen 5) & Live Zone Power Breakdown */}
              <div className="energy-two-col-grid" style={{ marginTop: 20 }}>
                {/* Bill Estimator Card */}
                <div className="module-card bill-estimator-module">
                  <div className="card-top" style={{ marginBottom: 6 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Bill Estimator</h3>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Expected total for this cycle</p>
                    </div>
                    <div style={{ background: 'rgba(0, 105, 52, 0.12)', padding: '5px 8px', borderRadius: 8 }}>
                      <Icon name="receipt_long" size={20} color="#006934" />
                    </div>
                  </div>

                  {/* Main Estimated Total Banner */}
                  <div className="bill-estimated-total-card">
                    <div className="bill-label">Estimated Monthly Bill</div>
                    <div className="bill-big-amount">₹{projectedTotalBill.toLocaleString('en-IN')}</div>
                    <div className="bill-sub">Next bill arrives in 12 days</div>
                  </div>

                  {/* Projected Units Selector */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Projected Units:</span>
                      <span className="projected-badge">{projectedKwh} kWh</span>
                    </div>
                    <div className="projected-kwh-pills">
                      {[180, 250, 320, 400].map(kwh => (
                        <button
                          key={kwh}
                          type="button"
                          className={`kwh-pill ${projectedKwh === kwh ? 'active' : ''}`}
                          onClick={() => setProjectedKwh(kwh)}
                        >
                          {kwh} kWh
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="range"
                        min="50"
                        max="800"
                        step="10"
                        value={projectedKwh}
                        onChange={(e) => setProjectedKwh(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#006934', cursor: 'pointer' }}
                        title="Fine-tune projected units slider"
                      />
                    </div>
                  </div>

                  {/* Simple Breakdown Table */}
                  <div className="bill-simple-breakdown" style={{ marginTop: 14 }}>
                    <div className="breakdown-title">SIMPLE BREAKDOWN</div>
                    <div className="breakdown-row">
                      <span>Energy use ({projectedKwh} kWh @ ₹{tariffRate.toFixed(2)}):</span>
                      <strong>₹{projectedEnergyCost.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="breakdown-row">
                      <span>Standard charges (Fixed):</span>
                      <strong>₹{fixedMonthlyCharges.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="breakdown-row">
                      <span>Government duty ({dutyRatePct}%):</span>
                      <strong>₹{projectedDutyCost.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  {/* Quick Tip Box */}
                  <div className="quick-tip-callout" style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Icon name="lightbulb" size={18} color="#D97706" />
                      <span style={{ fontSize: 12, lineHeight: 1.45, color: '#1E293B' }}>
                        <strong>Quick Tip:</strong> Turning off ACs 15 mins before leaving saves approximately <strong>~₹320/month</strong> without warming up rooms!
                      </span>
                    </div>
                  </div>

                  {/* Statement Download CTA */}
                  <button
                    type="button"
                    className="btn-download-bill-full"
                    onClick={handleDownloadBillStatement}
                    style={{ marginTop: 14 }}
                  >
                    <Icon name="download" size={16} color="#FFFFFF" />
                    <span>Download Plain-Language Bill Statement</span>
                  </button>
                </div>

                {/* Live Zone Power Breakdown Card */}
                <div className="module-card">
                  <div className="card-top" style={{ marginBottom: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Live Zone Power Consumption</h3>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Spatial load per assigned quadrant & relay</p>
                    </div>
                    <span className="live-watts-pill">Total: {activeWattage}W Active</span>
                  </div>

                  <div className="zone-bars-list" style={{ marginTop: 12 }}>
                    {currentLayout.zones.map(z => {
                      const zDevs = devices.filter(d => (d.quadrantNum === z.num) || (d.quadrants && d.quadrants.includes(z.num)));
                      const zWatts = zDevs.filter(d => d.status === 'ON').reduce((sum, d) => sum + (d.powerWatts || 40), 0);
                      const maxWatts = 1600;
                      const pct = Math.min(100, Math.round((zWatts / maxWatts) * 100));

                      return (
                        <div key={z.id} className="zone-power-bar-row">
                          <div className="bar-label-group">
                            <span className="bar-dot" style={{ backgroundColor: z.color }} />
                            <span className="bar-name">{z.name}</span>
                            <span className="bar-relay-tag">Relay {z.relay || z.num} (Pin {getRelayPin(z.relay || z.num)})</span>
                            <span className="bar-watts">{zWatts}W</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${Math.max(4, pct)}%`, backgroundColor: z.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Environmental Telemetry summary */}
                  <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(0,105,52,0.06)', borderRadius: 10, border: '1px solid rgba(0,105,52,0.15)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#006934', marginBottom: 6, textTransform: 'uppercase' }}>
                      Environmental Telemetry Correlation
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748B' }}>Room Temp</span>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{sensor.temperature.toFixed(1)}°C</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748B' }}>Humidity</span>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{sensor.humidity.toFixed(0)}%</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748B' }}>Active Devices</span>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{devices.filter(d => d.status === 'ON').length}/{devices.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================================================================
                SECTION 3: SYSTEM SETTINGS, HARDWARE & TARIFF CONFIGURATION
               ========================================================================= */}
            <div id="section-settings-hardware" className="settings-section" style={{ marginTop: 36, marginBottom: 40 }}>
              <div className="section-divider-heading">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: '#0F172A', color: '#FFF', borderRadius: 8, padding: '6px 8px', display: 'flex' }}>
                    <Icon name="tune" size={20} color="#FFFFFF" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>Hardware, System & Tariff Configuration</h2>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Customize electricity billing parameters, ESP32 sensors, and AI vision camera</p>
                  </div>
                </div>
              </div>

              <div className="settings-cards-list" style={{ marginTop: 16 }}>
                {/* 1. Electricity Tariff & Billing Configuration Card */}
                <div className="module-card">
                  <div className="card-top" style={{ marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>⚡ Electricity Tariff & Billing Parameters</h3>
                    <span style={{ fontSize: 11, color: '#006934', fontWeight: 700 }}>● Auto-Saved</span>
                  </div>
                  <div className="action-row-item">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>Tariff Rate (₹ per kWh / Unit)</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Applied to active classroom consumption</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800 }}>₹</span>
                      <input
                        type="number"
                        step="0.10"
                        min="1"
                        max="25"
                        value={tariffRate}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 5.50;
                          setTariffRate(v);
                          try { localStorage.setItem('seros_tariff_rate', String(v)); } catch {}
                        }}
                        style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 800 }}
                      />
                    </div>
                  </div>

                  <div className="action-row-item">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>Standard Fixed Charges (₹ per Month)</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Fixed monthly meter and sanction load cost</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800 }}>₹</span>
                      <input
                        type="number"
                        step="50"
                        min="0"
                        max="10000"
                        value={fixedMonthlyCharges}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 1350;
                          setFixedMonthlyCharges(v);
                          try { localStorage.setItem('seros_fixed_charges', String(v)); } catch {}
                        }}
                        style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 800 }}
                      />
                    </div>
                  </div>

                  <div className="action-row-item">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>Government Electricity Duty (%)</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>State statutory surcharge applied on energy use</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="30"
                        value={dutyRatePct}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 8;
                          setDutyRatePct(v);
                          try { localStorage.setItem('seros_duty_pct', String(v)); } catch {}
                        }}
                        style={{ width: 70, padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 800 }}
                      />
                      <span style={{ fontWeight: 800 }}>%</span>
                    </div>
                  </div>
                </div>

                {/* 2. Environmental Sensor Hardware Card */}
                <div className="module-card">
                  <h3 style={{ marginBottom: 14 }}>Environmental Sensor (ESP32-HTU21DF)</h3>
                  <div className="action-row-item">
                    <span>ESP32 Hardware IP</span>
                    <span className="mono-badge">192.168.1.184</span>
                  </div>
                  <div className="action-row-item">
                    <span>HTU21DF Live Telemetry</span>
                    <span className="green-badge">Live: {sensor.temperature.toFixed(1)}°C • {sensor.humidity.toFixed(0)}% RH</span>
                  </div>
                </div>

                {/* 3. Universal AC Remote Card */}
                <div className="module-card">
                  <h3 style={{ marginBottom: 14 }}>Universal AC Remote (IRremoteESP8266)</h3>
                  <div className="action-row-item">
                    <span>WiFi SSID</span>
                    <span className="mono-badge">Marshal027</span>
                  </div>
                  <div className="action-row-item">
                    <span>IR Receiver Pin</span>
                    <span className="mono-badge">GPIO 14</span>
                  </div>
                  <div className="action-row-item">
                    <span>IR Transmitter LED</span>
                    <span className="mono-badge">GPIO 4</span>
                  </div>
                </div>

                {/* 4. Vision & AI Parameters */}
                <div className="module-card">
                  <h3 style={{ marginBottom: 14 }}>Vision & AI Parameters</h3>
                  <div className="action-row-item">
                    <span>Active Camera Input Device</span>
                    <div className="camera-select-pill">
                      <Icon name="videocam" size={15} color="#006934" />
                      <select
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        className="camera-dropdown-select"
                        aria-label="Active Camera Device"
                      >
                        {availableCameras.length > 0 ? (
                          availableCameras.map((cam, idx) => (
                            <option key={cam.deviceId || idx} value={cam.deviceId}>
                              {cam.label || `Camera ${idx + 1}`}
                            </option>
                          ))
                        ) : (
                          <option value="">Default System Camera</option>
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="action-row-item">
                    <span>Camera Stream Mirror</span>
                    <button type="button" className={`toggle-switch-pill ${mirror ? 'on' : 'off'}`} onClick={() => setMirror(m => !m)}>
                      <span className="toggle-switch-slider" />
                    </button>
                  </div>
                  <div className="action-row-item">
                    <span>Empty Room Auto-Shutoff</span>
                    <span>{emptyRoomDelay} minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB C: LAYOUTS (Layout Management & 3D Editor - Website Only) */}
        {activeTab === 'layouts' && (
          <div className="tab-pane active-pane">
            <div className="page-header-block">
              <h1 className="page-title">Room Layouts & 3D Spatial Editor</h1>
              <p className="page-subtitle">Configure volumetric room coordinates, switch room blueprints, or run AI auto-mapping</p>
            </div>

            <div className="layouts-two-col-grid">
              {/* Column 1: Layout Management */}
              <div className="module-card layout-management-module">
                <div className="module-header-row">
                  <div className="module-header-title">
                    <Icon name="layers" size={18} color="#006934" />
                    <h3>Available Layouts</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-create-layout"
                    onClick={() => setIsNewLayoutModalOpen(true)}
                  >
                    <Icon name="add" size={16} color="#FFFFFF" />
                    <span>Create New Layout</span>
                  </button>
                </div>

                <div className="layouts-card-list">
                  {layouts.map((l) => {
                    const isActive = l.id === activeLayoutId;
                    return (
                      <div key={l.id} className={`layout-item-card ${isActive ? 'active' : ''}`}>
                        <div className="layout-thumb-preview">
                          <div className="thumb-grid-preview">
                            {l.zones.slice(0, 4).map((z, idx) => (
                              <span key={idx} className="thumb-block" style={{ backgroundColor: z.color }} />
                            ))}
                          </div>
                        </div>

                        {renamingLayoutId === l.id ? (
                          <div className="layout-rename-box" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renamingLayoutName}
                              onChange={(e) => setRenamingLayoutName(e.target.value)}
                              className="layout-rename-input"
                              autoFocus
                              placeholder="Layout name"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleSaveRenameLayout(l.id);
                                if (e.key === 'Escape') setRenamingLayoutId(null);
                              }}
                            />
                            <button
                              type="button"
                              className="btn-rename-action save"
                              title="Save Layout Name"
                              onClick={() => void handleSaveRenameLayout(l.id)}
                            >
                              <Icon name="check" size={13} color="#FFFFFF" />
                            </button>
                            <button
                              type="button"
                              className="btn-rename-action cancel"
                              title="Cancel"
                              onClick={() => setRenamingLayoutId(null)}
                            >
                              <Icon name="close" size={13} color="#4B5563" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="layout-card-info"
                            title="Double-click to rename layout"
                            onDoubleClick={() => {
                              setRenamingLayoutId(l.id);
                              setRenamingLayoutName(l.name);
                            }}
                          >
                            <span className="layout-card-name">{l.name}</span>
                            <span className="layout-card-sub">{l.subtitle || `${l.zones.length} Zones`}</span>
                          </div>
                        )}

                        <div className="layout-card-actions">
                          <button
                            type="button"
                            className={`btn-card-action ${isActive ? 'current' : ''}`}
                            title="Activate Layout"
                            onClick={() => handleSelectLayout(l.id)}
                          >
                            <Icon name="check" size={15} color={isActive ? '#006934' : '#6B7280'} />
                          </button>
                          <button
                            type="button"
                            className="btn-card-action edit"
                            title="Rename Layout"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingLayoutId(l.id);
                              setRenamingLayoutName(l.name);
                            }}
                          >
                            <Icon name="edit" size={14} color="#006934" />
                          </button>
                          {layouts.length > 1 && (
                            <button
                              type="button"
                              className="btn-card-action delete"
                              title="Delete Layout"
                              onClick={() => handleDeleteLayout(l.id)}
                            >
                              <Icon name="delete" size={15} color="#DC2626" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: 3D Layout Editor Canvas with Live Camera Feed & Freeze Frame */}
              <div className="module-card layout-editor-module">
                <div className="module-header-row">
                  <div className="module-header-title">
                    <Icon name="view_in_ar" size={18} color="#006934" />
                    <h3>3D Perspective Layout Canvas</h3>
                  </div>

                  <div className="editor-top-actions">
                    {/* Camera Chooser Dropdown */}
                    <div className="camera-select-pill" title="Choose Camera Source for Layout Editing">
                      <Icon name="videocam" size={15} color="#006934" />
                      <select
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        className="camera-dropdown-select"
                        aria-label="Choose Camera for Layout Editor"
                      >
                        {availableCameras.length > 0 ? (
                          availableCameras.map((cam, idx) => (
                            <option key={cam.deviceId || idx} value={cam.deviceId}>
                              {cam.label || `Camera ${idx + 1}`}
                            </option>
                          ))
                        ) : (
                          <option value="">Default System Camera</option>
                        )}
                      </select>
                    </div>

                    {/* Camera Power Toggle in Layouts view */}
                    <button
                      type="button"
                      className={`btn-toolbar-toggle ${isCameraOn ? 'active' : ''}`}
                      onClick={handleToggleLaptopCamera}
                      title={isCameraOn ? 'Turn camera & YOLO off' : 'Turn camera on'}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <Icon name={isCameraOn ? 'videocam' : 'videocam_off'} size={15} />
                      <span>{isCameraOn ? 'Cam Active' : 'Cam Off'}</span>
                    </button>

                    {/* Freeze Frame Button for Edition */}
                    {!isFrameFrozen ? (
                      <button
                        type="button"
                        className="btn-freeze-frame"
                        onClick={handleFreezeFrame}
                        title="Freeze the live camera frame to calibrate perspective layout"
                      >
                        <Icon name="pause_circle" size={16} color="#FFFFFF" />
                        <span>Freeze Frame for Edition</span>
                      </button>
                    ) : (
                      <div className="frozen-action-group">
                        <button
                          type="button"
                          className="btn-resume-stream"
                          onClick={handleResumeLiveStream}
                          title="Resume live camera feed"
                        >
                          <Icon name="play_arrow" size={16} color="#FFFFFF" />
                          <span>Resume Live Feed</span>
                        </button>
                        <button
                          type="button"
                          className="btn-recapture-frame"
                          onClick={handleFreezeFrame}
                          title="Capture another frame snapshot"
                        >
                          <Icon name="camera_alt" size={15} color="#006934" />
                          <span>Snap New Frame</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn-ai-automap-header"
                      onClick={() => setIsAiModalOpen(true)}
                    >
                      <Icon name="auto_awesome" size={15} color="#006934" />
                      <span>AI Auto-Map</span>
                    </button>

                    <div className="view-mode-pill-group">
                      <button
                        type="button"
                        className={`btn-view-toggle ${editorViewMode === '3d' ? 'active' : ''}`}
                        onClick={() => setEditorViewMode('3d')}
                      >
                        3D View
                      </button>
                      <button
                        type="button"
                        className={`btn-view-toggle ${editorViewMode === 'top' ? 'active' : ''}`}
                        onClick={() => setEditorViewMode('top')}
                      >
                        Top View
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save Notification Banner */}
                {saveLayoutNotice && (
                  <div className="layout-save-banner">
                    <Icon name="check_circle" size={15} color="#15803D" />
                    <span>{saveLayoutNotice}</span>
                  </div>
                )}

                <div className="editor-canvas-stage">
                  {/* 3D Perspective Trapezoid Room Stage with Live Feed or Frozen Image */}
                  <div className={`canvas-perspective-room ${editorViewMode === 'top' ? 'flat-top' : 'iso-3d'}`}>
                    
                    {/* Live Video Feed or Frozen Snapshot */}
                    {isFrameFrozen && frozenFrameUrl ? (
                      <img
                        src={frozenFrameUrl}
                        alt="Frozen Room Perspective for Zone Calibration"
                        className={`layout-canvas-bg-media ${mirror ? 'mirrored' : ''}`}
                      />
                    ) : isCameraOn ? (
                      <video
                        ref={layoutVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`layout-canvas-bg-media ${mirror ? 'mirrored' : ''}`}
                      />
                    ) : (
                      <div className="layout-canvas-standby">
                        <Icon name="videocam_off" size={40} color="#94A3B8" />
                        <span>Camera Muted • Click 'Start Camera' in Rooms View</span>
                      </div>
                    )}

                    {/* Floating HUD status indicator */}
                    <div className="editor-canvas-hud">
                      {isFrameFrozen ? (
                        <span className="editor-hud-badge frozen">
                          <span className="frozen-dot" />
                          <span>FRAME FROZEN • EDITING MODE</span>
                        </span>
                      ) : isCameraOn ? (
                        <span className="editor-hud-badge live">
                          <span className="pulse-indicator-dot small" />
                          <span>LIVE CAMERA FEED</span>
                        </span>
                      ) : (
                        <span className="editor-hud-badge muted">
                          <span className="frozen-dot" style={{ backgroundColor: '#EF4444' }} />
                          <span>CAMERA OFF • YOLO PAUSED</span>
                        </span>
                      )}
                      <span className="editor-hud-badge layout-name">
                        <Icon name="layers" size={12} color="#FFFFFF" />
                        <span>{currentLayout.name}</span>
                      </span>
                    </div>

                    {/* Interactive SVG Zones Overlay */}
                    <svg
                      ref={svgRef}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="room-editor-svg"
                    >
                      {/* LAYER 1: Zone Geometries (Walls, Ceiling Roofs, Pillars, Floor Bases & Badges) */}
                      <g className="zones-geometry-layer">
                        {currentLayout.zones.map((z) => {
                          const isSelected = selectedZoneId === z.id;
                          const floorPts = z.points.map(p => [p[0] * 100, p[1] * 100]);
                          const floorPointsStr = floorPts.map(p => `${p[0]},${p[1]}`).join(' ');

                          // Compute 3D top ceiling points in [0, 100] coordinates
                          let topPts: [number, number][] = [];
                          if (z.volumetric?.top && z.volumetric.top.length === z.points.length) {
                            topPts = z.volumetric.top.map(p => [p[0] * 100, p[1] * 100]);
                          } else {
                            topPts = floorPts.map(([fx, fy]) => {
                              const wallH = 10 + 0.32 * Math.max(0, Math.min(100, fy));
                              return [fx, Math.max(0, fy - wallH)];
                            });
                          }

                          // 4 Vertical Pillars
                          const pillars: [[number, number], [number, number]][] = floorPts.map((fp, i) => [
                            [fp[0], fp[1]],
                            [topPts[i][0], topPts[i][1]]
                          ]);

                          // 4 Vertical Wall Facets
                          const wallFacets: [number, number][][] = [];
                          for (let i = 0; i < floorPts.length; i++) {
                            const next = (i + 1) % floorPts.length;
                            wallFacets.push([floorPts[i] as [number, number], floorPts[next] as [number, number], topPts[next], topPts[i]]);
                          }

                          // 3D Centroid for floating badge
                          const allX = [...floorPts.map(p => p[0]), ...topPts.map(p => p[0])];
                          const allY = [...floorPts.map(p => p[1]), ...topPts.map(p => p[1])];
                          const cx = allX.reduce((a, b) => a + b, 0) / allX.length;
                          const cy = allY.reduce((a, b) => a + b, 0) / allY.length;

                          return (
                            <g
                              key={z.id}
                              className={`editor-zone-group ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedZoneId(z.id)}
                            >
                              {/* In 3D Mode: Render 3D Walls, Ceiling Roof and Pillars */}
                              {editorViewMode === '3d' && (
                                <>
                                  {/* 3D Wall Facets */}
                                  {wallFacets.map((facet, fIdx) => (
                                    <polygon
                                      key={`wall-${fIdx}`}
                                      points={facet.map(p => `${p[0]},${p[1]}`).join(' ')}
                                      fill={z.color}
                                      fillOpacity={isSelected ? 0.12 : 0.05}
                                      stroke={isSelected ? '#FFFFFF' : z.color}
                                      strokeWidth={isSelected ? '0.6' : '0.3'}
                                      strokeLinejoin="round"
                                      strokeDasharray={isSelected ? 'none' : '1.2, 0.8'}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  ))}

                                  {/* Top Volumetric Ceiling Roof */}
                                  <polygon
                                    points={topPts.map(p => `${p[0]},${p[1]}`).join(' ')}
                                    fill={z.color}
                                    fillOpacity={isSelected ? 0.14 : 0.06}
                                    stroke={isSelected ? '#FFFFFF' : z.color}
                                    strokeWidth={isSelected ? '0.8' : '0.4'}
                                    strokeLinejoin="round"
                                    style={{ cursor: 'pointer' }}
                                  />

                                  {/* Vertical Corner Pillars */}
                                  {pillars.map((pil, pIdx) => (
                                    <line
                                      key={`pil-${pIdx}`}
                                      x1={pil[0][0]}
                                      y1={pil[0][1]}
                                      x2={pil[1][0]}
                                      y2={pil[1][1]}
                                      stroke={isSelected ? '#FFFFFF' : z.color}
                                      strokeWidth={isSelected ? '0.8' : '0.4'}
                                      strokeLinecap="round"
                                      strokeDasharray={isSelected ? 'none' : '1.0, 0.8'}
                                    />
                                  ))}
                                </>
                              )}

                              {/* Zone Floor Base Polygon */}
                              <polygon
                                points={floorPointsStr}
                                fill={z.color}
                                fillOpacity={isSelected ? 0.18 : 0.08}
                                stroke={isSelected ? '#FFFFFF' : z.color}
                                strokeWidth={isSelected ? '1.0' : '0.5'}
                                style={{ cursor: 'pointer' }}
                              />

                              {/* Floating 3D Zone Name Badge with Relay & Pin */}
                              <g style={{ pointerEvents: 'none' }}>
                                <rect
                                  x={cx - 7.5}
                                  y={cy - 2.8}
                                  width={15.0}
                                  height={5.6}
                                  rx={1.0}
                                  fill="rgba(10, 15, 30, 0.88)"
                                  stroke={z.color}
                                  strokeWidth={isSelected ? '0.6' : '0.35'}
                                  filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.8))"
                                />
                                <text
                                  x={cx}
                                  y={cy - 0.7}
                                  fill="#FFFFFF"
                                  fontSize="1.8"
                                  fontWeight="800"
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  {z.name}
                                </text>
                                <text
                                  x={cx}
                                  y={cy + 1.4}
                                  fill={z.color}
                                  fontSize="1.35"
                                  fontWeight="700"
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  ⚡ Relay {z.relay || z.num || 1} (GPIO {getRelayPin(z.relay || z.num || 1)})
                                </text>
                              </g>
                            </g>
                          );
                        })}
                      </g>

                      {/* LAYER 2: Unselected Zone Corner Node Indicators (Visible nodes on all zone corners) */}
                      <g className="unselected-corner-nodes-layer">
                        {currentLayout.zones.filter(z => z.id !== selectedZoneId).map(z => {
                          const floorPts = z.points.map(p => [p[0] * 100, p[1] * 100]);
                          let zTopPts: [number, number][] = [];
                          if (z.volumetric?.top && z.volumetric.top.length === z.points.length) {
                            zTopPts = z.volumetric.top.map(p => [p[0] * 100, p[1] * 100]);
                          } else {
                            zTopPts = floorPts.map(([fx, fy]) => {
                              const wallH = 10 + 0.32 * Math.max(0, Math.min(100, fy));
                              return [fx, Math.max(0, fy - wallH)];
                            });
                          }

                          return (
                            <g key={`unsel-zone-${z.id}`}>
                              {/* Floor Nodes */}
                              {z.points.map((p, pIdx) => (
                                <g
                                  key={`unsel-node-${z.id}-${pIdx}`}
                                  style={{ cursor: 'grab' }}
                                  onPointerDown={(e) => startDraggingPoint(e, z.id, pIdx, 'floor')}
                                >
                                  <title>{z.name} - Floor Corner {pIdx + 1} [{p[0].toFixed(2)}, {p[1].toFixed(2)}] • Click & drag</title>
                                  <circle cx={p[0] * 100} cy={p[1] * 100} r="7.0" fill="transparent" style={{ touchAction: 'none' }} />
                                  <circle
                                    cx={p[0] * 100}
                                    cy={p[1] * 100}
                                    r="1.0"
                                    fill={z.color}
                                    stroke="#FFFFFF"
                                    strokeWidth="0.4"
                                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.7))"
                                    style={{ pointerEvents: 'none' }}
                                  />
                                </g>
                              ))}

                              {/* 3D Ceiling Nodes */}
                              {editorViewMode === '3d' && zTopPts.map((tp, pIdx) => (
                                <g
                                  key={`unsel-top-${z.id}-${pIdx}`}
                                  style={{ cursor: 'grab' }}
                                  onPointerDown={(e) => startDraggingPoint(e, z.id, pIdx, 'top')}
                                >
                                  <title>{z.name} - Ceiling Node {pIdx + 1} • Click to select & drag</title>
                                  <circle cx={tp[0]} cy={tp[1]} r="7.0" fill="transparent" style={{ touchAction: 'none' }} />
                                  <rect
                                    x={tp[0] - 0.9}
                                    y={tp[1] - 0.9}
                                    width="1.8"
                                    height="1.8"
                                    rx="0.4"
                                    transform={`rotate(45 ${tp[0]} ${tp[1]})`}
                                    fill={z.color}
                                    stroke="#FFFFFF"
                                    strokeWidth="0.4"
                                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.7))"
                                    style={{ pointerEvents: 'none' }}
                                  />
                                </g>
                              ))}
                            </g>
                          );
                        })}
                      </g>

                      {/* LAYER 3: Selected Zone Handles (TOPMOST IN SVG - Zero occlusion by other zones) */}
                      {(() => {
                        const activeZone = currentLayout.zones.find(z => z.id === selectedZoneId);
                        if (!activeZone) return null;

                        const floorPts = activeZone.points.map(p => [p[0] * 100, p[1] * 100]);
                        let activeTopPts: [number, number][] = [];
                        if (activeZone.volumetric?.top && activeZone.volumetric.top.length === activeZone.points.length) {
                          activeTopPts = activeZone.volumetric.top.map(p => [p[0] * 100, p[1] * 100]);
                        } else {
                          activeTopPts = floorPts.map(([fx, fy]) => {
                            const wallH = 10 + 0.32 * Math.max(0, Math.min(100, fy));
                            return [fx, Math.max(0, fy - wallH)];
                          });
                        }

                        return (
                          <g className="selected-zone-handles-overlay">
                            {/* 1. 3D CEILING ROOF CORNER HANDLES */}
                            {editorViewMode === '3d' && activeTopPts.map((tp, pIdx) => (
                              <g
                                key={`active-top-handle-${pIdx}`}
                                style={{ cursor: 'grab' }}
                                onPointerDown={(e) => startDraggingPoint(e, activeZone.id, pIdx, 'top')}
                              >
                                <title>{activeZone.name} - Ceiling Corner {pIdx + 1} [{tp[0].toFixed(1)}, {tp[1].toFixed(1)}] • Drag to adjust ceiling height & wall perspective</title>
                                <circle
                                  cx={tp[0]}
                                  cy={tp[1]}
                                  r="7.0"
                                  fill="transparent"
                                  style={{ touchAction: 'none' }}
                                />
                                <rect
                                  x={tp[0] - 1.4}
                                  y={tp[1] - 1.4}
                                  width="2.8"
                                  height="2.8"
                                  rx="0.5"
                                  transform={`rotate(45 ${tp[0]} ${tp[1]})`}
                                  fill="#FFFFFF"
                                  stroke={activeZone.color}
                                  strokeWidth="0.6"
                                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.85))"
                                  style={{ pointerEvents: 'none' }}
                                />
                                <circle
                                  cx={tp[0]}
                                  cy={tp[1]}
                                  r="0.5"
                                  fill={activeZone.color}
                                  style={{ pointerEvents: 'none' }}
                                />
                              </g>
                            ))}

                            {/* 2. Midpoint Split '+' Handles */}
                            {activeZone.points.map((p, pIdx) => {
                              const nextP = activeZone.points[(pIdx + 1) % activeZone.points.length];
                              const mx = (p[0] + nextP[0]) / 2;
                              const my = (p[1] + nextP[1]) / 2;
                              return (
                                <g
                                  key={`mid-${pIdx}`}
                                  style={{ cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddNodeToZone(activeZone.id, pIdx + 1, [mx, my]);
                                  }}
                                >
                                  <title>Click '+' to insert a new corner node along this edge</title>
                                  <circle
                                    cx={mx * 100}
                                    cy={my * 100}
                                    r="1.2"
                                    fill="#006934"
                                    stroke="#FFFFFF"
                                    strokeWidth="0.4"
                                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
                                  />
                                  <text
                                    x={mx * 100}
                                    y={my * 100}
                                    fill="#FFFFFF"
                                    fontSize="1.4"
                                    fontWeight="900"
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                  >
                                    +
                                  </text>
                                </g>
                              );
                            })}

                            {/* 3. FLOOR BASE DRAGGABLE CORNER HANDLES */}
                            {activeZone.points.map((p, pIdx) => (
                              <g
                                key={`active-floor-handle-${pIdx}`}
                                style={{ cursor: 'grab' }}
                                onPointerDown={(e) => startDraggingPoint(e, activeZone.id, pIdx, 'floor')}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveNodeFromZone(activeZone.id, pIdx);
                                }}
                              >
                                <title>{activeZone.name} - Floor Corner {pIdx + 1} [{p[0].toFixed(2)}, {p[1].toFixed(2)}] • Drag to adjust • Double-click to delete</title>
                                <circle
                                  cx={p[0] * 100}
                                  cy={p[1] * 100}
                                  r="7.0"
                                  fill="transparent"
                                  style={{ touchAction: 'none' }}
                                />
                                <circle
                                  cx={p[0] * 100}
                                  cy={p[1] * 100}
                                  r="1.6"
                                  fill="#FFFFFF"
                                  stroke={activeZone.color}
                                  strokeWidth="0.6"
                                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.85))"
                                  style={{ pointerEvents: 'none' }}
                                />
                                <circle
                                  cx={p[0] * 100}
                                  cy={p[1] * 100}
                                  r="0.6"
                                  fill={activeZone.color}
                                  style={{ pointerEvents: 'none' }}
                                />
                              </g>
                            ))}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Right Editor Tool Palette */}
                  <div className="editor-tool-palette">
                    <div className="palette-section-title">CALIBRATION TOOLS</div>
                    <button
                      type="button"
                      className={`tool-palette-btn ${activeEditorTool === 'draw' ? 'active' : ''}`}
                      onClick={() => setActiveEditorTool('draw')}
                      title="Select & Align Zones"
                    >
                      <Icon name="crop_free" size={16} />
                      <span>Select / Align</span>
                    </button>

                    <button
                      type="button"
                      className={`tool-palette-btn ${activeEditorTool === 'resize' ? 'active' : ''}`}
                      onClick={() => setActiveEditorTool('resize')}
                      title="Adjust Corner Handles"
                    >
                      <Icon name="straighten" size={16} />
                      <span>Corner Handles</span>
                    </button>

                    {/* Add Zone to Layout Button */}
                    <button
                      type="button"
                      className="btn-add-zone-tool"
                      onClick={handleAddZoneToLayout}
                      title="Add a new polygon zone to this room layout"
                    >
                      <Icon name="add_circle" size={16} color="#006934" />
                      <span>+ Add Zone to Room</span>
                    </button>

                    {/* Zone list with Assigned Relay dropdowns */}
                    <div className="palette-zones-container" style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div className="palette-section-title" style={{ margin: 0 }}>ZONES & ASSIGNED RELAYS</div>
                        {editorViewMode === '3d' && (
                          <button
                            type="button"
                            onClick={handleAlignAllZonesPillars}
                            title="Auto-align 3D ceiling pillars to floor footprints for all zones"
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              borderRadius: 4,
                              color: '#93C5FD',
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Icon name="auto_fix_high" size={12} color="#93C5FD" />
                            <span>Align All 3D</span>
                          </button>
                        )}
                      </div>
                      {currentLayout.zones.map((z) => {
                        const isSel = selectedZoneId === z.id;
                        return (
                          <div
                            key={z.id}
                            className={`palette-zone-item-card ${isSel ? 'selected' : ''}`}
                            onClick={() => setSelectedZoneId(z.id)}
                          >
                            <div className="zone-item-header">
                              <div className="zone-chip-title">
                                <span className="dot" style={{ backgroundColor: z.color, width: 9, height: 9, borderRadius: '50%' }} />
                                <span>{z.name}</span>
                                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>({z.points.length} nodes)</span>
                              </div>
                              {currentLayout.zones.length > 1 && (
                                <button
                                  type="button"
                                  className="btn-zone-del"
                                  title="Remove Zone"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveZoneFromLayout(z.id);
                                  }}
                                >
                                  <Icon name="close" size={13} color="#EF4444" />
                                </button>
                              )}
                            </div>

                            <div className="zone-relay-row">
                              <span className="zone-relay-label">Assigned Relay:</span>
                              <select
                                value={z.relay || z.num || 1}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleUpdateZoneRelay(z.id, Number(e.target.value));
                                }}
                                className="zone-relay-select"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value={1}>Relay 1 (GPIO 16)</option>
                                <option value={2}>Relay 2 (GPIO 17)</option>
                                <option value={3}>Relay 3 (GPIO 18)</option>
                                <option value={4}>Relay 4 (GPIO 19)</option>
                                <option value={5}>Relay 5 (Aux 5)</option>
                                <option value={6}>Relay 6 (Aux 6)</option>
                                <option value={7}>Relay 7 (Aux 7)</option>
                                <option value={8}>Relay 8 (Aux 8)</option>
                              </select>
                            </div>

                            {/* Corner Nodes Coordinates Inspector for Selected Zone */}
                            {isSel && (
                              <div style={{ marginTop: 8, padding: '7px 9px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>FLOOR NODES ({z.points.length})</span>
                                  <span style={{ color: '#00E676', fontSize: 9 }}>● Magnetic Snap On</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                                  {z.points.map((pt, pIdx) => (
                                    <div
                                      key={`floor-badge-${pIdx}`}
                                      style={{
                                        fontSize: 9,
                                        fontFamily: 'monospace',
                                        color: '#CBD5E1',
                                        background: 'rgba(0,0,0,0.3)',
                                        padding: '3px 6px',
                                        borderRadius: 4,
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                      }}
                                    >
                                      <span style={{ color: z.color, fontWeight: 700 }}>F{pIdx + 1}:</span>
                                      <span>[{pt[0].toFixed(2)}, {pt[1].toFixed(2)}]</span>
                                    </div>
                                  ))}
                                </div>

                                {editorViewMode === '3d' && (
                                  <>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginTop: 8, marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>3D CEILING CORNERS (◆)</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAlignZonePillars(z.id);
                                        }}
                                        title="Snap 3D ceiling corners directly vertically above floor base"
                                        style={{
                                          background: 'rgba(16, 185, 129, 0.15)',
                                          border: '1px solid rgba(16, 185, 129, 0.4)',
                                          borderRadius: 4,
                                          color: '#6EE7B7',
                                          fontSize: 9,
                                          fontWeight: 600,
                                          padding: '2px 5px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 3
                                        }}
                                      >
                                        <Icon name="vertical_align_top" size={11} color="#6EE7B7" />
                                        <span>Align Walls</span>
                                      </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                                      {(z.volumetric?.top && z.volumetric.top.length === z.points.length
                                        ? z.volumetric.top
                                        : z.points.map(([fx, fy]) => [fx, Math.max(0, fy - 0.15)] as Point)
                                      ).map((pt, pIdx) => (
                                        <div
                                          key={`top-badge-${pIdx}`}
                                          style={{
                                            fontSize: 9,
                                            fontFamily: 'monospace',
                                            color: '#93C5FD',
                                            background: 'rgba(30,58,138,0.25)',
                                            padding: '3px 6px',
                                            borderRadius: 4,
                                            display: 'flex',
                                            justifyContent: 'space-between'
                                          }}
                                        >
                                          <span style={{ color: '#60A5FA', fontWeight: 700 }}>C{pIdx + 1}:</span>
                                          <span>[{pt[0].toFixed(2)}, {pt[1].toFixed(2)}]</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Save Coordinates Button */}
                    <button
                      type="button"
                      className="btn-save-layout-coordinates"
                      onClick={handleSaveLayoutCoordinates}
                      disabled={isSavingLayout}
                      style={{ marginTop: 12 }}
                    >
                      <Icon name="check" size={15} color="#FFFFFF" />
                      <span>{isSavingLayout ? 'Saving...' : 'Save & Activate Layout'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB D: ADD DEVICES (Select Layout First, Then Zone) */}
        {activeTab === 'add_devices' && (
          <div className="tab-pane active-pane">
            <div className="page-header-block">
              <h1 className="page-title">Add Devices to Room Layout</h1>
              <p className="page-subtitle">Select the target layout first, then choose its available quadrants/zones</p>
            </div>

            <div className="add-device-centered-container">
              <div className="module-card add-devices-module-full">
                <form onSubmit={handleAddDeviceSubmit} className="add-device-form">
                  {/* Step 1: Select Layout First */}
                  <div className="form-group">
                    <label className="form-label step-indicator-label">
                      <span className="step-num-pill">1</span> SELECT TARGET LAYOUT FIRST
                    </label>
                    <select
                      value={addDeviceLayoutId}
                      onChange={e => {
                        setAddDeviceLayoutId(e.target.value);
                        setAddDeviceZoneNum(1);
                      }}
                      className="form-select-input highlighted-select"
                    >
                      {layouts.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.zones.length} Zones)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Show Zones for Selected Layout */}
                  <div className="form-group">
                    <label className="form-label step-indicator-label">
                      <span className="step-num-pill">2</span> CHOOSE ZONE / QUADRANT
                    </label>
                    <div className="zone-choice-chips">
                      {selectedAddDeviceLayout.zones.map(z => {
                        const isSelected = addDeviceZoneNum === z.num;
                        return (
                          <button
                            key={z.id}
                            type="button"
                            className={`zone-choice-chip ${isSelected ? 'selected' : ''}`}
                            style={{
                              borderColor: isSelected ? z.color : '#E5E7EB',
                              backgroundColor: isSelected ? `${z.color}22` : '#F9FAFB',
                            }}
                            onClick={() => {
                              setAddDeviceZoneNum(z.num);
                              const typeName = addDeviceType === 'lights' ? 'Light' : addDeviceType === 'fans' ? 'Fan' : 'AC';
                              setAddDeviceName(`${z.name} ${typeName}`);
                            }}
                          >
                            <span className="chip-dot" style={{ backgroundColor: z.color }} />
                            <span>{z.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Select Device Type */}
                  <div className="form-group">
                    <label className="form-label step-indicator-label">
                      <span className="step-num-pill">3</span> SELECT DEVICE TYPE
                    </label>
                    <div className="device-type-selector-grid">
                      {[
                        { id: 'lights', label: 'Light', icon: 'lightbulb' },
                        { id: 'fans', label: 'Fan', icon: 'mode_fan' },
                        { id: 'ac', label: 'AC Unit', icon: 'ac_unit' },
                        { id: 'other', label: 'Other', icon: 'bolt' },
                      ].map(type => {
                        const isSelected = addDeviceType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            className={`type-choice-card ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              setAddDeviceType(type.id as any);
                              const zoneName = `Zone ${addDeviceZoneNum}`;
                              setAddDeviceName(`${zoneName} ${type.label}`);
                            }}
                          >
                            <Icon name={type.icon} size={22} color={isSelected ? '#006934' : '#6B7280'} />
                            <span>{type.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 4: Device Details */}
                  <div className="form-row-2">
                    <div className="form-group flex-1">
                      <label className="form-label step-indicator-label">
                        <span className="step-num-pill">4</span> DEVICE NAME
                      </label>
                      <input
                        type="text"
                        value={addDeviceName}
                        onChange={e => setAddDeviceName(e.target.value)}
                        placeholder="e.g. Zone 1 Front Light"
                        className="form-text-input"
                        required
                      />
                    </div>

                    <div className="form-group flex-1">
                      <label className="form-label step-indicator-label">
                        ASSIGNED TARGET
                      </label>
                      <input
                        type="text"
                        value={`${selectedAddDeviceLayout.name} • Zone ${addDeviceZoneNum}`}
                        disabled
                        className="form-text-input disabled"
                      />
                    </div>
                  </div>

                  {addSuccessNotice && (
                    <div className="add-device-notice">
                      <Icon name="check_circle" size={18} color="#006934" />
                      <span>{addSuccessNotice}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-submit-add-device"
                    disabled={isSubmittingDevice}
                  >
                    {isSubmittingDevice ? 'Adding Device...' : 'Add Device to Room'}
                  </button>
                </form>

                {/* Currently Assigned Devices for Selected Layout */}
                <div className="current-layout-devices-table">
                  <h4>Devices in {selectedAddDeviceLayout.name}</h4>
                  <div className="device-cards-simple-grid">
                    {devices.filter(d => (d.quadrantNum && d.quadrantNum <= selectedAddDeviceLayout.zones.length) || (d.quadrants && d.quadrants.some(q => q <= selectedAddDeviceLayout.zones.length))).map(dev => (
                      <div key={dev.id} className="device-simple-chip">
                        <Icon name={dev.category === 'lights' ? 'lightbulb' : dev.category === 'fans' ? 'mode_fan' : 'ac_unit'} size={15} color="#006934" />
                        <span className="name">{dev.name}</span>
                        <span className="zone-tag">Zone {dev.quadrantNum || (dev.quadrants ? dev.quadrants.join(',') : '1')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* TAB F: DEVICES (Full inventory grid with category filters) */}
        {activeTab === 'devices' && (
          <div className="tab-pane active-pane">
            <div className="page-header-block">
              <h1 className="page-title">Devices Inventory</h1>
              <p className="page-subtitle">View and control all connected classroom lights, fans, and universal AC remotes</p>
            </div>

            {/* Category Filter Tabs */}
            <div className="device-filter-pills-row">
              {(['all', 'lights', 'fans', 'ac'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`device-filter-pill ${deviceFilter === cat ? 'active' : ''}`}
                  onClick={() => setDeviceFilter(cat)}
                >
                  {cat.toUpperCase()} ({devices.filter(d => cat === 'all' || d.category === cat).length})
                </button>
              ))}
            </div>

            {/* Devices Grid */}
            <div className="devices-full-grid">
              {filteredDevices.map(dev => (
                <div key={dev.id} className={`device-card-item ${dev.status === 'ON' ? 'is-on' : ''}`}>
                  <div className="device-card-header">
                    <div className="device-icon-wrapper">
                      <Icon
                        name={dev.category === 'lights' ? 'lightbulb' : dev.category === 'fans' ? 'mode_fan' : 'ac_unit'}
                        size={22}
                        color={dev.status === 'ON' ? '#006934' : '#6B7280'}
                      />
                    </div>
                    <button
                      type="button"
                      className={`device-toggle-btn ${dev.status === 'ON' ? 'on' : 'off'}`}
                      onClick={() => handleToggleSingleDevice(dev)}
                    >
                      {dev.status}
                    </button>
                  </div>

                  <div className="device-card-body">
                    <h4 className="device-card-name">{dev.name}</h4>
                    <div className="device-meta-badges">
                      <span className="meta-badge-zone">
                        {dev.quadrants && dev.quadrants.length > 1
                          ? `Zones ${dev.quadrants.join(', ')}`
                          : `Zone ${dev.quadrantNum || 1}`}
                      </span>
                      <span className="meta-badge-watts">{dev.powerWatts || 40}W</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* 3. MODAL: CREATE NEW LAYOUT */}
      {isNewLayoutModalOpen && (
        <div className="modal-backdrop-overlay">
          <div className="modal-dialog-box">
            <div className="modal-dialog-header">
              <h3>Create New Room Layout</h3>
              <button type="button" className="btn-modal-close" onClick={() => setIsNewLayoutModalOpen(false)}>
                <Icon name="close" size={20} color="#4B5563" />
              </button>
            </div>
            <div className="modal-dialog-body">
              <div className="form-group">
                <label className="form-label">LAYOUT NAME</label>
                <input
                  type="text"
                  value={newLayoutName}
                  onChange={e => setNewLayoutName(e.target.value)}
                  placeholder="e.g. Science Lab Layout"
                  className="form-text-input"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">NUMBER OF ZONES</label>
                <div className="stepper-count-row">
                  {[2, 3, 4, 6].map(count => (
                    <button
                      key={count}
                      type="button"
                      className={`btn-count-chip ${newLayoutZonesCount === count ? 'active' : ''}`}
                      onClick={() => setNewLayoutZonesCount(count)}
                    >
                      {count} Zones
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-dialog-footer">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsNewLayoutModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-modal-primary" onClick={handleCreateNewLayout}>
                Save & Initialize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL: AI AUTO-MAPPING */}
      {isAiModalOpen && (
        <div className="modal-backdrop-overlay">
          <div className="modal-dialog-box">
            <div className="modal-dialog-header">
              <div className="row-align">
                <Icon name="auto_awesome" size={20} color="#006934" />
                <h3 style={{ marginLeft: 8 }}>AI Room Auto-Mapping</h3>
              </div>
              <button type="button" className="btn-modal-close" onClick={() => setIsAiModalOpen(false)}>
                <Icon name="close" size={20} color="#4B5563" />
              </button>
            </div>
            <div className="modal-dialog-body">
              <p className="ai-modal-desc">
                SEROS AI vision scans the current camera frame and generates 3D perspective zone coordinates
                tailored to your fixture placements.
              </p>

              <div className="form-group">
                <label className="form-label">NUMBER OF ROOM QUADRANTS / ZONES</label>
                <div className="stepper-count-row">
                  {[
                    { count: 2, label: '2 Zones' },
                    { count: 3, label: '3 Zones' },
                    { count: 4, label: '4 Zones (Default)' },
                    { count: 6, label: '6 Zones (2x3)' },
                    { count: 8, label: '8 Zones (2x4)' },
                  ].map(item => (
                    <button
                      key={item.count}
                      type="button"
                      className={`btn-count-chip ${aiNumZones === item.count ? 'active' : ''}`}
                      onClick={() => setAiNumZones(item.count)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">NUMBER OF LIGHTS IN ROOM</label>
                <div className="stepper-count-row">
                  {[1, 2, 4, 6, 8].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`btn-count-chip ${aiNumLights === n ? 'active' : ''}`}
                      onClick={() => setAiNumLights(n)}
                    >
                      {n} {n === 1 ? 'Light' : 'Lights'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">NUMBER OF FANS</label>
                <div className="stepper-count-row">
                  {[0, 1, 2, 4, 6].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`btn-count-chip ${aiNumFans === n ? 'active' : ''}`}
                      onClick={() => setAiNumFans(n)}
                    >
                      {n === 0 ? 'No Fans' : `${n} Fans`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">AIR CONDITIONER UNITS</label>
                <div className="stepper-count-row">
                  {[0, 1, 2, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`btn-count-chip ${aiNumAcs === n ? 'active' : ''}`}
                      onClick={() => setAiNumAcs(n)}
                    >
                      {n === 0 ? 'None' : `${n} AC`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">EQUIPMENT LOCATION & PLACEMENT STRATEGY</label>
                <div className="stepper-count-row">
                  {[
                    { id: 'quadrant', label: 'Quadrant-Distributed' },
                    { id: 'perimeter', label: 'Perimeter Walls' },
                    { id: 'front_loaded', label: 'Front-Loaded Focus' },
                    { id: 'uniform', label: 'Uniform Grid' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`btn-count-chip ${aiEquipmentPlacement === opt.id ? 'active' : ''}`}
                      onClick={() => setAiEquipmentPlacement(opt.id as any)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {aiNotice && (
                <div className="ai-feedback-banner">
                  <Icon name="check_circle" size={16} color="#006934" />
                  <span>{aiNotice}</span>
                </div>
              )}
            </div>

            <div className="modal-dialog-footer">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsAiModalOpen(false)} disabled={isAiMapping}>
                Cancel
              </button>
              <button type="button" className="btn-modal-primary" onClick={handleRunAiAutoMap} disabled={isAiMapping}>
                {isAiMapping ? 'AI Processing Frame...' : 'Generate 3D Layout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
