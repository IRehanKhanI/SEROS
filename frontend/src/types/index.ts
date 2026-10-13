export type NavTab = 'home' | 'rooms' | 'energy' | 'devices' | 'more';
export type ScreenView = NavTab | 'assistant' | 'settings' | 'onboarding';

export interface Device {
  id: string;
  name: string;
  room: string;
  roomId?: string;
  quadrant?: string;
  quadrantId?: string;
  quadrantNum?: number;
  relay?: number;
  category: 'lights' | 'fans' | 'ac';
  status: 'ON' | 'OFF' | 'Standby';
  speedLevel?: number; // 0, 1, 2, 3
  brightness?: number; // 0 - 100
  powerWatts: number;
  isAutomated: boolean;
  automationNote?: string;
  zoneId?: string;
  temperature?: number;
  targetTemperature?: number;
}

export interface DetectedPerson {
  id: string;
  x: number; // 0 - 400
  y: number; // 0 - 320
  width: number;
  height: number;
  confidence: number;
  label: string;
}

export interface Zone {
  id: string;
  name: string;
  statusText: string;
  isOccupied: boolean;
  occupantCount: number;
  color: string;
  points: string;
  handles: { x: number; y: number }[];
  assignedDeviceIds: string[];
  shapeType?: 'polygon' | 'rectangle' | 'curved';
}

export interface Room {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  occupancyCount: number;
  occupancyText: string;
  fansStatus: string;
  lightsStatus: string;
  timerNote?: string;
  icon: string;
  cameras: {
    id: string;
    label: string;
    url: string;
    status: 'Live' | 'Standby' | 'Connecting';
  }[];
  zones: Zone[];
  latestFrame?: string;
  latestBoxes?: { x1: number; y1: number; x2: number; y2: number; confidence: number; label?: string }[];
  lastUpdated?: string;
}

export interface AutoRule {
  id: string;
  title: string;
  whenText: string;
  thenText: string;
  isActive: boolean;
  triggerCount: number;
  kwhSaved: number;
  tag: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  audioDuration?: string;
  chipData?: {
    spentRupees?: number;
    devicesText?: string;
    emptyTime?: string;
  };
  actionBtn?: {
    text: string;
    targetTab?: NavTab;
    targetScreen?: ScreenView;
  };
}

export interface AccessibilitySettings {
  textSize: 'standard' | 'large' | 'xlarge';
  voiceGuidance: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  language: 'en' | 'hi' | 'ta' | 'bn';
  ecoSaverSensitivity: 1 | 2 | 3; // 1 = 15m, 2 = 10m, 3 = 5m
  emptyRoomAlerts: boolean;
  isDemoMode: boolean;
}
