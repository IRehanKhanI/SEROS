/**
 * SEROS Live Backend API Service Client
 * Directly connects to Django Backend endpoints.
 */

export interface WeatherData {
  temperature: number;
  humidity: number;
  error?: string;
}

export interface GreetingData {
  status: string;
  greeting: string;
}

export interface DeviceBreakdownItem {
  name: string;
  kwh: number;
  source: string;
  watts?: number;
}

export interface ActiveDeviceItem {
  name: string;
  power_watts: number;
  source: string;
}

export interface AnalyticsData {
  status: string;
  active_devices: ActiveDeviceItem[];
  live_power_draw_watts: number;
  total_kwh_consumed: number;
  total_cost_rs: number;
  rs_saved: number;
  hours_unused: number;
  device_breakdown: DeviceBreakdownItem[];
  daily_kwh: number[];
  hist_total_kwh: number;
  data_sources?: {
    live: string;
    baseline: string;
    kaggle: string;
  };
}

export interface DailyUsageItem {
  date: string;
  kwh: number;
  avg_temp: number;
  avg_humidity: number;
  avg_occupancy: number;
}

export interface HistoricalUsageData {
  status: string;
  days: number;
  total_kwh: number;
  data: DailyUsageItem[];
}

export interface PredictionDay {
  day_index: number;
  date: string;
  day_name: string;
  predicted_kwh: number;
  estimated_cost: number;
}

export interface MlPredictData {
  status: string;
  model: string;
  predictions: PredictionDay[];
  total_kwh: number;
  total_cost: number;
}

export interface PersonCoord {
  x: number;
  y: number;
}

export interface OccupancyDetectionResult {
  status: string;
  people: number;
  position: 'left' | 'right' | 'both' | '-';
  fan_left: boolean;
  fan_right: boolean;
  fan_speed: number;
  persons: PersonCoord[];
  img_shape?: string;
  error?: string;
  boxes?: { x1: number; y1: number; x2: number; y2: number; confidence: number }[];
  processed_frame?: string;
}

export interface CameraDevice {
  id: number | string;
  name: string;
  deviceId?: string;
}

export interface CamerasResponse {
  status: string;
  cameras: CameraDevice[];
  current_index?: number;
}

export const serosApi = {
  async getState(baseUrl: string) {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/state/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async controlDevice(baseUrl: string, deviceId: string, payload: { on?: boolean; speed?: number; manual_override?: boolean }) {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/devices/${encodeURIComponent(deviceId)}/control/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.device;
  },

  async addDevice(
    baseUrl: string,
    payload: { quadrant?: number | string; section_id?: string | number; name: string; category: 'lights' | 'fans' | 'ac'; relay?: number; power_watts?: number }
  ) {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/devices/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.device;
  },

  async updateDevice(
    baseUrl: string,
    deviceId: string,
    payload: { name?: string; category?: 'lights' | 'fans' | 'ac'; quadrant?: number | string; relay?: number; power_watts?: number }
  ) {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/devices/${encodeURIComponent(deviceId)}/update/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.device;
  },

  async deleteDevice(baseUrl: string, deviceId: string) {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/devices/${encodeURIComponent(deviceId)}/`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  async updateZone(baseUrl: string, zoneId: string, payload: { points: number[][]; shapeType?: string; assignedDeviceIds?: string[] }) {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/zones/${zoneId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.zone;
  },
  // 1. Health check & latency test
  async ping(baseUrl: string): Promise<{ ok: boolean; latencyMs: number; statusText: string }> {
    const start = Date.now();
    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/ping/`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { ok: true, latencyMs, statusText: 'Online (200 OK)' };
      }
      return { ok: false, latencyMs, statusText: `HTTP ${res.status}` };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        statusText: err?.message || 'Network unreachable',
      };
    }
  },

  // 2. Smart greeting (Gemini 3 Flash)
  async getGreeting(baseUrl: string): Promise<string> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/greeting/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: GreetingData = await res.json();
    return data.greeting;
  },

  // 3. Current weather & humidity
  async getWeather(baseUrl: string): Promise<WeatherData> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/weather/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 4. Live energy analytics & active devices
  async getAnalytics(baseUrl: string): Promise<AnalyticsData> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/analytics/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 5. Historical 30-day usage dataset
  async getHistoricalUsage(baseUrl: string): Promise<HistoricalUsageData> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/historical-usage/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 6. ML energy predictions (Random Forest)
  async getMlPredict(baseUrl: string, temperature = 32.0): Promise<MlPredictData> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/ml-predict/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 7. AI Assistant Chat
  async sendChat(baseUrl: string, prompt: string): Promise<string> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/generate-chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'success') {
      return data.response;
    }
    throw new Error(data.message || 'Chat generation failed');
  },

  // 8. Real-time YOLO Occupancy Detection
  async detectOccupancy(baseUrl: string, imageBase64: string, sectionId?: string): Promise<OccupancyDetectionResult> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/detect/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, section_id: sectionId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 9. Laptop Camera Device enumeration from backend
  async getCameras(baseUrl: string): Promise<CamerasResponse> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/cameras/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 10. Select active camera on backend
  async selectCamera(baseUrl: string, cameraIndex: number): Promise<boolean> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/cameras/select/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: cameraIndex }),
    });
    return res.ok;
  },

  // 11. Fetch latest processed YOLO frame and occupancy from backend
  async getLatestCameraFrame(baseUrl: string, sectionId?: string): Promise<{
    status: string;
    section_id: number;
    people: number;
    boxes: { x1: number; y1: number; x2: number; y2: number; confidence: number; label?: string }[];
    frame: string | null;
    timestamp?: string;
  }> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/camera/latest/?section_id=${encodeURIComponent(sectionId || '1')}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 12. Camera toggle status
  async getCameraStatus(baseUrl: string): Promise<{ status: string; enabled: boolean }> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/camera/status/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async setCameraStatus(baseUrl: string, enabled: boolean): Promise<{ status: string; enabled: boolean }> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/camera/status/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // 13. Add Section / Room
  async addSection(baseUrl: string, payload: { name: string; subtitle?: string; camera_url?: string }) {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/sections/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.section;
  },

  // 14. Delete Section / Room
  async deleteSection(baseUrl: string, sectionId: string | number) {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/sections/${encodeURIComponent(String(sectionId))}/`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },
};
