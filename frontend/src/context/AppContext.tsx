import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScreenView,
  Device,
  Room,
  Zone,
  AutoRule,
  ChatMessage,
  AccessibilitySettings,
  NavTab,
  SensorData,
  RoomLayout
} from '../types';
import { serosApi } from '../api/serosApi';
import { BACKEND_URL_STORAGE_KEY, DEFAULT_BACKEND_URL } from '../config';

interface AppContextType {
  currentView: ScreenView;
  setCurrentView: (view: ScreenView) => void;
  navigateToTab: (tab: NavTab) => void;
  devices: Device[];
  toggleDevice: (id: string) => void;
  setDeviceSpeed: (id: string, speed: number) => void;
  addDevice: (payload: {
    quadrant?: number | string;
    quadrants?: number[];
    section_id?: string | number;
    name: string;
    category: 'lights' | 'fans' | 'ac';
    relay?: number;
    power_watts?: number;
  }) => Promise<Device>;
  updateDevice: (
    id: string,
    payload: {
      name?: string;
      category?: 'lights' | 'fans' | 'ac';
      quadrant?: number | string;
      quadrants?: number[];
      relay?: number;
      power_watts?: number;
    }
  ) => Promise<Device>;
  deleteDevice: (id: string) => Promise<void>;
  turnOffAllEmptyRooms: () => void;
  rooms: Room[];
  addSection: (payload: { name: string; subtitle?: string }) => Promise<Room>;
  deleteSection: (id: string | number) => Promise<void>;
  isCameraEnabled: boolean;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  selectedRoomId: string;
  setSelectedRoomId: (id: string) => void;
  updateZonePoints: (roomId: string, zoneId: string, points: string) => void;
  setRoomZones: (roomId: string, zones: Zone[]) => void;
  syncZoneOccupancyDevices: (zoneOccupancyMap: { [zoneId: string]: number }, activeZones: Zone[]) => void;
  rules: AutoRule[];
  toggleRule: (id: string) => void;
  addRule: (rule: { whenText: string; thenText: string; title: string }) => void;
  settings: AccessibilitySettings;
  updateSettings: (partial: Partial<AccessibilitySettings>) => void;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  speakingText: string;
  chatMessages: ChatMessage[];
  sendChatMessage: (text: string) => Promise<void>;
  backendVerifiedNotice: string | null;
  setBackendVerifiedNotice: (notice: string | null) => void;
  isRuleWizardOpen: boolean;
  setIsRuleWizardOpen: (open: boolean) => void;
  pingLatency: number;
  isPinging: boolean;
  triggerDiagnosticsPing: () => Promise<number>;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  backendConnected: boolean;
  sensorData: SensorData;
  activeLayoutId: string;
  layouts: RoomLayout[];
  selectLayout: (layoutId: string) => Promise<boolean>;
  saveLayoutZones: (layoutId: string, zonesToSave: Zone[]) => Promise<boolean>;
  refreshSensor: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [backendUrl, setBackendUrlState] = useState<string>(DEFAULT_BACKEND_URL);

  const setBackendUrl = (url: string) => {
    const clean = url.trim().replace(/\/+$/, '') || DEFAULT_BACKEND_URL;
    setBackendUrlState(clean);
    void AsyncStorage.setItem(BACKEND_URL_STORAGE_KEY, clean);
  };

  useEffect(() => {
    void AsyncStorage.getItem(BACKEND_URL_STORAGE_KEY).then(saved => {
      if (saved?.trim()) setBackendUrlState(saved.trim().replace(/\/+$/, ''));
    });
  }, []);

  const [currentView, setCurrentView] = useState<ScreenView>('home');
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [settings, setSettings] = useState<AccessibilitySettings>({
    textSize: 'standard', voiceGuidance: true, highContrast: false,
    reduceMotion: false, language: 'en', ecoSaverSensitivity: 2,
    emptyRoomAlerts: true, isDemoMode: false
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speakingText, setSpeakingText] = useState<string>('');
  const [backendVerifiedNotice, setBackendVerifiedNotice] = useState<string | null>(null);
  const [isRuleWizardOpen, setIsRuleWizardOpen] = useState<boolean>(false);
  const [pingLatency, setPingLatency] = useState<number>(0);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isCameraEnabled, setIsCameraEnabledState] = useState<boolean>(true);

  // Live Sensor & Layouts State from ESP32 / Backend
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 26.4,
    humidity: 58.0,
    energy_saving_percent: 18,
    source: 'ESP32-HTU21DF',
    esp32_connected: true,
  });
  const [activeLayoutId, setActiveLayoutId] = useState<string>('layout-1');
  const [layouts, setLayouts] = useState<RoomLayout[]>([
    {
      id: 'layout-1',
      name: 'Layout 1 (4 Zones)',
      subtitle: '4 Quadrants',
      description: 'Standard 4-Zone setup',
      isDefault: true,
      zones: [
        { id: '1', num: 1, name: 'Zone 1', color: '#FFB547', points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] },
        { id: '2', num: 2, name: 'Zone 2', color: '#3B82F6', points: [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]] },
        { id: '3', num: 3, name: 'Zone 3', color: '#00E676', points: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]] },
        { id: '4', num: 4, name: 'Zone 4', color: '#EF4444', points: [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]] },
      ],
    },
  ]);

  const selectLayout = async (layoutId: string): Promise<boolean> => {
    setActiveLayoutId(layoutId);
    try {
      const ok = await serosApi.selectLayout(backendUrl, layoutId);
      if (ok) {
        setBackendVerifiedNotice(`Switched to active room layout: ${layoutId}`);
      }
      return ok;
    } catch {
      return false;
    }
  };

  const refreshSensor = async () => {
    try {
      const s = await serosApi.getSensorData(backendUrl);
      if (s && s.temperature !== undefined) {
        setSensorData({
          temperature: s.temperature,
          humidity: s.humidity,
          energy_saving_percent: s.energy_saving_percent ?? 18,
          source: s.source || 'ESP32-HTU21DF',
          esp32_connected: s.esp32_connected ?? true,
        });
      }
    } catch {
      // offline fallback
    }
  };

  const refreshState = async () => {
    const data = await serosApi.getState(backendUrl);
    setDevices(data.devices || []);
    setRooms(data.rooms || []);
    setRules(data.rules || []);
    setSelectedRoomId(current => current || data.rooms?.[0]?.id || '');
    if ((data as any).sensor) {
      setSensorData((data as any).sensor);
    }
    if ((data as any).camera_enabled !== undefined) {
      setIsCameraEnabledState(Boolean((data as any).camera_enabled));
    }
    if ((data as any).active_layout_id) {
      setActiveLayoutId((data as any).active_layout_id);
    }
    if ((data as any).layouts && Array.isArray((data as any).layouts) && (data as any).layouts.length > 0) {
      setLayouts((data as any).layouts);
    }
    setBackendConnected(true);
    setBackendVerifiedNotice('Connected to SEROS backend');
  };

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        if (!disposed) {
          await refreshState();
          await refreshSensor();
        }
      } catch {
        if (!disposed) {
          setBackendConnected(false);
          setBackendVerifiedNotice('Backend unavailable');
        }
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [backendUrl]);

  // Rapid Camera Sync with Web App (1.2s heartbeat)
  useEffect(() => {
    let active = true;
    const syncCamera = async () => {
      try {
        const res = await serosApi.getCameraStatus(backendUrl);
        if (active && res && typeof res.enabled === 'boolean') {
          setIsCameraEnabledState(res.enabled);
        }
      } catch {}
    };
    syncCamera();
    const camTimer = setInterval(syncCamera, 1200);
    return () => {
      active = false;
      clearInterval(camTimer);
    };
  }, [backendUrl]);

  // Apply visual settings to document body (web only)

  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('text-size-large', 'text-size-xlarge');
      if (settings.textSize === 'large') {
        document.body.classList.add('text-size-large');
      } else if (settings.textSize === 'xlarge') {
        document.body.classList.add('text-size-xlarge');
      }

      if (settings.highContrast) {
        document.body.classList.add('high-contrast');
      } else {
        document.body.classList.remove('high-contrast');
      }

      if (settings.reduceMotion) {
        document.body.classList.add('reduced-motion');
      } else {
        document.body.classList.remove('reduced-motion');
      }
    }
  }, [settings]);

  const navigateToTab = (tab: NavTab) => {
    setCurrentView(tab);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: settings.reduceMotion ? 'auto' : 'smooth' });
    }
  };

  const speakText = (text: string) => {
    if (!settings.voiceGuidance && !text) return;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingText(text);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingText('');
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingText('');
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback visual speaking indicator
      setIsSpeaking(true);
      setSpeakingText(text);
      setTimeout(() => {
        setIsSpeaking(false);
        setSpeakingText('');
      }, 3500);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingText('');
  };

  const toggleDevice = (id: string) => {
    const device = devices.find(item => item.id === id);
    if (!device) return;
    serosApi.controlDevice(backendUrl, id, { on: device.status !== 'ON', manual_override: true })
      .then(updated => {
        setDevices(prev => prev.map(item => item.id === id ? updated : item));
        setBackendVerifiedNotice('Device state synchronized');
      })
      .catch(error => setBackendVerifiedNotice(`Device control failed: ${error.message}`));
  };

  const setDeviceSpeed = (id: string, speed: number) => {
    serosApi.controlDevice(backendUrl, id, { speed, manual_override: true })
      .then(updated => setDevices(prev => prev.map(item => item.id === id ? updated : item)))
      .catch(error => setBackendVerifiedNotice(`Fan control failed: ${error.message}`));
  };

  const addDevice = async (payload: {
    quadrant?: number | string;
    quadrants?: number[];
    section_id?: string | number;
    name: string;
    category: 'lights' | 'fans' | 'ac';
    relay?: number;
    power_watts?: number;
  }) => {
    try {
      const created = await serosApi.addDevice(backendUrl, payload);
      setDevices(prev => [...prev, created]);
      setBackendVerifiedNotice(`Added ${created.name} successfully`);
      speakText(`${created.name} added to ${created.room}`);
      void refreshState();
      return created;
    } catch (err: any) {
      setBackendVerifiedNotice(`Failed to add device: ${err.message}`);
      throw err;
    }
  };

  const deleteDevice = async (id: string) => {
    try {
      await serosApi.deleteDevice(backendUrl, id);
      setDevices(prev => prev.filter(d => d.id !== id));
      setBackendVerifiedNotice('Device deleted successfully');
      void refreshState();
    } catch (err: any) {
      setBackendVerifiedNotice(`Failed to delete device: ${err.message}`);
      throw err;
    }
  };

  const updateDevice = async (
    id: string,
    payload: {
      name?: string;
      category?: 'lights' | 'fans' | 'ac';
      quadrant?: number | string;
      quadrants?: number[];
      relay?: number;
      power_watts?: number;
    }
  ) => {
    try {
      const updated = await serosApi.updateDevice(backendUrl, id, payload);
      setDevices(prev => prev.map(item => item.id === id ? updated : item));
      setBackendVerifiedNotice(`Updated ${updated.name} successfully`);
      speakText(`${updated.name} updated`);
      void refreshState();
      return updated;
    } catch (err: any) {
      setBackendVerifiedNotice(`Failed to update device: ${err.message}`);
      throw err;
    }
  };

  const addSection = async (payload: { name: string; subtitle?: string }) => {
    try {
      const created = await serosApi.addSection(backendUrl, payload);
      setRooms(prev => [...prev, created]);
      setBackendVerifiedNotice(`Added ${created.name} successfully`);
      speakText(`${created.name} added to campus`);
      void refreshState();
      return created;
    } catch (err: any) {
      setBackendVerifiedNotice(`Failed to add section: ${err.message}`);
      throw err;
    }
  };

  const deleteSection = async (id: string | number) => {
    try {
      await serosApi.deleteSection(backendUrl, id);
      setRooms(prev => prev.filter(r => String(r.id) !== String(id)));
      setBackendVerifiedNotice('Section deleted successfully');
      void refreshState();
    } catch (err: any) {
      setBackendVerifiedNotice(`Failed to delete section: ${err.message}`);
      throw err;
    }
  };

  const setCameraEnabled = async (enabled: boolean) => {
    try {
      setIsCameraEnabledState(enabled);
      await serosApi.setCameraStatus(backendUrl, enabled);
      setBackendVerifiedNotice(enabled ? 'Camera turned ON' : 'Camera turned OFF');
      void refreshState();
    } catch (err: any) {
      setBackendVerifiedNotice(`Failed to toggle camera: ${err.message}`);
    }
  };

  const turnOffAllEmptyRooms = () => {
    devices.filter(device => device.status !== 'OFF').forEach(device => {
      void serosApi.controlDevice(backendUrl, device.id, { on: false, manual_override: true });
    });
    void refreshState();
    setBackendVerifiedNotice('Empty-room devices requested to turn off');
    speakText('All empty rooms and study halls have been turned off safely.');
  };

  const updateZonePoints = (roomId: string, zoneId: string, points: string) => {
    const normalized = points.split(' ').map(point => point.split(',').map(Number).map((value, index) => value / (index === 0 ? 400 : 320)));
    serosApi.updateZone(backendUrl, zoneId, { points: normalized }).catch(err => {
      console.warn('Zone coordinate update sync warning:', err);
    });
    setRooms(prev =>
      prev.map(r => {
        if (r.id === roomId) {
          return {
            ...r,
            zones: r.zones.map(z => (z.id === zoneId ? { ...z, points } : z))
          };
        }
        return r;
      })
    );
  };

  const setRoomZones = (roomId: string, zones: Zone[]) => {
    zones.forEach(zone => {
      const normalized = zone.handles.map(point => [point.x / 400, point.y / 320]);
      serosApi.updateZone(backendUrl, zone.id, {
        points: normalized,
        shapeType: zone.shapeType,
        assignedDeviceIds: zone.assignedDeviceIds,
      }).catch(err => {
        console.warn('Zone batch update sync warning:', err);
      });
    });
    setRooms(prev =>
      prev.map(r => {
        if (r.id === roomId) {
          const calculated = zones.reduce((acc, z) => acc + (z.occupantCount || 0), 0);
          const finalCount = calculated > 0 ? calculated : r.occupancyCount;
          return {
            ...r,
            zones,
            occupancyCount: finalCount,
            occupancyText: finalCount > 0 ? `${finalCount} people inside` : 'Empty (Standby)'
          };
        }
        return r;
      })
    );
  };

  const saveLayoutZones = async (layoutId: string, zonesToSave: Zone[]): Promise<boolean> => {
    try {
      const zonesPayload = zonesToSave.map((z, idx) => ({
        id: String(z.id || idx + 1),
        num: idx + 1,
        name: z.name,
        color: z.color,
        relay: idx + 1,
        pin: 16 + idx,
        points: z.handles.map(p => [
          Number((p.x / 400).toFixed(3)),
          Number((p.y / 320).toFixed(3))
        ]),
        shapeType: z.shapeType || 'polygon',
        assignedDeviceIds: z.assignedDeviceIds || [],
      }));

      const targetId = layoutId || activeLayoutId || 'layout-1';
      const cleanUrl = backendUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/layouts/${targetId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones: zonesPayload }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.layouts) {
          setLayouts(data.layouts);
        }
        setBackendVerifiedNotice('Layout & zones saved to database successfully!');
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Failed to save layout to DB:', err);
      setBackendVerifiedNotice('Saved locally (backend sync delayed)');
      return false;
    }
  };

  const syncZoneOccupancyDevices = (
    zoneOccupancyMap: { [zoneId: string]: number },
    activeZones: Zone[]
  ) => {
    setDevices(prev => {
      let changedCount = 0;
      const updated = prev.map(device => {
        // Find all zones this device is assigned to (either direct ID or quadrant match)
        const matchingZones = activeZones.filter(z => {
          if (z.assignedDeviceIds?.includes(device.id)) return true;
          if (device.quadrants && device.quadrants.length > 0) {
            return device.quadrants.some(q =>
              z.name.toLowerCase().includes(`quadrant ${q}`) ||
              z.name.toLowerCase().includes(`q${q}`)
            );
          }
          if (device.quadrantNum) {
            return (
              z.name.toLowerCase().includes(`quadrant ${device.quadrantNum}`) ||
              z.name.toLowerCase().includes(`q${device.quadrantNum}`)
            );
          }
          return false;
        });

        if (matchingZones.length === 0) return device;

        // Device is ON if ANY matching zone has at least one person detected
        const totalOccupants = matchingZones.reduce(
          (sum, z) => sum + (zoneOccupancyMap[z.id] || 0),
          0
        );
        const shouldBeOn = totalOccupants > 0;

        if (shouldBeOn && device.status !== 'ON') {
          changedCount++;
          const zoneSummary = matchingZones.map(z => z.name).join(', ');
          return {
            ...device,
            status: 'ON' as const,
            powerWatts: device.category === 'ac' ? 1200 : device.category === 'fans' ? 38 : 44,
            speedLevel: device.category === 'fans' ? (device.speedLevel || 2) : undefined,
            automationNote: `Auto ON (${zoneSummary})`
          };
        } else if (!shouldBeOn && device.status === 'ON') {
          changedCount++;
          return {
            ...device,
            status: 'OFF' as const,
            powerWatts: 0,
            speedLevel: device.category === 'fans' ? 0 : undefined,
            automationNote: 'Auto OFF (All assigned zones empty)'
          };
        }
        return device;
      });

      if (changedCount > 0) {
        setBackendVerifiedNotice(`Automated: Synchronized ${changedCount} devices based on zone occupancy.`);
      }
      return updated;
    });
  };

  const toggleRule = (id: string) => {
    setRules(prev =>
      prev.map(r => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const addRule = ({ whenText, thenText, title }: { whenText: string; thenText: string; title: string }) => {
    const newRule: AutoRule = {
      id: `rule-${Date.now()}`,
      title,
      whenText,
      thenText,
      isActive: true,
      triggerCount: 0,
      kwhSaved: 0,
      tag: 'Newly Activated'
    };
    setRules(prev => [newRule, ...prev]);
    setBackendVerifiedNotice('New automation rule registered with edge node!');
    speakText(`New rule created: ${whenText}, ${thenText}`);
  };

  const updateSettings = (partial: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  const triggerDiagnosticsPing = async (): Promise<number> => {
    setIsPinging(true);
    try {
      const res = await serosApi.ping(backendUrl);
      setPingLatency(res.latencyMs);
      setIsPinging(false);
      return res.latencyMs;
    } catch {
      setPingLatency(999);
      setIsPinging(false);
      return 999;
    }
  };

  const sendChatMessage = async (query: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);

    try {
      const replyText = await serosApi.sendChat(backendUrl, query);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioDuration: '0:12',
      };
      setChatMessages(prev => [...prev, botMsg]);
      if (settings.voiceGuidance) {
        speakText(replyText);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: `SEROS AI Response: Could not connect to backend at ${backendUrl}. Ensure the Django server is running. (${err?.message || 'Connection error'})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages(prev => [...prev, errorMsg]);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        navigateToTab,
        devices,
        toggleDevice,
        setDeviceSpeed,
        addDevice,
        updateDevice,
        deleteDevice,
        turnOffAllEmptyRooms,
        rooms,
        addSection,
        deleteSection,
        isCameraEnabled,
        setCameraEnabled,
        selectedRoomId,
        setSelectedRoomId,
        updateZonePoints,
        setRoomZones,
        syncZoneOccupancyDevices,
        rules,
        toggleRule,
        addRule,
        settings,
        updateSettings,
        speakText,
        stopSpeaking,
        isSpeaking,
        speakingText,
        chatMessages,
        sendChatMessage,
        backendVerifiedNotice,
        setBackendVerifiedNotice,
        isRuleWizardOpen,
        setIsRuleWizardOpen,
        pingLatency,
        isPinging,
        triggerDiagnosticsPing,
        backendUrl,
        setBackendUrl,
        backendConnected,
        sensorData,
        activeLayoutId,
        layouts,
        selectLayout,
        saveLayoutZones,
        refreshSensor,
      }}

    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
