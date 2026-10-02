import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { C } from "../constants/theme";

export default function Iot() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>S.E.R.O.S. / FIELD SYSTEMS</Text>
      <Text style={styles.title}>Device Control</Text>
      <Text style={styles.subtitle}>
        Connected equipment and automation state
      </Text>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelKicker}>CONTROL BUS</Text>
            <Text style={styles.panelTitle}>Arduino relay network</Text>
          </View>
          <View style={styles.statusLine}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>READY</Text>
          </View>
        </View>
        <View style={styles.rule} />
        <View style={styles.emptyRow}>
          <Ionicons name="hardware-chip-outline" size={24} color={C.textSec} />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>
              Live states follow room detection
            </Text>
            <Text style={styles.emptyText}>
              Device commands are issued by the active camera automation
              workflow.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16 },
  eyebrow: {
    color: C.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: { color: C.textPri, fontSize: 24, fontWeight: "800", marginTop: 6 },
  subtitle: { color: C.textSec, fontSize: 13, marginTop: 4, marginBottom: 18 },
  panel: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 16,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  panelKicker: {
    color: C.textSec,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  panelTitle: {
    color: C.textPri,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  statusLine: { flexDirection: "row", alignItems: "center" },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
    marginRight: 6,
  },
  statusText: {
    color: C.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  rule: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  emptyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  emptyCopy: { flex: 1, marginLeft: 12 },
  emptyTitle: { color: C.textPri, fontSize: 13, fontWeight: "700" },
  emptyText: { color: C.textSec, fontSize: 12, lineHeight: 18, marginTop: 4 },
});
