import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BACKEND_URL } from "../constants/config";
import { C } from "../constants/theme";

export default function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState(null);
  const [totalCost, setTotalCost] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [fanRunning, setFanRunning] = useState(false);

  const getPrediction = async () => {
    setLoading(true);
    try {
      // Realistic 14-day history for an institution (High on Mon-Fri, very low on Sat-Sun)
      const histData = [
        45.2,
        48.1,
        46.5,
        47.0,
        42.1, // Mon - Fri
        12.5,
        10.8, // Sat - Sun
        46.3,
        49.2,
        47.8,
        48.5,
        45.9, // Mon - Fri
        13.1,
        11.2, // Sat - Sun
      ];

      const response = await fetch(`${BACKEND_URL}/api/predict/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: histData }),
      });
      const data = await response.json();

      if (data.status === "success") {
        setPredictions(data.predictions);
        setTotalCost(data.total_cost);
      } else {
        alert("Server Error: " + data.message);
      }
    } catch (e) {
      alert(
        "Network Error: Could not connect to Django backend. Details: " +
          e.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = async () => {
    setLoading(true);
    setFanRunning(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/greeting/`);
      const data = await response.json();

      if (data.status === "success") {
        setGreeting(data.greeting);
      } else {
        alert("Server Error: " + data.message);
      }
    } catch (e) {
      alert(
        "Network Error: Could not connect to Django backend. Details: " +
          e.message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.eyebrow}>S.E.R.O.S. / ENERGY OPERATIONS</Text>
        <Text style={styles.title}>Consumption Forecast</Text>
        <Text style={styles.subtitle}>Seven-day demand and tariff outlook</Text>
      </View>

      {/* electricity predictor block */}
      <View style={styles.card}>
        <Text style={styles.cardKicker}>FORECAST SERVICE</Text>
        <Text style={styles.cardTitle}>Electricity demand projection</Text>
        <Text style={styles.textBody}>
          14-days history loaded. Predicting next 7 days of consumption and
          generating a billing forecast using the live electricity tariff
          structure.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={getPrediction}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "RUNNING FORECAST" : "RUN FORECAST"}
          </Text>
        </TouchableOpacity>

        {predictions && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Next 7 Days Forecast:</Text>
            {predictions.map((day, idx) => (
              <Text key={idx} style={styles.resultText}>
                Day {idx + 1}: {parseFloat(day.kWh).toFixed(1)} kWh 👉 Rs.{" "}
                {parseFloat(day.cost).toFixed(2)}
              </Text>
            ))}
            {totalCost !== null && (
              <View
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderColor: C.border,
                }}
              >
                <Text
                  style={[
                    styles.resultText,
                    { fontWeight: "bold", color: C.green },
                  ]}
                >
                  EST. WEEKLY BILL: Rs. {parseFloat(totalCost).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color={C.blue}
          style={{ marginTop: 20 }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  pageHeader: { marginBottom: 18 },
  eyebrow: {
    color: C.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: C.textPri,
  },
  subtitle: {
    color: C.textSec,
    fontSize: 13,
    marginTop: 5,
  },
  card: {
    backgroundColor: C.card,
    padding: 16,
    borderRadius: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.yellow,
  },
  cardKicker: {
    color: C.yellow,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 17,
    color: C.textPri,
    fontWeight: "800",
    marginBottom: 10,
  },
  textBody: {
    color: C.textSec,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 15,
  },
  fanContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  button: {
    backgroundColor: C.green,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.8,
  },
  resultBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#F6F8F3",
    borderRadius: 4,
    borderColor: C.green,
    borderWidth: 1,
  },
  resultTitle: {
    color: C.textPri,
    fontWeight: "bold",
    marginBottom: 10,
  },
  resultText: {
    color: C.textSec,
    marginBottom: 5,
  },
});
