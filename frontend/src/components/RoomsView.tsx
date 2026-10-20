import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, Image } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  G,
  Line,
  Circle,
  Polygon,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { Zone, DetectedPerson, Room } from '../types';
import { Icon } from './Icon';
import { colors } from '../theme/colors';
import { serosApi } from '../api/serosApi';

interface Point {
  x: number;
  y: number;
}

const COLOR_PALETTE = [
  { name: 'Amber', hex: '#FFB547', bgGrad: ['#FFB547', '#FF9800'] },
  { name: 'Forest', hex: '#27834A', bgGrad: ['#27834A', '#80d997'] },
  { name: 'Ocean', hex: '#1e6585', bgGrad: ['#1e6585', '#9cd9ff'] },
  { name: 'Purple', hex: '#7e22ce', bgGrad: ['#7e22ce', '#c084fc'] },
  { name: 'Coral', hex: '#ea580c', bgGrad: ['#ea580c', '#fdba74'] },
  { name: 'Teal', hex: '#0d9488', bgGrad: ['#0d9488', '#5eead4'] },
];

export const RoomsView: React.FC = () => {
  const {
    rooms,
    selectedRoomId,
    setSelectedRoomId,
    devices,
    toggleDevice,
    speakText,
    setBackendVerifiedNotice,
    setRoomZones,
    syncZoneOccupancyDevices,
    backendUrl,
    isCameraEnabled,
    setCameraEnabled,
    sensorData,
    activeLayoutId,
    layouts,
    selectLayout,
    saveLayoutZones,
  } = useApp();


  const selectedRoom: Room = rooms.find((r) => r.id === selectedRoomId) || rooms[0] || {
    id: '', name: 'Loading sections', subtitle: '', category: '', occupancyCount: 0,
    occupancyText: 'Loading', fansStatus: 'OFF', lightsStatus: 'OFF', icon: 'meeting_room',
    cameras: [], zones: [],
  };

  const cameraOptions = (selectedRoom?.cameras || []).map(camera => ({
    ...camera,
    note: 'Backend-configured camera',
  }));

  const [activeCamIndex, setActiveCamIndex] = useState<number>(0);
  const activeCamera = cameraOptions[activeCamIndex];

  const [captureInterval, setCaptureInterval] = useState<3 | 5 | 10>(3);
  const [mirrorCamera, setMirrorCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(isCameraEnabled);

  useEffect(() => {
    setIsCameraActive(isCameraEnabled);
    if (!isCameraEnabled) {
      setProcessedFrame('');
      setDetectedPersons([]);
    }
  }, [isCameraEnabled]);

  const handleToggleCamera = () => {
    const next = !isCameraActive;
    setIsCameraActive(next);
    if (!next) {
      setProcessedFrame('');
      setDetectedPersons([]);
    }
    void setCameraEnabled(next);
    setBackendVerifiedNotice(next ? 'Laptop room camera feed activated.' : 'Laptop room camera feed turned off.');
    speakText(next ? 'Laptop camera turned on.' : 'Laptop camera turned off.');
  };
  // Kept in move mode for the read-only camera canvas; mobile zone editing is disabled.
  const [editorMode, setEditorMode] = useState<'move' | 'draw_rect' | 'draw_poly' | 'draw_curve' | 'split'>('move');

  // Zones State & Undo/Redo Stacks
  const [zones, setZones] = useState<Zone[]>(() => selectedRoom.zones || []);

  const [undoStack, setUndoStack] = useState<Zone[][]>([]);
  const [redoStack, setRedoStack] = useState<Zone[][]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');

  // Persons Simulation / YOLO Detections
  const [detectedPersons, setDetectedPersons] = useState<DetectedPerson[]>([]);
  const [processedFrame, setProcessedFrame] = useState<string | null>(() => selectedRoom.latestFrame || null);

  const prevFrameRef = useRef<string>('');
  const prevBoxesJsonRef = useRef<string>('');
  const prevZonesJsonRef = useRef<string>('');

  // 1. Sync live backend data when selectedRoom updates from AppContext state polling (guarded against infinite loops)
  useEffect(() => {
    if (!isCameraActive) {
      setProcessedFrame('');
      setDetectedPersons([]);
      return;
    }
    if (selectedRoom?.latestFrame && selectedRoom.latestFrame !== prevFrameRef.current) {
      prevFrameRef.current = selectedRoom.latestFrame;
      setProcessedFrame(selectedRoom.latestFrame);
    }
    const currentBoxesJson = JSON.stringify(selectedRoom?.latestBoxes || []);
    if (currentBoxesJson !== prevBoxesJsonRef.current) {
      prevBoxesJsonRef.current = currentBoxesJson;
      if (selectedRoom?.latestBoxes && selectedRoom.latestBoxes.length > 0) {
        setDetectedPersons(selectedRoom.latestBoxes.map((box, index) => ({
          id: `person-${index}`,
          x: box.x1 * 400,
          y: box.y1 * 320,
          width: (box.x2 - box.x1) * 400,
          height: (box.y2 - box.y1) * 320,
          confidence: box.confidence,
          label: `Human ${Math.round(box.confidence * 100)}%`,
        })));
      } else {
        setDetectedPersons([]);
      }
    }
    const currentZonesJson = JSON.stringify(selectedRoom?.zones || []);
    if (currentZonesJson !== prevZonesJsonRef.current && selectedRoom?.zones && selectedRoom.zones.length > 0) {
      prevZonesJsonRef.current = currentZonesJson;
      setZones(selectedRoom.zones);
    }
  }, [selectedRoom?.id, selectedRoom?.latestFrame, selectedRoom?.occupancyCount, activeLayoutId, isCameraActive]);

  // 2. Continuous Backend Frame & YOLO Polling (Runs on mobile and web every 3s)
  useEffect(() => {
    if (!isCameraActive) {
      setProcessedFrame('');
      setDetectedPersons([]);
      return;
    }
    let stopped = false;
    const fetchLatest = async () => {
      if (stopped || !backendUrl) return;
      try {
        const result = await serosApi.getLatestCameraFrame(backendUrl, selectedRoomId);
        if (!stopped && result) {
          if (result.status === 'off' || (result as any).enabled === false) {
            setProcessedFrame('');
            setDetectedPersons([]);
          } else {
            if (result.frame) {
              setProcessedFrame(result.frame);
            }
            if (Array.isArray(result.boxes)) {
              const bStr = JSON.stringify(result.boxes);
              if (bStr !== prevBoxesJsonRef.current) {
                prevBoxesJsonRef.current = bStr;
                setDetectedPersons(result.boxes.map((box, index) => ({
                  id: `person-${index}`,
                  x: box.x1 * 400,
                  y: box.y1 * 320,
                  width: (box.x2 - box.x1) * 400,
                  height: (box.y2 - box.y1) * 320,
                  confidence: box.confidence,
                  label: `Human ${Math.round(box.confidence * 100)}%`,
                })));
              }
            } else if (prevBoxesJsonRef.current !== '[]') {
              prevBoxesJsonRef.current = '[]';
              setDetectedPersons([]);
            }
          }
        }
      } catch {
        if (!stopped) {
          // Do not overwrite with stale frames when camera might be offline
        }
      }
    };

    fetchLatest();
    const intervalTimer = setInterval(fetchLatest, captureInterval * 1000);

    // 3. If running in browser with webcam permission, also allow browser capture upload
    let stream: MediaStream | undefined;
    if (typeof document !== 'undefined' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      video.muted = true;
      video.playsInline = true;
      navigator.mediaDevices.getUserMedia({ video: true }).then(async nextStream => {
        if (stopped) {
          nextStream.getTracks().forEach(t => t.stop());
          return;
        }
        stream = nextStream;
        video.srcObject = stream;
        await video.play();
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const captureAndUpload = async () => {
          if (stopped) return;
          const context = canvas.getContext('2d');
          if (context) {
            context.save();
            if (mirrorCamera) {
              context.translate(canvas.width, 0);
              context.scale(-1, 1);
            }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            context.restore();
          }
          try {
            const res = await serosApi.detectOccupancy(backendUrl, canvas.toDataURL('image/jpeg', 0.8), selectedRoomId);
            if (!stopped && res) {
              if (res.processed_frame) setProcessedFrame(res.processed_frame);
              if (Array.isArray(res.boxes)) {
                const bStr = JSON.stringify(res.boxes);
                if (bStr !== prevBoxesJsonRef.current) {
                  prevBoxesJsonRef.current = bStr;
                  setDetectedPersons(res.boxes.map((box, index) => {
                    const bw = (box.x2 - box.x1) * 400;
                    const bh = (box.y2 - box.y1) * 320;
                    const px = (box.cx !== undefined ? box.cx : (box.x1 + box.x2) / 2) * 400;
                    const py = (box.cy !== undefined ? box.cy : Math.min(0.99, box.y1 + (box.y2 - box.y1) * 0.85)) * 320;
                    return {
                      id: `person-${index}`,
                      x: px,
                      y: py,
                      width: bw,
                      height: bh,
                      confidence: box.confidence,
                      label: `Human ${Math.round(box.confidence * 100)}%`,
                    };
                  }));
                }
              }
            }
          } catch {
            // Keep existing frame on transient error
          }
        };

        await captureAndUpload();
        const uploadTimer = setInterval(captureAndUpload, captureInterval * 1000);
        video.dataset.serosTimer = String(uploadTimer);
      }).catch(() => undefined);
    }

    return () => {
      stopped = true;
      clearInterval(intervalTimer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [backendUrl, captureInterval, mirrorCamera, selectedRoomId, isCameraActive]);

  const [showPersonBoxes, setShowPersonBoxes] = useState<boolean>(false);
  const [showGridLines, setShowGridLines] = useState<boolean>(false);
  const [isStraightenedNotice, setIsStraightenedNotice] = useState<boolean>(false);

  // Perspective Calibration Lines
  const [horizontalGridLines, setHorizontalGridLines] = useState<number[]>([100, 200]);
  const [verticalGridLines, setVerticalGridLines] = useState<number[]>([130, 270]);
  const [draggingGridLine, setDraggingGridLine] = useState<{ type: 'h' | 'v'; index: number } | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStartPoint, setDrawStartPoint] = useState<Point | null>(null);
  const [currentDrawPoints, setCurrentDrawPoints] = useState<Point[]>([]);

  // Dragging vertex or zone
  const [draggingVertex, setDraggingVertex] = useState<{ zoneId: string; handleIndex: number } | null>(null);
  const [draggingZone, setDraggingZone] = useState<{ zoneId: string; startPoint: Point; origHandles: Point[] } | null>(null);
  const [draggingPersonId, setDraggingPersonId] = useState<string | null>(null);

  // Setup Wizard
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardSelectedTemplate, setWizardSelectedTemplate] = useState<string>('two_halves');

  const svgRef = useRef<any>(null);

  const pushUndo = useCallback((currentZones: Zone[]) => {
    setUndoStack(prev => [...prev.slice(-15), currentZones]);
    setRedoStack([]);
  }, []);

  const isPointInPolygon = (pt: Point, poly: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const prevActiveLayoutIdRef = useRef<string>(activeLayoutId);

  // Sync room layout zones ONLY when user explicitly switches to a different layout
  useEffect(() => {
    if (activeLayoutId && activeLayoutId !== prevActiveLayoutIdRef.current) {
      prevActiveLayoutIdRef.current = activeLayoutId;
      const activeLayout = layouts.find(l => l.id === activeLayoutId);
      if (activeLayout && activeLayout.zones && activeLayout.zones.length > 0) {
        const mappedZones: Zone[] = activeLayout.zones.map(z => {
          const pointsStr = z.points.map(p => `${p[0] * 400},${p[1] * 320}`).join(' ');
          const handles = z.points.map(p => ({ x: p[0] * 400, y: p[1] * 320 }));
          return {
            id: String(z.id || (z as any).num || '1'),
            num: (z as any).num,
            name: z.name,
            statusText: '○ Empty',
            isOccupied: false,
            occupantCount: 0,
            color: z.color,
            points: pointsStr,
            handles: handles,
            assignedDeviceIds: (z as any).assignedDeviceIds || [],
          };
        });
        setZones(mappedZones);
      }
    }
  }, [activeLayoutId]);

  const autoStraightenAndSnap = (rawPoints: Point[]): Point[] => {
    if (rawPoints.length < 3) return rawPoints;

    if (rawPoints.length === 4 || editorMode === 'draw_rect') {
      const xs = rawPoints.map(p => p.x);
      const ys = rawPoints.map(p => p.y);
      const minX = Math.round(Math.min(...xs));
      const maxX = Math.round(Math.max(...xs));
      const minY = Math.round(Math.min(...ys));
      const maxY = Math.round(Math.max(...ys));
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
    }

    const snapped = rawPoints.map(p => {
      let nx = Math.round(p.x / 4) * 4;
      let ny = Math.round(p.y / 4) * 4;
      for (const vg of verticalGridLines) {
        if (Math.abs(nx - vg) < 12) nx = vg;
      }
      for (const hg of horizontalGridLines) {
        if (Math.abs(ny - hg) < 12) ny = hg;
      }
      return { x: nx, y: ny };
    });

    const filtered: Point[] = [];
    snapped.forEach(pt => {
      if (filtered.length === 0) {
        filtered.push(pt);
      } else {
        const last = filtered[filtered.length - 1];
        const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
        if (dist > 14) filtered.push(pt);
      }
    });

    return filtered.length >= 3 ? filtered : rawPoints;
  };

  const pointsToString = (pts: Point[]): string => pts.map(p => `${p.x},${p.y}`).join(' ');

  const pointsToCurvedPath = (pts: Point[]): string => {
    if (pts.length < 3) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      d += ` Q ${curr.x} ${curr.y}, ${midX} ${midY}`;
    }
    d += ' Z';
    return d;
  };

  // Pure computed occupancy: derived directly during render without any state mutation or effect loop
  const getZoneDisplayOccupancy = useCallback((zone: Zone) => {
    if (detectedPersons.length > 0) {
      const count = detectedPersons.filter(person => {
        const ground = { x: person.x, y: person.y };
        const mid = { x: person.x, y: Math.max(0, person.y - (person.height ? person.height * 0.35 : 0)) };
        return isPointInPolygon(ground, zone.handles) || isPointInPolygon(mid, zone.handles);
      }).length;
      return {
        count,
        isOccupied: count > 0,
        statusText: count > 0 ? `● ${count} People Detected` : '○ Empty',
      };
    }
    return {
      count: zone.occupantCount || 0,
      isOccupied: zone.isOccupied || false,
      statusText: zone.statusText || '○ Empty',
    };
  }, [detectedPersons]);

  // Convert Screen Event to SVG Coordinates
  const getSvgCoordinates = (e: any): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect ? svgRef.current.getBoundingClientRect() : { left: 0, top: 0, width: 400, height: 320 };
    const clientX = e.touches ? e.touches[0].clientX : e.clientX || e.nativeEvent?.locationX || 0;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY || e.nativeEvent?.locationY || 0;

    const scaleX = 400 / (rect.width || 400);
    const scaleY = 320 / (rect.height || 320);

    const x = Math.max(0, Math.min(400, Math.round((clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(320, Math.round((clientY - rect.top) * scaleY)));

    return { x, y };
  };

  const handlePointerDown = (e: any) => {
    const pt = getSvgCoordinates(e);
    if (!pt) return;

    if (showGridLines) {
      for (let i = 0; i < horizontalGridLines.length; i++) {
        if (Math.abs(pt.y - horizontalGridLines[i]) < 8) {
          setDraggingGridLine({ type: 'h', index: i });
          return;
        }
      }
      for (let i = 0; i < verticalGridLines.length; i++) {
        if (Math.abs(pt.x - verticalGridLines[i]) < 8) {
          setDraggingGridLine({ type: 'v', index: i });
          return;
        }
      }
    }

    for (const p of detectedPersons) {
      if (Math.abs(pt.x - p.x) < 25 && Math.abs(pt.y - p.y) < 40) {
        setDraggingPersonId(p.id);
        return;
      }
    }

    if (editorMode === 'draw_rect' || editorMode === 'draw_poly' || editorMode === 'draw_curve') {
      setIsDrawing(true);
      setDrawStartPoint(pt);
      setCurrentDrawPoints([pt]);
    }
  };

  const handlePointerMove = (e: any) => {
    const pt = getSvgCoordinates(e);
    if (!pt) return;

    if (draggingGridLine) {
      if (draggingGridLine.type === 'h') {
        setHorizontalGridLines(prev => {
          const next = [...prev];
          next[draggingGridLine.index] = pt.y;
          return next;
        });
      } else {
        setVerticalGridLines(prev => {
          const next = [...prev];
          next[draggingGridLine.index] = pt.x;
          return next;
        });
      }
      return;
    }

    if (draggingPersonId) {
      setDetectedPersons(prev =>
        prev.map(p => (p.id === draggingPersonId ? { ...p, x: pt.x, y: pt.y } : p))
      );
      return;
    }

    if (draggingVertex) {
      setZones(prev =>
        prev.map(z => {
          if (z.id === draggingVertex.zoneId) {
            const nextHandles = [...z.handles];
            nextHandles[draggingVertex.handleIndex] = pt;
            return {
              ...z,
              handles: nextHandles,
              points: pointsToString(nextHandles)
            };
          }
          return z;
        })
      );
      return;
    }

    if (draggingZone) {
      const dx = pt.x - draggingZone.startPoint.x;
      const dy = pt.y - draggingZone.startPoint.y;
      setZones(prev =>
        prev.map(z => {
          if (z.id === draggingZone.zoneId) {
            const nextHandles = draggingZone.origHandles.map(h => ({
              x: Math.max(10, Math.min(390, h.x + dx)),
              y: Math.max(10, Math.min(310, h.y + dy))
            }));
            return {
              ...z,
              handles: nextHandles,
              points: pointsToString(nextHandles)
            };
          }
          return z;
        })
      );
      return;
    }

    if (isDrawing) {
      if (editorMode === 'draw_rect' && drawStartPoint) {
        setCurrentDrawPoints([
          { x: drawStartPoint.x, y: drawStartPoint.y },
          { x: pt.x, y: drawStartPoint.y },
          { x: pt.x, y: pt.y },
          { x: drawStartPoint.x, y: pt.y }
        ]);
      } else if (editorMode === 'draw_poly' || editorMode === 'draw_curve') {
        const last = currentDrawPoints[currentDrawPoints.length - 1];
        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 8) {
          setCurrentDrawPoints(prev => [...prev, pt]);
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (draggingGridLine) {
      setDraggingGridLine(null);
      return;
    }

    if (draggingPersonId) {
      setDraggingPersonId(null);
      setBackendVerifiedNotice('YOLO vision tracker re-calculated live zone occupancy.');
      return;
    }

    if (draggingVertex || draggingZone) {
      pushUndo(zones);
      setDraggingVertex(null);
      setDraggingZone(null);
      void saveLayoutZones(activeLayoutId, zones);
      setBackendVerifiedNotice('Zone coordinates updated & saved to database.');
      return;
    }

    if (isDrawing && currentDrawPoints.length >= 3) {
      pushUndo(zones);

      const straightened = autoStraightenAndSnap(currentDrawPoints);
      const nextColor = COLOR_PALETTE[zones.length % COLOR_PALETTE.length].hex;
      const newZoneId = `zone-${Date.now()}`;
      const newZoneName = `Zone ${zones.length + 1}: Monitored Area`;

      const newZone: Zone = {
        id: newZoneId,
        name: newZoneName,
        statusText: '○ Empty',
        isOccupied: false,
        occupantCount: 0,
        color: nextColor,
        points: pointsToString(straightened),
        handles: straightened,
        assignedDeviceIds: [],
        shapeType: editorMode === 'draw_curve' ? 'curved' : editorMode === 'draw_rect' ? 'rectangle' : 'polygon'
      };

      const updated = [...zones, newZone];
      setZones(updated);
      setSelectedZoneId(newZoneId);
      setIsStraightenedNotice(true);
      setTimeout(() => setIsStraightenedNotice(false), 3000);
      void saveLayoutZones(activeLayoutId, updated);
      setBackendVerifiedNotice('✨ New zone added & saved to database!');
      speakText(`${newZoneName} created and saved.`);
    }

    setIsDrawing(false);
    setCurrentDrawPoints([]);
    setDrawStartPoint(null);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, zones]);
    setUndoStack(u => u.slice(0, -1));
    setZones(prev);
    setBackendVerifiedNotice('Reverted zone modification (Undo).');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, zones]);
    setRedoStack(r => r.slice(0, -1));
    setZones(next);
    setBackendVerifiedNotice('Re-applied zone modification (Redo).');
  };

  const handleSplitZone = (orientation: 'horizontal' | 'vertical') => {
    const target = zones.find(z => z.id === selectedZoneId) || zones[0];
    if (!target) return;

    pushUndo(zones);
    const xs = target.handles.map(p => p.x);
    const ys = target.handles.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    let z1Handles: Point[] = [];
    let z2Handles: Point[] = [];

    if (orientation === 'vertical') {
      const midX = Math.round((minX + maxX) / 2);
      z1Handles = [
        { x: minX, y: minY },
        { x: midX - 4, y: minY },
        { x: midX - 4, y: maxY },
        { x: minX, y: maxY }
      ];
      z2Handles = [
        { x: midX + 4, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: midX + 4, y: maxY }
      ];
    } else {
      const midY = Math.round((minY + maxY) / 2);
      z1Handles = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: midY - 4 },
        { x: minX, y: midY - 4 }
      ];
      z2Handles = [
        { x: minX, y: midY + 4 },
        { x: maxX, y: midY + 4 },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
    }

    const updatedZ1: Zone = {
      ...target,
      name: `${target.name} (Part A)`,
      handles: z1Handles,
      points: pointsToString(z1Handles)
    };

    const newZ2: Zone = {
      id: `zone-${Date.now()}`,
      name: `${target.name.replace(/ \(Part A\)/, '')} (Part B)`,
      statusText: '○ Empty',
      isOccupied: false,
      occupantCount: 0,
      color: '#1e6585',
      handles: z2Handles,
      points: pointsToString(z2Handles),
      assignedDeviceIds: [],
      shapeType: 'rectangle'
    };

    const nextZones = zones.map(z => (z.id === target.id ? updatedZ1 : z)).concat(newZ2);
    setZones(nextZones);
    setSelectedZoneId(newZ2.id);
    void saveLayoutZones(activeLayoutId, nextZones);
    setBackendVerifiedNotice(`Zone divided into 2 editable halves (${orientation}) & saved to database.`);
  };

  const handleResetZones = () => {
    pushUndo(zones);
    const defaultZones: Zone[] = [
      {
        id: '1',
        name: 'Zone 1 (Top-Left)',
        statusText: '○ Empty',
        isOccupied: false,
        occupantCount: 0,
        color: '#FFB547',
        points: '24,45 192,54 192,166 36,186',
        handles: [
          { x: 24, y: 45 },
          { x: 192, y: 54 },
          { x: 192, y: 166 },
          { x: 36, y: 186 }
        ],
        assignedDeviceIds: [],
        shapeType: 'polygon'
      },
      {
        id: '2',
        name: 'Zone 2 (Top-Right)',
        statusText: '○ Empty',
        isOccupied: false,
        occupantCount: 0,
        color: '#3B82F6',
        points: '192,54 376,45 364,186 192,166',
        handles: [
          { x: 192, y: 54 },
          { x: 376, y: 45 },
          { x: 364, y: 186 },
          { x: 192, y: 166 }
        ],
        assignedDeviceIds: [],
        shapeType: 'polygon'
      },
      {
        id: '3',
        name: 'Zone 3 (Bottom-Left)',
        statusText: '○ Empty',
        isOccupied: false,
        occupantCount: 0,
        color: '#00E676',
        points: '36,186 192,166 192,301 72,301',
        handles: [
          { x: 36, y: 186 },
          { x: 192, y: 166 },
          { x: 192, y: 301 },
          { x: 72, y: 301 }
        ],
        assignedDeviceIds: [],
        shapeType: 'polygon'
      },
      {
        id: '4',
        name: 'Zone 4 (Bottom-Right)',
        statusText: '○ Empty',
        isOccupied: false,
        occupantCount: 0,
        color: '#EF4444',
        points: '192,166 364,186 328,301 192,301',
        handles: [
          { x: 192, y: 166 },
          { x: 364, y: 186 },
          { x: 328, y: 301 },
          { x: 192, y: 301 }
        ],
        assignedDeviceIds: [],
        shapeType: 'polygon'
      }
    ];
    setZones(defaultZones);
    void saveLayoutZones(activeLayoutId, defaultZones);
    setBackendVerifiedNotice('Restored default 4-zone layout & saved to database.');
  };

  const handleDeleteZone = (zoneId: string) => {
    if (zones.length <= 1) {
      setBackendVerifiedNotice('Cannot delete the only remaining zone.');
      return;
    }
    pushUndo(zones);
    const filtered = zones.filter(z => z.id !== zoneId);
    setZones(filtered);
    setSelectedZoneId(filtered[0]?.id || '');
    void saveLayoutZones(activeLayoutId, filtered);
    setBackendVerifiedNotice('Zone removed & saved to database.');
  };

  const handleToggleDeviceAssignment = (zoneId: string, deviceId: string) => {
    pushUndo(zones);
    const device = devices.find(d => d.id === deviceId);
    const isRoomWide = device?.category === 'ac';
    setZones(prev => prev.map(z => {
      if (z.id === zoneId) {
        const exists = z.assignedDeviceIds?.includes(deviceId);
        return {
          ...z,
          assignedDeviceIds: exists
            ? z.assignedDeviceIds.filter(id => id !== deviceId)
            : [...(z.assignedDeviceIds || []), deviceId],
        };
      }
      if (!isRoomWide && z.assignedDeviceIds?.includes(deviceId)) {
        return {
          ...z,
          assignedDeviceIds: z.assignedDeviceIds.filter(id => id !== deviceId),
        };
      }
      return z;
    }));
    setBackendVerifiedNotice('Hardware fixture assignments updated.');
  };

  const handleAddPerson = () => {
    const newId = `person-${Date.now()}`;
    const x = Math.floor(250 + Math.random() * 80);
    const y = Math.floor(100 + Math.random() * 100);
    setDetectedPersons(prev => [
      ...prev,
      {
        id: newId,
        x,
        y,
        width: 46,
        height: 108,
        confidence: 0.95,
        label: 'Person 95%'
      }
    ]);
    setBackendVerifiedNotice('Simulated student entered Room Zone. YOLO Vision updated!');
    speakText('Person detected in Zone 2. Turning on assigned lights and fan.');
  };

  const handleClearPersons = () => {
    setDetectedPersons([]);
    setBackendVerifiedNotice('All occupants left the room. Empty timeout initiating.');
    speakText('Room is now vacant. Energy eco-saver shutting off devices.');
  };

  const handleApplyWizardTemplate = () => {
    pushUndo(zones);
    if (wizardSelectedTemplate === 'two_halves') {
      setZones([
        {
          id: 'w-zone-1',
          name: 'Front Lab Desks',
          statusText: '● 2 People Detected',
          isOccupied: true,
          occupantCount: 2,
          color: '#FFB547',
          points: '20,35 190,35 190,285 20,285',
          handles: [{ x: 20, y: 35 }, { x: 190, y: 35 }, { x: 190, y: 285 }, { x: 20, y: 285 }],
          assignedDeviceIds: ['fan-101-1', 'light-101-tubes'],
          shapeType: 'rectangle'
        },
        {
          id: 'w-zone-2',
          name: 'Rear Presentation & Board',
          statusText: '○ Empty',
          isOccupied: false,
          occupantCount: 0,
          color: '#27834A',
          points: '210,35 380,35 380,285 210,285',
          handles: [{ x: 210, y: 35 }, { x: 380, y: 35 }, { x: 380, y: 285 }, { x: 210, y: 285 }],
          assignedDeviceIds: ['fan-101-2', 'light-101-whiteboard'],
          shapeType: 'rectangle'
        }
      ]);
    } else {
      setZones([
        {
          id: 'q-1',
          name: 'North-West (Front Desks)',
          statusText: '● 2 People Detected',
          isOccupied: true,
          occupantCount: 2,
          color: '#FFB547',
          points: '20,30 190,30 190,150 20,150',
          handles: [{ x: 20, y: 30 }, { x: 190, y: 30 }, { x: 190, y: 150 }, { x: 20, y: 150 }],
          assignedDeviceIds: ['fan-101-1', 'light-101-tubes'],
          shapeType: 'rectangle'
        },
        {
          id: 'q-2',
          name: 'North-East (Teacher Board)',
          statusText: '○ Empty',
          isOccupied: false,
          occupantCount: 0,
          color: '#27834A',
          points: '210,30 380,30 380,150 210,150',
          handles: [{ x: 210, y: 30 }, { x: 380, y: 30 }, { x: 380, y: 150 }, { x: 210, y: 150 }],
          assignedDeviceIds: ['light-101-whiteboard'],
          shapeType: 'rectangle'
        }
      ]);
    }
    setIsSetupWizardOpen(false);
    setBackendVerifiedNotice('✨ Applied guided camera template and automated fixtures!');
  };

  const selectedZone = zones.find(z => z.id === selectedZoneId) || zones[0];
  const roomDevices = devices.filter(d => d.roomId === selectedRoomId);

  return (
    <View style={styles.container}>
      {/* Help Banner */}
      <View style={styles.helpBanner}>
        <View style={[styles.rowAlign, { flex: 1, minWidth: 0, marginRight: 8 }]}>
          <View style={styles.lightCircle}>
            <Icon name="lightbulb" size={20} color={colors.primary} />
          </View>
          <Text style={styles.helpText}>
            <Text style={styles.boldText}>Tip:</Text> Camera monitoring is automatic. Choose how often frames are sent to the backend below.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            speakText('Camera monitoring is automatic. Frames are sent to the backend on the selected schedule.');
          }}
          style={styles.explainBtn}
          activeOpacity={0.8}
        >
          <Icon name="volume_up" size={18} color={colors.primary} />
          <Text style={styles.explainText}>Explain</Text>
        </TouchableOpacity>
      </View>

      {/* Camera & Room Header */}
      <View style={styles.card}>
        <View style={styles.roomSelectCol}>
          <Text style={styles.inputLabel}>Selected Monitoring Space</Text>
          <View style={styles.selectWrapper}>
            <Text style={styles.selectText}>{selectedRoom.name}</Text>
            <Icon name="expand_more" size={22} color={colors.textSecondary} />
          </View>
        </View>

        {/* Cam Switcher */}
        <View style={styles.camRow}>
          {cameraOptions.map((cam, idx) => (
            <TouchableOpacity
              key={cam.id}
              onPress={() => {
                setActiveCamIndex(idx);
                setBackendVerifiedNotice(`Switched to ${cam.label} • 1080P stream verified.`);
              }}
              style={[
                styles.camBtn,
                activeCamIndex === idx && styles.camBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Icon
                name="videocam"
                size={16}
                color={activeCamIndex === idx ? '#FFFFFF' : colors.textPrimary}
              />
              <Text
                style={[
                  styles.camBtnText,
                  activeCamIndex === idx && styles.camBtnTextActive,
                ]}
              >
                {cam.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status badges */}
        <View style={styles.statusBadgeRow}>
          <View style={styles.yoloPill}>
            <View style={styles.pingDot} />
            <Text style={styles.yoloText}>
              YOLO Vision: {detectedPersons.length || selectedRoom.occupancyCount} Humans
            </Text>
          </View>

          <View style={[styles.straightPill, { backgroundColor: '#E5F2F8' }]}>
            <Icon name="thermostat" size={15} color={colors.secondary} />
            <Text style={[styles.straightText, { color: colors.secondary }]}>
              {sensorData.temperature.toFixed(1)}°C • {sensorData.humidity.toFixed(0)}% RH
            </Text>
          </View>
        </View>

        {/* Layout Selector Chips */}
        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
              Room Blueprint Layout
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>
              3D Editor on Website
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {layouts.map((l) => {
              const isActive = l.id === activeLayoutId;
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => selectLayout(l.id)}
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: isActive ? colors.surfaceGreen : colors.surface,
                    borderWidth: 1.5,
                    borderColor: isActive ? colors.primary : colors.borderSubtle,
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? colors.primary : colors.textPrimary }}>
                    {isActive ? `✓ ${l.name}` : l.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>


      {/* Interactive Camera Viewport & Zone Canvas Card */}
      <View style={styles.card}>
        {/* Top Control Bar */}
        <View style={styles.camControlsContainer}>
          <View style={styles.camHeaderRow}>
            <View style={styles.activeZoneBadge}>
              <Text style={styles.activeZoneLabel}>Zone:</Text>
              <View style={styles.zoneChip}>
                <Text style={styles.zoneChipText} numberOfLines={1}>
                  {selectedZone?.name || 'Monitoring'} ({selectedZone?.occupantCount || 0} present)
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleToggleCamera}
              style={[
                styles.camToggleBtn,
                isCameraActive ? styles.camToggleBtnOn : styles.camToggleBtnOff
              ]}
              activeOpacity={0.8}
            >
              <Icon
                name={isCameraActive ? 'videocam' : 'videocam_off'}
                size={15}
                color={isCameraActive ? '#FFFFFF' : '#BA1A1A'}
              />
              <Text
                style={[
                  styles.camToggleBtnText,
                  isCameraActive ? styles.camToggleBtnTextOn : styles.camToggleBtnTextOff
                ]}
              >
                {isCameraActive ? 'Camera ON' : 'Camera OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.camSettingsRow}>
            <View style={styles.frameIntervalRow}>
              <Text style={styles.activeZoneLabel}>Send frame:</Text>
              {[3, 5, 10].map(seconds => (
                <TouchableOpacity
                  key={seconds}
                  onPress={() => setCaptureInterval(seconds as 3 | 5 | 10)}
                  style={[styles.smallToggle, captureInterval === seconds && styles.smallToggleActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.smallToggleText, captureInterval === seconds && styles.smallToggleTextActive]}>
                    {seconds}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setMirrorCamera(value => !value)}
              style={[styles.smallToggle, mirrorCamera && styles.smallToggleActive]}
              activeOpacity={0.8}
            >
              <Icon name="flip" size={15} color={mirrorCamera ? '#FFFFFF' : colors.textPrimary} />
              <Text style={[styles.smallToggleText, mirrorCamera && styles.smallToggleTextActive]}>Mirror</Text>
            </TouchableOpacity>
          </View>
        </View>

          <View style={[styles.rowAlignCompact, { display: 'none' }]}>
            <TouchableOpacity
              onPress={() => setShowGridLines(!showGridLines)}
              style={[styles.smallToggle, showGridLines && styles.smallToggleActive]}
            >
              <Icon
                name="grid_on"
                size={15}
                color={showGridLines ? '#FFFFFF' : colors.textPrimary}
              />
              <Text
                style={[
                  styles.smallToggleText,
                  showGridLines && styles.smallToggleTextActive,
                ]}
              >
                Grid
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowPersonBoxes(!showPersonBoxes)}
              style={[styles.smallToggle, showPersonBoxes && styles.smallToggleActive]}
            >
              <Icon
                name={showPersonBoxes ? 'visibility' : 'visibility_off'}
                size={15}
                color={showPersonBoxes ? '#FFFFFF' : colors.textPrimary}
              />
              <Text
                style={[
                  styles.smallToggleText,
                  showPersonBoxes && styles.smallToggleTextActive,
                ]}
              >
                Boxes
              </Text>
            </TouchableOpacity>
          </View>

        {/* Video Frame */}
        <View style={styles.videoFrame}>
          {isCameraActive ? (
            <>
              {processedFrame || selectedRoom?.latestFrame ? (
                <Image
                  source={{ uri: (processedFrame || selectedRoom?.latestFrame)! }}
                  accessibilityLabel="Classroom Camera Feed"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0.95,
                  }}
                  resizeMode="cover"
                />
              ) : activeCamera?.url ? (
                <Image source={{ uri: activeCamera.url }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.85, ...(mirrorCamera ? { transform: [{ scaleX: -1 }] } : {}) }} resizeMode="cover" />
              ) : null}

              {/* Live Badge */}
              <View style={styles.liveBadge}>
                <View style={styles.redPulse} />
                <Text style={styles.liveText}>LIVE 1080P</Text>
              </View>
            </>
          ) : (
            <View style={{ position: 'absolute', inset: 0, backgroundColor: '#0e1f16', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Icon name="videocam_off" size={38} color="#a0b3a6" />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 8 }}>Camera Feed Paused</Text>
              <Text style={{ color: '#a0b3a6', fontSize: 12, marginTop: 4 }}>Tap Camera ON to resume streaming</Text>
              <TouchableOpacity
                onPress={handleToggleCamera}
                style={{ marginTop: 12, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Turn Camera ON</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* React Native SVG Canvas for interactive zones & detections */}
          <Svg
            ref={svgRef}
            viewBox="0 0 400 320"
            preserveAspectRatio="none"
            {...({
              onMouseDown: handlePointerDown,
              onMouseMove: handlePointerMove,
              onMouseUp: handlePointerUp,
              onTouchStart: handlePointerDown,
              onTouchMove: handlePointerMove,
              onTouchEnd: handlePointerUp,
            } as any)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              cursor: 'crosshair'
            } as any}
          >
            <Defs>
              {zones.map((zone) => {
                const occ = getZoneDisplayOccupancy(zone);
                return (
                  <LinearGradient key={`grad-${zone.id}`} id={`grad-${zone.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={zone.color} stopOpacity={occ.isOccupied ? 0.45 : 0.2} />
                    <Stop offset="100%" stopColor={zone.color} stopOpacity={occ.isOccupied ? 0.25 : 0.1} />
                  </LinearGradient>
                );
              })}
            </Defs>

            {/* Perspective Grid Lines */}
            {showGridLines && (
              <G>
                {horizontalGridLines.map((gy, i) => (
                  <G key={`h-${i}`}>
                    <Line x1="0" y1={gy} x2="400" y2={gy} stroke="#DFF3A3" strokeWidth="2" strokeDasharray="4,4" />
                    <Circle cx={20} cy={gy} r={6} fill="#006934" stroke="#FFFFFF" strokeWidth={2} />
                  </G>
                ))}
                {verticalGridLines.map((gx, i) => (
                  <G key={`v-${i}`}>
                    <Line x1={gx} y1={0} x2={gx} y2={320} stroke="#DFF3A3" strokeWidth="2" strokeDasharray="4,4" />
                    <Circle cx={gx} cy={20} r={6} fill="#006934" stroke="#FFFFFF" strokeWidth={2} />
                  </G>
                ))}
              </G>
            )}

            {/* Zones */}
            {zones.map((zone) => {
              const isSelected = zone.id === selectedZoneId;
              const hasCurvedShape = zone.shapeType === 'curved';

              return (
                <G
                  key={zone.id}
                  onPress={() => {
                    setSelectedZoneId(zone.id);
                  }}
                  {...({
                    onMouseDown: (e: any) => {
                      if (editorMode === 'move') {
                        e.stopPropagation?.();
                        const pt = getSvgCoordinates(e);
                        if (pt) {
                          setSelectedZoneId(zone.id);
                          setDraggingZone({
                            zoneId: zone.id,
                            startPoint: pt,
                            origHandles: [...zone.handles]
                          });
                        }
                      }
                    }
                  } as any)}
                >
                  {hasCurvedShape ? (
                    <Path
                      d={pointsToCurvedPath(zone.handles)}
                      fill={`url(#grad-${zone.id})`}
                      stroke={zone.color}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                      strokeDasharray={getZoneDisplayOccupancy(zone).isOccupied ? '6,4' : undefined}
                    />
                  ) : (
                    <Polygon
                      points={zone.points}
                      fill={`url(#grad-${zone.id})`}
                      stroke={zone.color}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                      strokeDasharray={getZoneDisplayOccupancy(zone).isOccupied ? '6,4' : undefined}
                    />
                  )}

                  {zone.handles.map((handle, hIndex) => (
                    <Circle
                      key={`h-${zone.id}-${hIndex}`}
                      cx={handle.x}
                      cy={handle.y}
                      r={isSelected ? 7 : 5}
                      fill="#FFFFFF"
                      stroke={zone.color}
                      strokeWidth={2.5}
                      {...({
                        onMouseDown: (e: any) => {
                          e.stopPropagation?.();
                          setSelectedZoneId(zone.id);
                          setDraggingVertex({ zoneId: zone.id, handleIndex: hIndex });
                        }
                      } as any)}
                    />
                  ))}
                </G>
              );
            })}

            {/* Active Drawing preview */}
            {isDrawing && currentDrawPoints.length > 0 && (
              <G>
                <Polygon
                  points={pointsToString(currentDrawPoints)}
                  fill="#006934"
                  fillOpacity={0.25}
                  stroke="#006934"
                  strokeWidth="2.5"
                  strokeDasharray="4,3"
                />
              </G>
            )}

            {/* Detected Occupants: High-Precision Glowing Red Pinpoint Radar Dot Only (No Rectangles) */}
            {showPersonBoxes &&
              detectedPersons.map((person) => (
                <G key={person.id}>
                  {/* Radar pulse wave circle */}
                  <Circle
                    cx={person.x}
                    cy={person.y}
                    r={14}
                    fill="rgba(255, 23, 68, 0.22)"
                    stroke="#FF1744"
                    strokeWidth={2}
                  />
                  {/* Solid glowing red core */}
                  <Circle
                    cx={person.x}
                    cy={person.y}
                    r={7}
                    fill="#FF1744"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                  {/* Pinpoint center dot */}
                  <Circle
                    cx={person.x}
                    cy={person.y}
                    r={2.5}
                    fill="#FFFFFF"
                  />
                </G>
              ))}
          </Svg>
        </View>

        {/* Toolbar */}
        <View style={[styles.toolbar, { display: 'none' }]}>
          <View style={styles.rowAlignCompact}>
            <TouchableOpacity
              onPress={() => {
                setEditorMode('draw_rect');
                setBackendVerifiedNotice('Drag box on camera to create auto-straightened rectangle zone.');
              }}
              style={[styles.toolBtn, editorMode === 'draw_rect' && styles.toolBtnActive]}
            >
              <Icon
                name="crop_landscape"
                size={18}
                color={editorMode === 'draw_rect' ? '#FFFFFF' : colors.textPrimary}
              />
              <Text style={[styles.toolBtnText, editorMode === 'draw_rect' && styles.toolBtnTextActive]}>
                Rect
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setEditorMode('draw_poly');
                setBackendVerifiedNotice('Click or sketch points to create polygon zone.');
              }}
              style={[styles.toolBtn, editorMode === 'draw_poly' && styles.toolBtnActive]}
            >
              <Icon
                name="draw"
                size={18}
                color={editorMode === 'draw_poly' ? '#FFFFFF' : colors.textPrimary}
              />
              <Text style={[styles.toolBtnText, editorMode === 'draw_poly' && styles.toolBtnTextActive]}>
                Poly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEditorMode('move')}
              style={[styles.toolBtn, editorMode === 'move' && styles.toolBtnActive]}
            >
              <Icon
                name="pan_tool"
                size={18}
                color={editorMode === 'move' ? '#FFFFFF' : colors.textPrimary}
              />
              <Text style={[styles.toolBtnText, editorMode === 'move' && styles.toolBtnTextActive]}>
                Move
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowAlignCompact}>
            <TouchableOpacity
              onPress={() => setIsSetupWizardOpen(true)}
              style={styles.wizardBtn}
            >
              <Icon name="auto_fix_high" size={18} color={colors.tertiary} />
              <Text style={styles.wizardBtnText}>Wizard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleUndo}
              disabled={undoStack.length === 0}
              style={[styles.iconToolBtn, undoStack.length === 0 && styles.iconToolBtnDisabled]}
            >
              <Icon name="undo" size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRedo}
              disabled={redoStack.length === 0}
              style={[styles.iconToolBtn, redoStack.length === 0 && styles.iconToolBtnDisabled]}
            >
              <Icon name="redo" size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                void saveLayoutZones(activeLayoutId, zones);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primary,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                gap: 4,
              }}
              activeOpacity={0.8}
            >
              <Icon name="save" size={15} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>Save to DB</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleResetZones} style={styles.resetBtn}>
              <Icon name="cleaning_services" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Occupancy Simulator Bar */}
        <View style={[styles.simulatorBar, { display: 'none' }]}>
          <Text style={styles.simulatorTitle}>Test Occupancy Automation:</Text>
          <View style={styles.rowAlignCompact}>
            <TouchableOpacity onPress={handleAddPerson} style={styles.addPersonBtn}>
              <Icon name="person_add" size={16} color={colors.primary} />
              <Text style={styles.addPersonText}>+ Add Person</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearPersons} style={styles.clearPersonBtn}>
              <Icon name="person_remove" size={16} color={colors.danger} />
              <Text style={styles.clearPersonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Selected Zone Customizer & Hardware Assignment Drawer */}
      {false && selectedZone && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View style={[styles.zoneColorDot, { backgroundColor: selectedZone.color }]} />
              <TextInput
                value={selectedZone.name}
                onChangeText={(val) => {
                  setZones(prev =>
                    prev.map(z => (z.id === selectedZone.id ? { ...z, name: val } : z))
                  );
                }}
                style={styles.zoneNameInput}
              />
            </View>

            <View style={styles.rowAlignCompact}>
              {(() => {
                const selOcc = selectedZone ? getZoneDisplayOccupancy(selectedZone) : { count: 0, isOccupied: false, statusText: '○ Empty' };
                return (
                  <View
                    style={[
                      styles.occupancyStatusPill,
                      { backgroundColor: selOcc.isOccupied ? colors.surfaceGreen : colors.canvas },
                    ]}
                  >
                    <Text
                      style={[
                        styles.occupancyStatusText,
                        { color: selOcc.isOccupied ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      {selOcc.count > 0
                        ? `${selOcc.count} People Inside`
                        : 'Empty • Standby'}
                    </Text>
                  </View>
                );
              })()}

              <TouchableOpacity
                onPress={() => handleDeleteZone(selectedZone.id)}
                style={styles.deleteZoneBtn}
              >
                <Icon name="delete" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Color & Split row */}
          <View style={styles.rowBetween}>
            <View style={styles.rowAlignCompact}>
              <Text style={styles.settingLabelText}>Color:</Text>
              {COLOR_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c.hex}
                  onPress={() => {
                    pushUndo(zones);
                    setZones(prev =>
                      prev.map(z =>
                        z.id === selectedZone.id ? { ...z, color: c.hex } : z
                      )
                    );
                  }}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c.hex },
                    selectedZone.color.toLowerCase() === c.hex.toLowerCase() && styles.colorCircleActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.rowAlignCompact}>
              <TouchableOpacity
                onPress={() => handleSplitZone('vertical')}
                style={styles.splitBtn}
              >
                <Icon name="splitscreen_vertical" size={16} color={colors.primary} />
                <Text style={styles.splitBtnText}>Split V</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSplitZone('horizontal')}
                style={styles.splitBtn}
              >
                <Icon name="splitscreen" size={16} color={colors.primary} />
                <Text style={styles.splitBtnText}>Split H</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fixtures Assignment */}
          <View style={styles.fixtureSection}>
            <View style={styles.rowBetween}>
              <Text style={styles.fixtureTitle}>Assigned Automated Fixtures:</Text>
              <Text style={styles.fixtureCount}>
                {selectedZone.assignedDeviceIds?.length || 0} fixtures linked
              </Text>
            </View>

            <View style={styles.fixtureGrid}>
              {roomDevices.map((device) => {
                const isAssigned = selectedZone.assignedDeviceIds?.includes(device.id);
                return (
                  <TouchableOpacity
                    key={device.id}
                    onPress={() => handleToggleDeviceAssignment(selectedZone.id, device.id)}
                    style={[
                      styles.fixtureItem,
                      isAssigned && styles.fixtureItemAssigned,
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.rowAlign}>
                      <Icon
                        name={
                          device.category === 'fans'
                            ? 'mode_fan'
                            : device.category === 'lights'
                            ? 'lightbulb'
                            : 'ac_unit'
                        }
                        size={20}
                        color={isAssigned ? colors.primary : colors.textPrimary}
                      />
                      <View>
                        <Text
                          style={[
                            styles.fixtureName,
                            isAssigned && { color: colors.primary },
                          ]}
                        >
                          {device.name}
                        </Text>
                        <Text style={styles.fixturePower}>
                          {device.category.toUpperCase()} • {device.powerWatts}W
                        </Text>
                      </View>
                    </View>
                    <Icon
                      name={isAssigned ? 'check_box' : 'check_box_outline_blank'}
                      size={20}
                      color={isAssigned ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Assigned Automated Devices Summary */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Assigned Automated Devices</Text>
        <Text style={styles.autoSyncBadge}>Auto-Sync On</Text>
      </View>

      {zones.map((zone, idx) => {
        const zNum = zone.num ?? (typeof zone.id === 'number' ? zone.id : parseInt(String(zone.id).replace(/\D/g, ''), 10) || (idx + 1));
        const zoneDevs = devices.filter(d => {
          if (d.category === 'ac') return true;
          // Backend assignment is authoritative. The quadrant fallback is
          // only for older records that do not yet have zone assignments.
          if (Array.isArray(zone.assignedDeviceIds) && zone.assignedDeviceIds.length > 0) {
            return zone.assignedDeviceIds.includes(d.id);
          }
          return d.quadrantNum === zNum;
        });
        const occ = getZoneDisplayOccupancy(zone);
        return (
          <View key={`card-${zone.id}`} style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={[styles.rowAlign, { flex: 1, minWidth: 0, marginRight: 8 }]}>
                <View style={[styles.zoneDotRing, { backgroundColor: `${zone.color}40` }]}>
                  <View style={[styles.zoneDotCore, { backgroundColor: zone.color }]} />
                </View>
                <Text style={styles.zoneSummaryName} numberOfLines={1}>{zone.name}</Text>
              </View>
              <View
                style={[
                  styles.occupancyStatusPill,
                  { backgroundColor: occ.isOccupied ? colors.surfaceGreen : colors.canvas },
                ]}
              >
                <Text
                  style={[
                    styles.occupancyStatusText,
                    { color: occ.isOccupied ? colors.primary : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {occ.statusText}
                </Text>
              </View>
            </View>

            {zoneDevs.length === 0 ? (
              <View style={styles.emptyNotice}>
                <Text style={styles.emptyNoticeText}>
                  No devices assigned to this zone yet. Select the zone above to assign fixtures.
                </Text>
              </View>
            ) : (
              <View style={styles.devsGrid}>
                {zoneDevs.map((dev) => {
                  const isOn = dev.status === 'ON';
                  return (
                    <TouchableOpacity
                      key={dev.id}
                      onPress={() => toggleDevice(dev.id)}
                      style={[
                        styles.devButton,
                        isOn ? styles.devButtonOn : styles.devButtonOff,
                      ]}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.rowAlign, { flex: 1, minWidth: 0, marginRight: 8 }]}>
                        <View style={styles.devIconCircle}>
                          <Icon
                            name={dev.category === 'fans' ? 'mode_fan' : dev.category === 'ac' ? 'ac_unit' : 'lightbulb'}
                            size={20}
                            color={isOn ? '#FFFFFF' : colors.textSecondary}
                          />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.devBtnTitle, isOn && { color: '#FFFFFF' }]} numberOfLines={1}>
                            {dev.name}
                          </Text>
                          <Text style={[styles.devBtnSub, isOn && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
                            {dev.category === 'fans' ? `Speed ${dev.speedLevel || 2} (Cooling)` : dev.category === 'ac' ? '24°C Climate' : 'Bright (80%)'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.onOffBadge, isOn ? styles.onOffBadgeOn : styles.onOffBadgeOff]}>
                        <Text style={[styles.onOffText, isOn ? { color: colors.primary } : { color: colors.textSecondary }]}>
                          {isOn ? 'ON' : 'OFF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.rowAlign}>
              <Icon
                name={occ.isOccupied ? 'verified' : 'eco'}
                size={18}
                color={occ.isOccupied ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.automationSummaryText}>
                {occ.isOccupied
                  ? 'Auto-turned ON because occupants were detected in this zone.'
                  : 'Auto-shut off (Sleeping) to conserve electricity while vacant.'}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Guided Setup Wizard Modal */}
      <Modal visible={isSetupWizardOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.rowAlign}>
                <View style={styles.wizardCircle}>
                  <Icon name="auto_fix_high" size={24} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Camera Zone Setup Wizard</Text>
                  <Text style={styles.modalSub}>Step {wizardStep} of 2</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsSetupWizardOpen(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.wizardContent}>
              <Text style={styles.templateTitle}>Choose a Layout Template:</Text>

              <TouchableOpacity
                onPress={() => setWizardSelectedTemplate('two_halves')}
                style={[
                  styles.templateCard,
                  wizardSelectedTemplate === 'two_halves' && styles.templateCardActive,
                ]}
              >
                <View style={styles.rowAlign}>
                  <Icon name="splitscreen_vertical" size={24} color={colors.primary} />
                  <View>
                    <Text style={styles.templateName}>Two Halves (Recommended)</Text>
                    <Text style={styles.templateSub}>Study Desks Area + Presentation Board</Text>
                  </View>
                </View>
                <Icon
                  name={wizardSelectedTemplate === 'two_halves' ? 'check_circle' : 'circle'}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setWizardSelectedTemplate('quadrants')}
                style={[
                  styles.templateCard,
                  wizardSelectedTemplate === 'quadrants' && styles.templateCardActive,
                ]}
              >
                <View style={styles.rowAlign}>
                  <Icon name="grid_view" size={24} color={colors.primary} />
                  <View>
                    <Text style={styles.templateName}>Four Quadrants Grid</Text>
                    <Text style={styles.templateSub}>For large classrooms and open lecture spaces</Text>
                  </View>
                </View>
                <Icon
                  name={wizardSelectedTemplate === 'quadrants' ? 'check_circle' : 'circle'}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.wizardActionRow}>
              <TouchableOpacity
                onPress={() => setIsSetupWizardOpen(false)}
                style={styles.cancelWizardBtn}
              >
                <Text style={styles.cancelWizardText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleApplyWizardTemplate}
                style={styles.applyWizardBtn}
              >
                <Text style={styles.applyWizardText}>Finish & Apply</Text>
                <Icon name="check" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 24,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowAlignCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceYellow,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(159, 104, 0, 0.2)',
  },
  lightCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  boldText: {
    fontWeight: '800',
  },
  explainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  explainText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 14,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  roomSelectCol: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  selectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  selectText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  camRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  camBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 999,
    gap: 4,
  },
  camBtnActive: {
    backgroundColor: colors.primary,
  },
  camBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  camBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 229, 216, 0.5)',
    paddingTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  yoloPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  pingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  yoloText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  straightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfacePeach,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  straightText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.tertiary,
  },
  camControlsContainer: {
    gap: 8,
    width: '100%',
  },
  camHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activeZoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  activeZoneLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  zoneChip: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  zoneChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  camToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 5,
  },
  camToggleBtnOn: {
    backgroundColor: colors.primary,
  },
  camToggleBtnOff: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  camToggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  camToggleBtnTextOn: {
    color: '#FFFFFF',
  },
  camToggleBtnTextOff: {
    color: '#BA1A1A',
  },
  camSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  frameIntervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  smallToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  smallToggleActive: {
    backgroundColor: colors.primary,
  },
  smallToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  smallToggleTextActive: {
    color: '#FFFFFF',
  },
  videoFrame: {
    width: '100%',
    maxWidth: '100%',
    height: 250,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0e1f16',
    position: 'relative',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    zIndex: 20,
  },
  redPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 18,
    padding: 6,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  toolBtnActive: {
    backgroundColor: colors.primary,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  toolBtnTextActive: {
    color: '#FFFFFF',
  },
  wizardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceYellow,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  wizardBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.tertiary,
  },
  iconToolBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconToolBtnDisabled: {
    opacity: 0.5,
  },
  resetBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderRadius: 16,
    padding: 10,
  },
  simulatorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  addPersonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  addPersonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  clearPersonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  clearPersonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
  },
  zoneColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  zoneNameInput: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 120,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },
  occupancyStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  occupancyStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deleteZoneBtn: {
    padding: 4,
  },
  settingLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  colorCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  colorCircleActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  splitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  splitBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  fixtureSection: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 229, 216, 0.5)',
    paddingTop: 10,
  },
  fixtureTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fixtureCount: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  fixtureGrid: {
    gap: 6,
  },
  fixtureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  fixtureItemAssigned: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primaryContainer,
  },
  fixtureName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fixturePower: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  autoSyncBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  zoneDotRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneDotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneSummaryName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyNotice: {
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  emptyNoticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  devsGrid: {
    gap: 8,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    padding: 12,
  },
  devButtonOn: {
    backgroundColor: colors.primaryContainer,
  },
  devButtonOff: {
    backgroundColor: colors.surfaceContainerLow,
  },
  devIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  devBtnSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  onOffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  onOffBadgeOn: {
    backgroundColor: '#FFFFFF',
  },
  onOffBadgeOff: {
    backgroundColor: '#FFFFFF',
  },
  onOffText: {
    fontSize: 12,
    fontWeight: '900',
  },
  automationSummaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: 10,
  },
  wizardCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  wizardContent: {
    gap: 10,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardActive: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  templateSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  wizardActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelWizardBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelWizardText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  applyWizardBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  applyWizardText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
