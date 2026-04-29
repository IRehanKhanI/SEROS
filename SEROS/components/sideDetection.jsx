import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ScreenOrientation from "expo-screen-orientation";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const BACKEND_URL = "http://10.1.12.187:8000/api/detect/"; // ⚠️ UPDATE THIS IP
const CAPTURE_MS = 300;
const IMAGE_QUALITY = 0.45;
const REQUEST_TIMEOUT_MS = 3000;
// ──────────────────────────────────────────────────────────────────────────────

const PANEL_W = 220;

// Colour palette
const C = {
  bg: "#0a0f1e",
  card: "#111827",
  border: "#1f2937",
  green: "#10b981",
  red: "#ef4444",
  yellow: "#f59e0b",
  blue: "#3b82f6",
  textPri: "#f9fafb",
  textSec: "#9ca3af",
  dim: "#374151",
};

// ─── STATUS BADGE ──────────────────────────────────────────────────────────────
function Badge({ value, onColor = C.green, offColor = C.dim, label }) {
  const active =
    value === "ON" ||
    value === true ||
    (typeof value === "string" &&
      value !== "OFF" &&
      value !== "-" &&
      value !== "None");
  return (
    <View style={[styles.badge, { borderColor: active ? onColor : offColor }]}>
      <View
        style={[
          styles.badgeDot,
          { backgroundColor: active ? onColor : offColor },
        ]}
      />
      <Text style={[styles.badgeText, { color: active ? onColor : C.textSec }]}>
        {label ? <Text style={styles.badgeLabel}>{label} </Text> : null}
        {value}
      </Text>
    </View>
  );
}

// ─── FAN INDICATOR ─────────────────────────────────────────────────────────────
function FanBar({ leftOn, rightOn }) {
  return (
    <View style={styles.fanBar}>
      <View style={[styles.fanSide, { borderColor: leftOn ? C.green : C.dim }]}>
        <Text style={[styles.fanIcon, { color: leftOn ? C.green : C.dim }]}>
          ⟳
        </Text>
        <Text style={[styles.fanLabel, { color: leftOn ? C.green : C.dim }]}>
          LEFT FAN
        </Text>
        <Text style={[styles.fanState, { color: leftOn ? C.green : C.dim }]}>
          {leftOn ? "ON" : "OFF"}
        </Text>
      </View>

      <View style={styles.fanDivider} />

      <View
        style={[styles.fanSide, { borderColor: rightOn ? C.green : C.dim }]}
      >
        <Text style={[styles.fanIcon, { color: rightOn ? C.green : C.dim }]}>
          ⟳
        </Text>
        <Text style={[styles.fanLabel, { color: rightOn ? C.green : C.dim }]}>
          RIGHT FAN
        </Text>
        <Text style={[styles.fanState, { color: rightOn ? C.green : C.dim }]}>
          {rightOn ? "ON" : "OFF"}
        </Text>
      </View>
    </View>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function sideDetection() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const isSending = useRef(false);

  const abortCtrlRef = useRef(null);

  const [facing, setFacing] = useState("back");
  const [status, setStatus] = useState("Initialising…");
  const [position, setPosition] = useState("-");
  const [light, setLight] = useState("OFF");
  const [fanLeft, setFanLeft] = useState(false);
  const [fanRight, setFanRight] = useState(false);
  const [fps, setFps] = useState("--");
  const [latency, setLatency] = useState("--");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [screenSize, setScreenSize] = useState(Dimensions.get("window"));
  const lastSendTime = useRef(Date.now());

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

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
    if (!cameraRef.current || isSending.current) return;
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
        base64: true,
        quality: IMAGE_QUALITY,
        skipProcessing: true,
        exif: false,
      });

      const now = Date.now();
      const delta = now - lastSendTime.current;
      lastSendTime.current = now;
      setFps((1000 / delta).toFixed(1));

      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo.base64 }),
        signal: controller.signal,
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
      } else {
        setStatus("Room Empty");
        setPosition("-");
        setLight("OFF");
        setFanLeft(false);
        setFanRight(false);
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        const start = Date.now();
        await captureAndSend();
        const elapsed = Date.now() - start;
        const wait = Math.max(0, CAPTURE_MS - elapsed);
        await new Promise((res) => setTimeout(res, wait));
      }
    };

    loop();
    return () => {
      cancelled = true;
    };
  }, [captureAndSend]);

  const cameraAreaWidth = screenSize.width - PANEL_W;
  const centerLineLeft = cameraAreaWidth / 2;

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
        <Text style={styles.permText}>📷 Camera access needed</Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
      />

      <View style={[styles.centerLine, { left: centerLineLeft }]} />

      <Text
        style={[
          styles.zoneLabel,
          { left: centerLineLeft / 2 - 30, top: "50%" },
        ]}
      >
        LEFT
      </Text>
      <Text
        style={[
          styles.zoneLabel,
          { left: centerLineLeft + centerLineLeft / 2 - 35, top: "50%" },
        ]}
      >
        RIGHT
      </Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>⚡ SmartRoom</Text>
        <Text style={styles.panelSub}>AI Energy Optimiser</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>DETECTION</Text>
        <Badge
          value={status}
          onColor={status === "Person Detected" ? C.green : C.red}
        />

        <View style={{ height: 8 }} />

        <Text style={styles.sectionLabel}>POSITION</Text>
        <Badge value={position === "-" ? "None" : position} onColor={C.blue} />

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>LIGHT</Text>
        <Badge value={light} onColor={C.yellow} />

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
          <Text style={styles.errorText} numberOfLines={2}>
            ⚠ {error}
          </Text>
        )}

        <TouchableOpacity
          style={styles.flipBtn}
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
        >
          <Text style={styles.flipBtnText}>🔄 Flip Camera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: C.bg,
  },
  centerLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  zoneLabel: {
    position: "absolute",
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  panel: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_W,
    backgroundColor: "rgba(10,15,30,0.90)",
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: "flex-start",
  },
  panelTitle: {
    color: C.textPri,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  panelSub: {
    color: C.textSec,
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 10,
  },
  sectionLabel: {
    color: C.textSec,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 5,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  badgeLabel: {
    fontWeight: "400",
    fontSize: 11,
  },
  fanBar: {
    flexDirection: "row",
  },
  fanSide: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
  },
  fanDivider: {
    width: 6,
  },
  fanIcon: {
    fontSize: 22,
  },
  fanLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  fanState: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    flexWrap: "wrap",
    gap: 4,
  },
  metaText: {
    color: C.textSec,
    fontSize: 10,
  },
  errorText: {
    color: C.red,
    fontSize: 10,
    marginTop: 4,
  },
  flipBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: "center",
  },
  flipBtnText: {
    color: C.textSec,
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.bg,
  },
  permText: {
    color: C.textPri,
    fontSize: 18,
    marginBottom: 20,
  },
  grantBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  grantBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
