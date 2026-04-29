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

// const { width } = Dimensions.get("window");

// --- THEME & DATA ---
const theme = {
  amber: "#ff9f1c",
  yg: "#9fd356",
  scarlet: "#df2935",
  bg: "#080a0e",
  text: "#f0ede8",
  textMuted: "#7a7870",
  glassBg: "rgba(20,24,35,0.8)",
  border: "rgba(255,255,255,0.08)",
  glassHighlight: "rgba(255,255,255,0.05)",
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

  return (
    <View style={styles.container}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.logoTitle}>SEROS</Text>
          <Text style={styles.logoSub}>Smart Energy Optimization</Text>
        </View>
        <View style={styles.statusWrap}>
          <View style={styles.pulse} />
          <Text style={styles.statusText}>Live</Text>
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
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "predict" && <PredictTab />}
        {activeTab === "devices" && <DevicesTab />}
        {activeTab === "heatmap" && <HeatmapTab />}
        {activeTab === "calculator" && <CalculatorTab />}
      </ScrollView>
    </View>
  );
}

// --- SUB-VIEWS (TABS) ---

function OverviewTab() {
  const [day, setDay] = useState(0);
  const data = hourDataSets[day];
  const total = data.reduce((a, b) => a + b, 0);
  const peak = Math.max(...data);
  const waste =
    data.slice(0, 6).reduce((a, b) => a + b, 0) +
    data.slice(18).reduce((a, b) => a + b, 0);

  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Energy Overview</Text>
        <Text style={styles.pageSub}>
          Westfield Academy — Real-time monitoring
        </Text>
      </View>

      <View style={styles.dateTabs}>
        <TouchableOpacity
          style={[styles.dateTab, day === 0 && styles.dateTabActive]}
          onPress={() => setDay(0)}
        >
          <Text
            style={[styles.dateTabText, day === 0 && styles.dateTabTextActive]}
          >
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateTab, day === 1 && styles.dateTabActive]}
          onPress={() => setDay(1)}
        >
          <Text
            style={[styles.dateTabText, day === 1 && styles.dateTabTextActive]}
          >
            Yesterday
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard
          label="Total Today"
          val={`${total.toFixed(1)} kWh`}
          color={theme.amber}
          sub="↑ 4.2% vs last week"
          subColor={theme.scarlet}
        />
        <MetricCard
          label="Peak Hour"
          val={`${peak.toFixed(1)} kW`}
          color={theme.text}
          sub="14:00–15:00"
        />
        <MetricCard
          label="Active Devices"
          val="24"
          color={theme.yg}
          sub="across 8 zones"
        />
        <MetricCard
          label="Waste (off-hrs)"
          val={`${waste.toFixed(1)} kWh`}
          color={theme.scarlet}
          sub={`↑ ${((waste / total) * 100).toFixed(0)}% of total`}
          subColor={theme.scarlet}
        />
      </View>

      {/* Custom React Native Native Bar Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Consumption (kWh)</Text>
        <View style={styles.barChartContainer}>
          {data.map((val, idx) => {
            const heightPct = (val / peak) * 100;
            const color =
              val > 7 ? theme.scarlet : val > 4 ? theme.amber : theme.yg;
            return (
              <View key={idx} style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    { height: `${heightPct}%`, backgroundColor: color },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.barLabels}>
          <Text style={styles.barLabelText}>12am</Text>
          <Text style={styles.barLabelText}>6am</Text>
          <Text style={styles.barLabelText}>12pm</Text>
          <Text style={styles.barLabelText}>6pm</Text>
          <Text style={styles.barLabelText}>11pm</Text>
        </View>
      </View>
    </View>
  );
}

function AnalyticsTab() {
  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Deep Analytics</Text>
        <Text style={styles.pageSub}>
          Efficiency scores, anomalies, and trends
        </Text>
      </View>

      <View style={styles.card}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={styles.cardTitle}>Anomaly Detection</Text>
          <View style={styles.badgeHigh}>
            <Text style={styles.badgeTextHigh}>3 Alerts</Text>
          </View>
        </View>

        <View style={styles.insightList}>
          <Insight
            type="alert"
            label="CRITICAL"
            text="Server room running 18hrs/day on weekends — 42 kWh wasted"
            fill="87%"
          />
          <Insight
            type="warn"
            label="WARNING"
            text="Gym HVAC left on overnight Tuesday — 14 kWh wasted"
            fill="54%"
          />
          <Insight
            type="warn"
            label="WARNING"
            text="Classroom block B projectors idle for 3+ hours (not sleep mode)"
            fill="38%"
          />
        </View>
      </View>
    </View>
  );
}

function PredictTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const runPrediction = () => {
    setLoading(true);
    // Simulating API Call delay
    setTimeout(() => {
      setData({
        tomorrow: 142.4,
        week: 710,
        bill: 43500,
        insights: [
          {
            type: "good",
            title: "OPTIMIZED",
            text: "HVAC scheduling is saving ~12% daily.",
          },
          {
            type: "warn",
            title: "FORECAST",
            text: "Heatwave expected Thursday; cooling load will spike 20%.",
          },
        ],
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>AI Predictions</Text>
        <Text style={styles.pageSub}>Powered by Cloud Inference</Text>
      </View>

      <TouchableOpacity style={styles.aiButton} onPress={runPrediction}>
        <Text style={styles.aiButtonText}>Generate Forecast ↗</Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.yg} />
          <Text style={styles.loadingText}>Running AI inference...</Text>
        </View>
      )}

      {data && (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Tomorrow (kWh)"
              val={data.tomorrow}
              color={theme.amber}
            />
            <MetricCard
              label="This Week (kWh)"
              val={data.week}
              color={theme.text}
            />
            <MetricCard
              label="Month End Bill"
              val={`₹${data.bill}`}
              color={theme.yg}
            />
          </View>

          <View
            style={[
              styles.card,
              {
                borderColor: theme.yg,
                backgroundColor: "rgba(159,211,86,0.05)",
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.yg }]}>
              AI Insights
            </Text>
            {data.insights.map((ins, i) => (
              <Insight
                key={i}
                type={ins.type}
                label={ins.title}
                text={ins.text}
                fill="0%"
              />
            ))}
          </View>
        </>
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
  // Simple Mock Heatmap mapping
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const grid = days.map((_, di) =>
    Array.from({ length: 12 }).map((_, hi) => {
      if (di < 5 && hi > 3 && hi < 9) return Math.random() * 0.8 + 0.2; // High usage weekdays
      return Math.random() * 0.2; // Low usage
    }),
  );

  return (
    <View>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Usage Heatmap</Text>
        <Text style={styles.pageSub}>Intensity mapping (Day vs Time)</Text>
      </View>
      <View style={styles.card}>
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
      </View>
    </View>
  );
}

function CalculatorTab() {
  const [rate, setRate] = useState("7.50");
  const [tax, setTax] = useState("8");
  const [fixed, setFixed] = useState("45");

  const r = parseFloat(rate) || 0;
  const t = parseFloat(tax) || 0;
  const f = parseFloat(fixed) || 0;

  const base = 145 * 20 * r;
  const fixedTotal = f * 30;
  const sub = base + fixedTotal;
  const dutyAmt = sub * (t / 100);
  const total = sub + dutyAmt;

  return (
    <View style={styles.calcPanel}>
      <Text style={styles.calcTitle}>Bill Estimator (INR)</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Rate (₹/kWh)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={rate}
          onChangeText={setRate}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Electricity Duty (%)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={tax}
          onChangeText={setTax}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Fixed Charge (₹/day)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={fixed}
          onChangeText={setFixed}
        />
      </View>

      <View style={styles.calcResult}>
        <Text style={styles.calcResultLabel}>Est. Monthly Bill</Text>
        <Text style={styles.calcResultTotal}>
          ₹{total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
        </Text>
        <Text style={styles.calcSubText}>
          Energy: ₹{base.toFixed(0)} | Duty: ₹{dutyAmt.toFixed(0)}
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
    padding: 20,
    paddingTop: 50,
    backgroundColor: theme.glassBg,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  logoTitle: {
    color: theme.amber,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
  },
  logoSub: { color: theme.textMuted, fontSize: 10, marginTop: 2 },
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
    backgroundColor: "rgba(15,18,25,0.9)",
  },
  navScroll: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: "row",
  },
  navItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  navItemActive: {
    backgroundColor: "rgba(255,159,28,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,159,28,0.3)",
  },
  navText: { color: theme.textMuted, fontSize: 13 },
  navTextActive: { color: theme.amber, fontWeight: "600" },

  mainContent: { flex: 1, padding: 16 },
  pageHeader: { marginBottom: 20 },
  pageTitle: { color: theme.text, fontSize: 22, fontWeight: "bold" },
  pageSub: { color: theme.textMuted, fontSize: 13, marginTop: 4 },

  dateTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  dateTab: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
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
    width: "48%",
    backgroundColor: theme.glassBg,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  metricLabel: { color: theme.textMuted, fontSize: 11, marginBottom: 8 },
  metricVal: { fontSize: 22, fontWeight: "bold" },
  metricSub: { fontSize: 11, marginTop: 6 },

  card: {
    backgroundColor: theme.glassBg,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 16,
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
  bar: { width: "80%", borderRadius: 4 },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  barLabelText: { color: theme.textMuted, fontSize: 10 },

  // Insight List Styles
  insightList: { gap: 10 },
  insightCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    borderRadius: 10,
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
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 2 },
  badgeHigh: {
    backgroundColor: "rgba(223,41,53,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(223,41,53,0.3)",
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
    borderColor: "rgba(255,255,255,0.04)",
  },
  tableHeadText: { color: theme.textMuted, fontSize: 10, fontWeight: "bold" },
  tableCell: { flex: 1 },
  cellTextPrimary: { color: theme.text, fontSize: 13 },
  cellTextSub: { color: theme.textMuted, fontSize: 11, marginTop: 2 },

  // Heatmap
  hmContainer: { flexDirection: "column", gap: 6 },
  hmRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  hmDayLabel: { color: theme.textMuted, fontSize: 12, width: 20 },
  hmCell: { flex: 1, height: 24, borderRadius: 4 },

  // Cost Calc
  calcPanel: {
    backgroundColor: "rgba(255,159,28,0.05)",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,159,28,0.2)",
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
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  calcResult: {
    backgroundColor: "rgba(255,159,28,0.1)",
    padding: 16,
    borderRadius: 12,
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
    backgroundColor: "rgba(159,211,86,0.1)",
    borderWidth: 1,
    borderColor: "rgba(159,211,86,0.3)",
    padding: 12,
    borderRadius: 10,
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
