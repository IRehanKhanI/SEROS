import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { BarChart, PieChart } from "react-native-chart-kit";
import { BACKEND_URL } from "../constants/config";

const screenWidth = Dimensions.get("window").width;

// const { width } = Dimensions.get("window");

// --- INDUSTRIAL THEME & DATA ---
const theme = {
  amber: "#C58A16",
  yg: "#168A4A",
  scarlet: "#C43D4B",
  bg: "#F3F2EE",
  text: "#26332F",
  textPri: "#26332F",
  textSec: "#26332F",
  textMuted: "#26332F",
  card: "#E8EEE8",
  glassBg: "#E8EEE8",
  border: "#B9C9BB",
  glassHighlight: "#F0F4EE",
};

const devicesData = [
  {
    name: "Interactive Whiteboards",
    zone: "Classrooms",
    power: 0.65,
    hoursToday: 7.2,
    total: 4.68,
  },
  {
    name: "Desktop PCs (Cluster A)",
    zone: "Library",
    power: 0.18,
    hoursToday: 8.1,
    total: 1.46,
  },
  {
    name: "Desktop PCs (Cluster B)",
    zone: "ICT Suite",
    power: 0.18,
    hoursToday: 9.0,
    total: 1.62,
  },
  {
    name: "Science Lab Equipment",
    zone: "Science Block",
    power: 2.4,
    hoursToday: 4.5,
    total: 10.8,
  },
  {
    name: "HVAC Unit — Gym",
    zone: "Gym",
    power: 5.5,
    hoursToday: 11.2,
    total: 61.6,
  },
  {
    name: "Canteen Appliances",
    zone: "Canteen",
    power: 8.2,
    hoursToday: 3.0,
    total: 24.6,
  },
  {
    name: "Server Room",
    zone: "Admin",
    power: 3.1,
    hoursToday: 18.0,
    total: 55.8,
  },
  {
    name: "LED Lighting (All)",
    zone: "School-wide",
    power: 1.2,
    hoursToday: 9.5,
    total: 11.4,
  },
];

const hourDataSets = [
  [
    0.2, 0.15, 0.1, 0.1, 0.12, 0.15, 0.5, 2.8, 6.2, 7.1, 7.8, 6.9, 3.2, 7.4,
    8.1, 7.9, 5.2, 2.8, 1.4, 0.9, 0.7, 0.5, 0.4, 0.3,
  ],
  [
    0.15, 0.1, 0.1, 0.1, 0.1, 0.1, 0.4, 2.5, 5.9, 7.0, 7.5, 6.6, 3.0, 7.1, 7.9,
    7.6, 5.0, 2.6, 1.2, 0.8, 0.6, 0.4, 0.3, 0.2,
  ],
];

// --- MAIN COMPONENT ---
export default function SerosDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [backendData, setBackendData] = useState(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/analytics/`);
        const json = await res.json();
        if (json.status === "success") {
          setBackendData(json);
        }
      } catch (e) {
        console.log("Analytics fetch error:", e);
      }
    };
    fetchData();
    const intv = setInterval(fetchData, 5000);
    return () => clearInterval(intv);
  }, []);

  return (
    <View style={styles.container}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.logoTitle}>SEROS</Text>
          <Text style={styles.logoSub}>ENERGY OPERATIONS</Text>
        </View>
        <View style={styles.statusWrap}>
          <View style={styles.pulse} />
          <Text style={styles.statusText}>SYSTEM OK / LIVE DATA</Text>
        </View>
      </View>

      {/* Navigation (Horizontal for Mobile) */}
      <View style={styles.navContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navScroll}
        >
          {[
            "overview",
            "analytics",
            "predict",
            "assistant",
            "devices",
            "heatmap",
            "calculator",
          ].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.navItem,
                activeTab === tab && styles.navItemActive,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.navText,
                  activeTab === tab && styles.navTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.mainContent}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {activeTab === "overview" && <OverviewTab backendData={backendData} />}
        {activeTab === "analytics" && (
          <AnalyticsTab backendData={backendData} />
        )}
        {activeTab === "predict" && <PredictTab />}
        {activeTab === "assistant" && <AssistantTab />}
        {activeTab === "devices" && <DevicesTab />}
        {activeTab === "heatmap" && <HeatmapTab />}
        {activeTab === "calculator" && <CalculatorTab />}
      </ScrollView>
    </View>
  );
}

// --- SUB-VIEWS (TABS) ---

function AssistantTab() {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      content:
        "Hello! I am Gemma, your SEROS Energy Assistant. You can ask me about energy spikes, cost-saving estimates, or anomaly reports.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg }),
      });
      const data = await response.json();

      if (data.status === "success") {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: data.response },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: `Error: ${data.message}` },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `Network Error: Could not reach backend.` },
      ]);
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Operations Assistant</Text>
        <Text style={styles.pageSub}>
          Query the energy system for operational context
        </Text>
      </View>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.glassHighlight,
          borderRadius: 12,
          padding: 10,
          minHeight: 300,
          marginBottom: 16,
        }}
      >
        <ScrollView style={{ flex: 1 }}>
          {messages.map((msg, idx) => (
            <View
              key={idx}
              style={{
                alignSelf: msg.role === "ai" ? "flex-start" : "flex-end",
                backgroundColor: msg.role === "ai" ? "#E7F2E8" : "#E8EEF1",
                borderWidth: 1,
                borderColor: msg.role === "ai" ? theme.yg : theme.border,
                padding: 12,
                borderRadius: 8,
                marginBottom: 10,
                maxWidth: "85%",
              }}
            >
              <Text style={{ color: theme.text }}>{msg.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={{ alignSelf: "flex-start", padding: 12 }}>
              <ActivityIndicator color={theme.yg} />
            </View>
          )}
        </ScrollView>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              color: theme.text,
              height: 44,
            }}
            placeholder="Ask Gemma about energy usage..."
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={{
              backgroundColor: theme.amber,
              justifyContent: "center",
              paddingHorizontal: 16,
              borderRadius: 8,
              marginLeft: 10,
            }}
            onPress={sendMessage}
          >
            <Text style={{ color: theme.bg, fontWeight: "bold" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function OverviewTab({ backendData }) {
  const [day, setDay] = useState(0);

  const liveDraw = backendData?.live_power_draw_watts || 0;
  const activeCount = backendData?.active_devices?.length || 0;
  const totalKwh = backendData?.total_kwh_consumed || 0;
  const rsSaved = backendData?.rs_saved || 0;
  const hoursUnused = backendData?.hours_unused || 0;

  const chartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"],
    datasets: [{ data: backendData?.daily_kwh || [0, 0, 0, 0, 0, 0, 0] }],
  };

  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Energy Overview</Text>
        <Text style={styles.pageSub}>Live Device Data + Scaled Baseline</Text>
      </View>

      {/* Data source indicator */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginBottom: 12,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.yg,
              marginRight: 4,
            }}
          />
          <Text style={{ color: theme.textMuted, fontSize: 10 }}>
            LIVE (Camera AI)
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.amber,
              marginRight: 4,
            }}
          />
          <Text style={{ color: theme.textMuted, fontSize: 10 }}>
            BASELINE (Scaled)
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#6366f1",
              marginRight: 4,
            }}
          />
          <Text style={{ color: theme.textMuted, fontSize: 10 }}>
            KAGGLE (Historical)
          </Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard
          label="Total Consumed"
          val={`${totalKwh.toFixed(2)} kWh`}
          color={theme.amber}
          sub="baseline + live"
          subColor={theme.textMuted}
        />
        <MetricCard
          label="Live Power Draw"
          val={`${liveDraw} W`}
          color={liveDraw > 0 ? theme.scarlet : theme.textMuted}
          sub={liveDraw > 0 ? "Camera ON" : "Camera OFF"}
          subColor={liveDraw > 0 ? theme.scarlet : theme.textMuted}
        />
        <MetricCard
          label="Active Devices"
          val={`${activeCount} / 4`}
          color={theme.yg}
          sub="2 fans + 2 lights"
          subColor={theme.textMuted}
        />
        <MetricCard
          label="Total Cost"
          val={`\u20b9${backendData?.total_cost_rs?.toFixed(2) || "0.00"}`}
          color={theme.text}
        />
        <MetricCard
          label="Total Saved"
          val={`\u20b9${rsSaved.toFixed(2)}`}
          color={theme.yg}
          sub={`${hoursUnused.toFixed(1)} hrs unused`}
          subColor={theme.yg}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Consumption (kWh)</Text>
        <Text style={{ color: theme.textMuted, fontSize: 10, marginBottom: 4 }}>
          Source: Live device sessions + baseline
        </Text>
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <BarChart
            data={chartData}
            width={screenWidth - 60}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
            chartConfig={{
              backgroundColor: theme.card,
              backgroundGradientFrom: theme.glassBg,
              backgroundGradientTo: theme.bg,
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(255, 159, 28, ${opacity})`,
              labelColor: (opacity = 1) => theme.textMuted,
              style: { borderRadius: 16 },
            }}
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        </View>
      </View>
    </View>
  );
}

function AnalyticsTab({ backendData }) {
  const pieColors = [theme.yg, theme.amber, "#6366f1", theme.scarlet];
  const pieData =
    backendData?.device_breakdown?.map((dev, idx) => ({
      name: `${dev.name} (${dev.kwh.toFixed(2)} kWh)`,
      population: parseFloat(dev.kwh.toFixed(2)),
      color: pieColors[idx % pieColors.length],
      legendFontColor: theme.textMuted,
      legendFontSize: 11,
    })) || [];

  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Deep Analytics</Text>
        <Text style={styles.pageSub}>
          Device breakdown with data source labels
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Efficiency Breakdown</Text>
        <Text style={{ color: theme.textMuted, fontSize: 10, marginBottom: 4 }}>
          Source: Live sessions + baseline estimates
        </Text>

        {pieData.length > 0 ? (
          <View style={{ alignItems: "center", marginTop: 15 }}>
            <PieChart
              data={pieData}
              width={screenWidth - 60}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              }}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              center={[10, 0]}
              absolute
            />
          </View>
        ) : (
          <Text
            style={{
              color: theme.textMuted,
              marginTop: 20,
              textAlign: "center",
            }}
          >
            No device data logged yet. Let the camera run to gather data!
          </Text>
        )}

        {/* Device detail list with source tags */}
        <View style={{ marginTop: 16 }}>
          {backendData?.device_breakdown?.map((dev, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderColor: theme.border,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: pieColors[idx % pieColors.length],
                    marginRight: 8,
                  }}
                />
                <Text style={{ color: theme.text, fontSize: 13 }}>
                  {dev.name}
                </Text>
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {dev.kwh.toFixed(2)} kWh
              </Text>
              <View
                style={{
                  backgroundColor:
                    dev.source === "live" ? "#E7F2E8" : "#F2EBD9",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{
                    color: dev.source === "live" ? theme.yg : theme.amber,
                    fontSize: 9,
                    fontWeight: "bold",
                  }}
                >
                  {dev.source === "live" ? "LIVE" : "BASE"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { marginTop: 20 }]}>
        <Text style={styles.cardTitle}>Live Database Logs</Text>
        <View style={styles.insightList}>
          {backendData?.active_devices?.map((dev, idx) => (
            <Insight
              key={idx}
              type="warn"
              label="ACTIVE"
              text={`${dev.name} is currently running (${dev.power_watts}W)`}
              fill="100%"
            />
          ))}
          {backendData?.active_devices?.length === 0 && (
            <Insight
              type="alert"
              label="SYSTEM IDLE"
              text="All devices are currently powered off. Saving energy!"
              fill="0%"
            />
          )}
        </View>
      </View>
    </View>
  );
}

function PredictTab() {
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState(null); // "gemini" | "ml"
  const [predictions, setPredictions] = useState(null);
  const [totalCost, setTotalCost] = useState(null);
  const [modelName, setModelName] = useState("");
  const [histData, setHistData] = useState(null);

  // Fetch historical data on mount
  React.useEffect(() => {
    const fetchHist = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/historical-usage/`);
        const json = await res.json();
        if (json.status === "success") setHistData(json);
      } catch (e) {
        console.log("Historical fetch err:", e);
      }
    };
    fetchHist();
  }, []);

  const runGemini = async () => {
    setLoading(true);
    setActiveModel("gemini");
    try {
      const histArr = [
        45.2, 48.1, 46.5, 47.0, 42.1, 12.5, 10.8, 46.3, 49.2, 47.8, 48.5, 45.9,
        13.1, 11.2,
      ];
      const response = await fetch(`${BACKEND_URL}/api/predict/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: histArr }),
      });
      const data = await response.json();
      if (data.status === "success") {
        setPredictions(data.predictions);
        setTotalCost(data.total_cost);
        setModelName("Gemini 3 Flash");
      } else {
        alert("Error: " + data.message);
      }
    } catch (e) {
      alert("Network Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runML = async () => {
    setLoading(true);
    setActiveModel("ml");
    try {
      const response = await fetch(`${BACKEND_URL}/api/ml-predict/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: 32, humidity: 55, occupancy: 20 }),
      });
      const data = await response.json();
      if (data.status === "success") {
        setPredictions(data.predictions);
        setTotalCost(data.total_cost);
        setModelName(data.model || "RandomForest");
      } else {
        alert("Error: " + data.message);
      }
    } catch (e) {
      alert("Network Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Prepare historical chart
  const histChartData = histData
    ? {
        labels: histData.data.slice(-7).map((d) => d.date.slice(5)),
        datasets: [{ data: histData.data.slice(-7).map((d) => d.kwh) }],
      }
    : null;

  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>AI Predictions</Text>
        <Text style={styles.pageSub}>electricity Prediction Model</Text>
      </View>

      {/* Historical Baseline Chart */}
      {histChartData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            30-Day Historical Baseline (Kaggle Dataset)
          </Text>
          <Text
            style={{ color: theme.textMuted, fontSize: 11, marginBottom: 10 }}
          >
            {histData.days} days | {histData.total_kwh} kWh total
          </Text>
          <BarChart
            data={histChartData}
            width={screenWidth - 60}
            height={180}
            fromZero
            chartConfig={{
              backgroundGradientFrom: theme.bg,
              backgroundGradientTo: theme.bg,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(159, 211, 86, ${opacity})`,
              labelColor: () => theme.textMuted,
              barPercentage: 0.7,
            }}
            style={{ borderRadius: 8 }}
          />
        </View>
      )}

      {/* Two Prediction Buttons */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <TouchableOpacity
          style={[
            styles.aiButton,
            {
              flex: 1,
              backgroundColor:
                activeModel === "gemini" ? theme.amber : theme.glassBg,
            },
          ]}
          onPress={runGemini}
          disabled={loading}
        >
          <Text
            style={[
              styles.aiButtonText,
              { color: activeModel === "gemini" ? theme.bg : theme.text },
            ]}
          >
            Ai
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.aiButton,
            {
              flex: 1,
              backgroundColor: activeModel === "ml" ? theme.yg : theme.glassBg,
            },
          ]}
          onPress={runML}
          disabled={loading}
        >
          <Text
            style={[
              styles.aiButtonText,
              { color: activeModel === "ml" ? theme.bg : theme.text },
            ]}
          >
            ML Model
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.yg} />
          <Text style={styles.loadingText}>
            {activeModel === "gemini"
              ? "Running Model...."
              : "Running Model..."}
          </Text>
        </View>
      )}

      {predictions && (
        <View style={{ marginTop: 10 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  activeModel === "gemini" ? theme.amber : theme.yg,
                marginRight: 8,
              }}
            />
            <Text
              style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}
            >
              Model: {modelName}
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              label="Tomorrow"
              val={`${predictions[0]?.predicted_kwh || 0} kWh`}
              color={theme.amber}
            />
            <MetricCard
              label="Week Total"
              val={`\u20b9${totalCost || 0}`}
              color={theme.yg}
            />
          </View>

          <View
            style={[
              styles.card,
              {
                borderColor: activeModel === "gemini" ? theme.amber : theme.yg,
                backgroundColor: theme.glassHighlight,
              },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                { color: activeModel === "gemini" ? theme.amber : theme.yg },
              ]}
            >
              7-Day Breakdown
            </Text>
            {predictions.map((p, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text style={{ color: theme.text }}>
                  {p.day_name || `Day ${p.day_index}`}
                </Text>
                <Text style={{ color: theme.textMuted }}>
                  {p.predicted_kwh} kWh{" "}
                  <Text style={{ color: theme.amber }}>
                    {"\u20b9"}
                    {p.estimated_cost}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function DevicesTab() {
  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Device Inventory</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeadText, { flex: 2 }]}>
            DEVICE
          </Text>
          <Text style={[styles.tableCell, styles.tableHeadText]}>POWER</Text>
          <Text style={[styles.tableCell, styles.tableHeadText]}>USAGE</Text>
        </View>
        {devicesData.map((d, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.cellTextPrimary}>{d.name}</Text>
              <Text style={styles.cellTextSub}>{d.zone}</Text>
            </View>
            <Text style={[styles.tableCell, styles.cellTextPrimary]}>
              {d.power}kW
            </Text>
            <Text style={[styles.tableCell, styles.cellTextPrimary]}>
              {d.total.toFixed(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HeatmapTab() {
  const [histData, setHistData] = useState(null);

  React.useEffect(() => {
    const fetchHist = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/historical-usage/`);
        const json = await res.json();
        if (json.status === "success") setHistData(json);
      } catch (e) {
        console.log("Heatmap fetch err:", e);
      }
    };
    fetchHist();
  }, []);

  // Build heatmap from last 7 days of historical data
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let grid;
  if (histData && histData.data.length >= 7) {
    const last7 = histData.data.slice(-7);
    const maxKwh = Math.max(...last7.map((d) => d.kwh));
    grid = last7.map((d) => {
      // Create 12 cells (2-hour blocks) from daily data
      const baseIntensity = d.kwh / maxKwh;
      return Array.from({ length: 12 }).map((_, hi) => {
        // Working hours (blocks 4-8, i.e. 8am-4pm) are higher
        const hourFactor =
          hi >= 4 && hi <= 8 ? 0.8 : hi >= 3 && hi <= 9 ? 0.4 : 0.1;
        return Math.min(1, baseIntensity * hourFactor + Math.random() * 0.1);
      });
    });
  } else {
    grid = days.map((_, di) =>
      Array.from({ length: 12 }).map((_, hi) => {
        if (di < 5 && hi > 3 && hi < 9) return Math.random() * 0.8 + 0.2;
        return Math.random() * 0.2;
      }),
    );
  }

  const timeLabels = [
    "0",
    "2",
    "4",
    "6",
    "8",
    "10",
    "12",
    "14",
    "16",
    "18",
    "20",
    "22",
  ];

  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Usage Heatmap</Text>
        <Text style={styles.pageSub}>
          {histData
            ? `Based on ${histData.days}-day Kaggle dataset`
            : "Loading historical data..."}
        </Text>
      </View>
      <View style={styles.card}>
        {/* Time labels */}
        <View style={{ flexDirection: "row", marginLeft: 24, marginBottom: 4 }}>
          {timeLabels.map((t, i) => (
            <Text
              key={i}
              style={{
                flex: 1,
                color: theme.textMuted,
                fontSize: 8,
                textAlign: "center",
              }}
            >
              {t}
            </Text>
          ))}
        </View>
        <View style={styles.hmContainer}>
          {grid.map((dayRow, dIdx) => (
            <View key={dIdx} style={styles.hmRow}>
              <Text style={styles.hmDayLabel}>{days[dIdx]}</Text>
              {dayRow.map((val, hIdx) => (
                <View
                  key={hIdx}
                  style={[
                    styles.hmCell,
                    {
                      opacity: Math.max(0.1, val),
                      backgroundColor:
                        val > 0.6
                          ? theme.scarlet
                          : val > 0.3
                            ? theme.amber
                            : theme.yg,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
        {/* Legend */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 12,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: theme.yg,
                marginRight: 4,
              }}
            />
            <Text style={{ color: theme.textMuted, fontSize: 10 }}>Low</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: theme.amber,
                marginRight: 4,
              }}
            />
            <Text style={{ color: theme.textMuted, fontSize: 10 }}>Medium</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: theme.scarlet,
                marginRight: 4,
              }}
            />
            <Text style={{ color: theme.textMuted, fontSize: 10 }}>High</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function CalculatorTab() {
  const [units, setUnits] = useState("250");
  const [days, setDays] = useState("30");
  const [fixedCharge, setFixedCharge] = useState("45");

  const u = parseFloat(units) || 0;
  const d = parseFloat(days) || 30;
  const fc = parseFloat(fixedCharge) || 0;

  // Indian tariff slab calculation
  let energyCost = 0;
  if (u <= 100) {
    energyCost = u * 3.75;
  } else if (u <= 200) {
    energyCost = 100 * 3.75 + (u - 100) * 4.6;
  } else if (u <= 400) {
    energyCost = 100 * 3.75 + 100 * 4.6 + (u - 200) * 5.3;
  } else {
    energyCost = 100 * 3.75 + 100 * 4.6 + 200 * 5.3 + (u - 400) * 5.75;
  }

  const fixedTotal = fc * d;
  const electricityDuty = energyCost * 0.08; // 8% duty
  const total = energyCost + fixedTotal + electricityDuty;

  // Per day and per kWh
  const perDay = total / d;
  const perKwh = u > 0 ? total / u : 0;

  return (
    <View style={styles.calcPanel}>
      <Text style={styles.calcTitle}>Bill Estimator (INR)</Text>
      <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 12 }}>
        Uses Indian electricity tariff slabs
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Monthly Units (kWh)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={units}
          onChangeText={setUnits}
          placeholder="250"
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Billing Days</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={days}
          onChangeText={setDays}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Fixed Charge ({"\u20b9"}/day)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={fixedCharge}
          onChangeText={setFixedCharge}
        />
      </View>

      {/* Tariff slab info */}
      <View
        style={[
          styles.card,
          { marginTop: 12, backgroundColor: theme.glassHighlight },
        ]}
      >
        <Text style={[styles.cardTitle, { fontSize: 12 }]}>
          Tariff Slabs Applied
        </Text>
        {[
          { range: "0-100 units", rate: "3.75" },
          { range: "101-200 units", rate: "4.60" },
          { range: "201-400 units", rate: "5.30" },
          { range: "400+ units", rate: "5.75" },
        ].map((slab, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: theme.textMuted, fontSize: 11 }}>
              {slab.range}
            </Text>
            <Text style={{ color: theme.text, fontSize: 11 }}>
              {"\u20b9"}
              {slab.rate}/unit
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.calcResult}>
        <Text style={styles.calcResultLabel}>Est. Monthly Bill</Text>
        <Text style={styles.calcResultTotal}>
          {"\u20b9"}
          {total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
        </Text>
        <Text style={styles.calcSubText}>
          Energy: {"\u20b9"}
          {energyCost.toFixed(0)} | Fixed: {"\u20b9"}
          {fixedTotal.toFixed(0)} | Duty: {"\u20b9"}
          {electricityDuty.toFixed(0)}
        </Text>
        <Text style={[styles.calcSubText, { marginTop: 4, color: theme.yg }]}>
          {"\u20b9"}
          {perDay.toFixed(2)}/day | {"\u20b9"}
          {perKwh.toFixed(2)}/kWh
        </Text>
      </View>
    </View>
  );
}

// --- HELPER COMPONENTS ---
const MetricCard = ({ label, val, color, sub, subColor }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricVal, { color }]}>{val}</Text>
    {sub && (
      <Text style={[styles.metricSub, { color: subColor || theme.textMuted }]}>
        {sub}
      </Text>
    )}
  </View>
);

const Insight = ({ type, label, text, fill }) => {
  const color =
    type === "alert" ? theme.scarlet : type === "warn" ? theme.amber : theme.yg;
  return (
    <View style={[styles.insightCard, { borderLeftColor: color }]}>
      <Text style={[styles.insightLabel, { color }]}>{label}</Text>
      <Text style={styles.insightText}>{text}</Text>
      {fill !== "0%" && (
        <View style={styles.barTrack}>
          <View
            style={[styles.barFill, { width: fill, backgroundColor: color }]}
          />
        </View>
      )}
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 18,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  logoTitle: {
    color: theme.amber,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  logoSub: {
    color: theme.textMuted,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 1,
  },
  statusWrap: { flexDirection: "row", alignItems: "center" },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.yg,
    marginRight: 6,
  },
  statusText: { color: theme.textMuted, fontSize: 12 },

  navContainer: {
    borderBottomWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  navScroll: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
  },
  navItem: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  navItemActive: {
    backgroundColor: "#EEF4EE",
    borderWidth: 1,
    borderColor: theme.yg,
  },
  navText: { color: theme.textMuted, fontSize: 13 },
  navTextActive: { color: theme.amber, fontWeight: "600" },

  mainContent: { flex: 1, padding: 14 },
  pageHeader: { marginBottom: 16 },
  pageTitle: { color: theme.text, fontSize: 21, fontWeight: "800" },
  pageSub: { color: theme.textMuted, fontSize: 13, marginTop: 4 },

  dateTabs: {
    flexDirection: "row",
    backgroundColor: theme.glassHighlight,
    borderRadius: 4,
    padding: 4,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  dateTab: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 4 },
  dateTabActive: { backgroundColor: theme.glassBg },
  dateTabText: { color: theme.textMuted, fontSize: 12 },
  dateTabTextActive: { color: theme.text, fontWeight: "bold" },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  metricCard: {
    width: "48.5%",
    backgroundColor: theme.glassBg,
    padding: 13,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  metricLabel: { color: theme.textMuted, fontSize: 11, marginBottom: 8 },
  metricVal: { fontSize: 21, fontWeight: "800" },
  metricSub: { fontSize: 11, marginTop: 6 },

  card: {
    backgroundColor: theme.glassBg,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
  },

  // Custom Bar Chart Styles
  barChartContainer: {
    height: 150,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  barWrap: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    marginHorizontal: 1,
  },
  bar: { width: "80%", borderRadius: 1 },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  barLabelText: { color: theme.textMuted, fontSize: 10 },

  // Insight List Styles
  insightList: { gap: 10 },
  insightCard: {
    backgroundColor: theme.glassHighlight,
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 4,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  insightText: { color: theme.text, fontSize: 13, lineHeight: 18 },
  barTrack: {
    height: 4,
    backgroundColor: "#E2E5DF",
    borderRadius: 1,
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 1 },
  badgeHigh: {
    backgroundColor: "#F8E7E8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E8B9BE",
  },
  badgeTextHigh: { color: theme.scarlet, fontSize: 10, fontWeight: "bold" },

  // Table Styles
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: theme.border,
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  tableHeadText: { color: theme.textMuted, fontSize: 10, fontWeight: "bold" },
  tableCell: { flex: 1 },
  cellTextPrimary: { color: theme.text, fontSize: 13 },
  cellTextSub: { color: theme.textMuted, fontSize: 11, marginTop: 2 },

  // Heatmap
  hmContainer: { flexDirection: "column", gap: 6 },
  hmRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  hmDayLabel: { color: theme.textMuted, fontSize: 12, width: 20 },
  hmCell: { flex: 1, height: 22, borderRadius: 2 },

  // Cost Calc
  calcPanel: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  calcTitle: {
    color: theme.amber,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 16,
  },
  inputGroup: { marginBottom: 12 },
  inputLabel: { color: theme.textMuted, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  calcResult: {
    backgroundColor: "#EEF4EE",
    padding: 16,
    borderRadius: 4,
    marginTop: 10,
  },
  calcResultLabel: {
    color: theme.amber,
    fontSize: 10,
    textTransform: "uppercase",
  },
  calcResultTotal: {
    color: theme.amber,
    fontSize: 26,
    fontWeight: "bold",
    marginVertical: 4,
  },
  calcSubText: { color: theme.textMuted, fontSize: 11 },

  // AI Button
  aiButton: {
    backgroundColor: "#F6F8F3",
    borderWidth: 1,
    borderColor: theme.yg,
    padding: 12,
    borderRadius: 4,
    alignItems: "center",
    marginBottom: 20,
  },
  aiButtonText: { color: theme.yg, fontWeight: "bold" },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 10,
  },
  loadingText: { color: theme.textMuted },
});
