import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ScreenOrientation from "expo-screen-orientation";
import Ionicons from "@expo/vector-icons/Ionicons";

import { BACKEND_URL, CAPTURE_MS, IMAGE_QUALITY, REQUEST_TIMEOUT_MS } from "../constants/config";
import { C } from "../constants/theme";
import Badge from "../components/Badge";
import FanBar from "../components/FanBar";

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef  = useRef(null);
  const isSending  = useRef(false);

  const abortCtrlRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(true);
  const [facing,   setFacing]   = useState("back");
  const [status,   setStatus]   = useState("Waiting for camera...");
  const [position, setPosition] = useState("-");
  const [light,    setLight]    = useState("OFF");
  const [fanLeft,  setFanLeft]  = useState(false);
  const [fanRight, setFanRight] = useState(false);
  const [personsCoords, setPersonsCoords] = useState([]);
  const [fps,      setFps]      = useState("--");
  const [latency,  setLatency]  = useState("--");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const [screenSize, setScreenSize] = useState(Dimensions.get("window"));
  const [cameraLayout, setCameraLayout] = useState({ width: Dimensions.get("window").width, height: 300 });
  const lastSendTime = useRef(Date.now());

  useEffect(() => {
    // Lock to portrait to keep everything vertical
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setScreenSize(window);
    });

    const t = setTimeout(() => setScreenSize(Dimensions.get("window")), 300);

    return () => {
      ScreenOrientation.unlockAsync();
      sub?.remove();
      clearTimeout(t);
    };
  }, []);

  const captureAndSend = useCallback(async () => {
    if (!isCameraActive || !cameraRef.current || isSending.current) return;
    isSending.current = true;
    setLoading(true);

    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    const controller = new AbortController();
    abortCtrlRef.current = controller;

    const t0 = Date.now();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64:         true,
        quality:        IMAGE_QUALITY,
        skipProcessing: false, // Must be false so Expo rotates the image correctly on Android
        exif:           false,
      });

      const now   = Date.now();
      const delta = now - lastSendTime.current;
      lastSendTime.current = now;
      setFps((1000 / delta).toFixed(1));

      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(`${BACKEND_URL}/api/detect/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: photo.base64 }),
        signal:  controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setLatency(`${Date.now() - t0}ms`);

      const pos = (data.position ?? "").toString().trim().toLowerCase();

      if (data.people > 0) {
        setStatus("Person Detected");

        if (pos === "left") {
          setPosition("LEFT");
          setFanLeft(true);
          setFanRight(false);
        } else if (pos === "right") {
          setPosition("RIGHT");
          setFanLeft(false);
          setFanRight(true);
        } else if (pos === "both") {
          setPosition("BOTH ZONES");
          setFanLeft(true);
          setFanRight(true);
        } else {
          setPosition(pos.toUpperCase() || "DETECTED");
          setFanLeft(!!data.fan_left);
          setFanRight(!!data.fan_right);
        }

        setLight("ON");
        setPersonsCoords(data.persons || []);
      } else {
        setStatus("Room Empty");
        setPosition("-");
        setLight("OFF");
        setFanLeft(false);
        setFanRight(false);
        setPersonsCoords([]);
      }
      setError(null);

    } catch (err) {
      if (err.name === "AbortError") {
        setError(`Timeout (>${REQUEST_TIMEOUT_MS}ms)`);
      } else {
        setError(err.message || "Network error");
      }
    } finally {
      isSending.current = false;
      setLoading(false);
    }
  }, [isCameraActive]);

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        if (isCameraActive) {
          const start = Date.now();
          await captureAndSend();
          const elapsed = Date.now() - start;
          const wait = Math.max(0, CAPTURE_MS - elapsed); 
          await new Promise(res => setTimeout(res, wait));
        } else {
          // If inactive, just wait a bit before checking again
          await new Promise(res => setTimeout(res, 500));
        }
      }
    };

    loop();
    return () => { cancelled = true; };
  }, [captureAndSend, isCameraActive]);

  const toggleCamera = () => {
    setIsCameraActive((prev) => {
      const nextState = !prev;
      if (!nextState && abortCtrlRef.current) {
        abortCtrlRef.current.abort(); // Instantly kill any pending backend request
      }
      return nextState;
    });
    if (isCameraActive) {
      setStatus("Camera Paused");
      setFps("--");
      setLatency("--");
    } else {
      setStatus("Initialising…");
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>📷  Camera access needed</Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Top Half: Camera */}
      <View 
        style={styles.cameraContainer} 
        onLayout={(e) => setCameraLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {isCameraActive ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
          />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Ionicons name="videocam-off" size={48} color={C.textSec} />
            <Text style={styles.cameraPlaceholderText}>Camera is OFF</Text>
          </View>
        )}
        
        {/* Show live person coordinates as dots */}
        {isCameraActive && personsCoords.map((p, idx) => {
          // If front camera, invert X because the preview is mirrored
          const mappedX = facing === "front" ? (1 - p.x) : p.x;
          return (
            <View
              key={idx}
              style={[
                styles.personDot,
                { left: mappedX * cameraLayout.width, top: p.y * cameraLayout.height } 
              ]}
            />
          );
        })}

        {/* Only show split line if camera is active */}
        {isCameraActive && (
          <>
            <View style={[styles.centerLine, { left: screenSize.width / 2 }]} />
            <Text style={[styles.zoneLabel, { left: screenSize.width / 4 - 20, top: "50%" }]}>LEFT</Text>
            <Text style={[styles.zoneLabel, { left: screenSize.width * 0.75 - 20, top: "50%" }]}>RIGHT</Text>
          </>
        )}
      </View>

      {/* Bottom Half: Control Panel */}
      <ScrollView style={styles.panelContainer}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.panelTitle}>⚡ SmartRoom</Text>
            <Text style={styles.panelSub}>AI Energy Optimiser</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.toggleBtn, { backgroundColor: isCameraActive ? C.red : C.green }]}
            onPress={toggleCamera}
          >
            <Text style={styles.toggleBtnText}>
              {isCameraActive ? "Stop Camera" : "Start Camera"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statsBox}>
            <Text style={styles.sectionLabel}>DETECTION</Text>
            <Badge value={status} onColor={status === "Person Detected" ? C.green : (isCameraActive ? C.red : C.dim)} />
          </View>
          <View style={styles.statsBox}>
            <Text style={styles.sectionLabel}>POSITION</Text>
            <Badge value={position === "-" ? "None" : position} onColor={C.blue} />
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>LIGHT</Text>
        <Badge value={light} onColor={C.yellow} />

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>DETECTED COORDINATES</Text>
        {personsCoords.length > 0 ? (
          personsCoords.map((p, idx) => (
            <Text key={idx} style={styles.coordText}>
              Person {idx + 1}: X: {p.x.toFixed(2)}, Y: {p.y.toFixed(2)}
            </Text>
          ))
        ) : (
          <Text style={styles.coordText}>No targets</Text>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>FANS</Text>
        <FanBar leftOn={fanLeft} rightOn={fanRight} />

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>🔄 {fps} fps</Text>
          <Text style={styles.metaText}>⏱ {latency}</Text>
          {loading && <ActivityIndicator size="small" color={C.green} />}
        </View>

        {error && (
          <Text style={styles.errorText} numberOfLines={2}>⚠ {error}</Text>
        )}

        <TouchableOpacity
          style={styles.flipBtn}
          onPress={() => setFacing(f => (f === "back" ? "front" : "back"))}
        >
          <Text style={styles.flipBtnText}>🔄 Flip Camera</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  root: {
    flex:            1,
    flexDirection:   "column",
    backgroundColor: C.bg,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    minHeight: 300,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  cameraPlaceholderText: {
    color: C.textSec,
    marginTop: 10,
    fontSize: 16,
    fontWeight: "600",
  },
  personDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -10,
    marginTop: -10,
  },
  centerLine: {
    position:        "absolute",
    top:             0,
    bottom:          0,
    width:           2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  zoneLabel: {
    position:   "absolute",
    color:      "rgba(255,255,255,0.8)",
    fontSize:   14,
    fontWeight: "800",
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10
  },
  panelContainer: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    color:         C.textPri,
    fontSize:      22,
    fontWeight:    "700",
    letterSpacing: 0.5,
  },
  panelSub: {
    color:     C.textSec,
    fontSize:  13,
    marginTop: 2,
  },
  coordText: {
    color: C.textPri,
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
    fontFamily: "monospace",
  },
  toggleBtn: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  toggleBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  divider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statsBox: {
    flex: 1,
    marginRight: 10,
  },
  sectionLabel: {
    color:         C.textSec,
    fontSize:      11,
    fontWeight:    "700",
    letterSpacing: 2,
    marginBottom:  8,
  },

  metaRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   8,
    marginTop:      5,
    flexWrap:       "wrap",
    gap:            4,
  },
  metaText: {
    color:    C.textSec,
    fontSize: 12,
  },
  errorText: {
    color:    C.red,
    fontSize: 12,
    marginTop: 6,
  },
  flipBtn: {
    marginTop:       15,
    marginBottom:    40,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    7,
    paddingVertical: 12,
    alignItems:      "center",
  },
  flipBtnText: {
    color:    C.textPri,
    fontSize: 14,
    fontWeight: "600"
  },
  center: {
    flex:            1,
    justifyContent:  "center",
    alignItems:      "center",
    backgroundColor: C.bg,
  },
  permText: {
    color:        C.textPri,
    fontSize:     18,
    marginBottom: 20,
  },
  grantBtn: {
    backgroundColor:   C.green,
    paddingHorizontal: 28,
    paddingVertical:   12,
    borderRadius:      8,
  },
  grantBtnText: {
    color:      "#fff",
    fontWeight: "700",
    fontSize:   15,
  },
});
