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
        45.2, 48.1, 46.5, 47.0, 42.1, // Mon - Fri
        12.5, 10.8,                   // Sat - Sun
        46.3, 49.2, 47.8, 48.5, 45.9, // Mon - Fri
        13.1, 11.2                    // Sat - Sun
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
      <Text style={styles.title}>AI Tools Dashboard</Text>

      {/* electricity predictor block */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Electricity Forecaster (Gemini 3 Flash Preview)
        </Text>
        <Text style={styles.textBody}>
          14-days history loaded. Predicting next 7 days of consumption and generating a billing forecast using the live electricity tariff structure.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={getPrediction}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Thinking..." : "Get Prediction"}
          </Text>
        </TouchableOpacity>

        {predictions && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Next 7 Days Forecast:</Text>
            {predictions.map((day, idx) => (
              <Text key={idx} style={styles.resultText}>
                Day {idx + 1}: {parseFloat(day.kWh).toFixed(1)} kWh  👉  Rs. {parseFloat(day.cost).toFixed(2)}
              </Text>
            ))}
            {totalCost !== null && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: C.border }}>
                <Text style={[styles.resultText, { fontWeight: 'bold', color: C.green }]}>
                  Est. Weekly Bill: Rs. {parseFloat(totalCost).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* smart camera block */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Smart AI Fan</Text>
        <View style={styles.fanContainer}>
          <Text style={{ fontSize: 50 }}>{fanRunning ? "🌀" : "⏸"} </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#ff9f1c" }]}
          onPress={getGreeting}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Connecting..." : "Talk to Gemini"}
          </Text>
        </TouchableOpacity>

        {greeting !== "" && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Gemini Says:</Text>
            <Text style={styles.resultText}>{greeting}</Text>
          </View>
        )}
      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#ff9f1c"
          style={{ marginTop: 20 }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080a0e",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ff9f1c",
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#1a1a1a",
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  cardTitle: {
    fontSize: 18,
    color: "#9fd356",
    fontWeight: "bold",
    marginBottom: 10,
  },
  textBody: {
    color: "#aaa",
    marginBottom: 15,
  },
  fanContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  button: {
    backgroundColor: "#9fd356",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#080a0e",
    fontWeight: "bold",
    fontSize: 16,
  },
  resultBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "rgba(159, 211, 86, 0.1)",
    borderRadius: 10,
    borderColor: "#9fd356",
    borderWidth: 1,
  },
  resultTitle: {
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 10,
  },
  resultText: {
    color: "#ccc",
    marginBottom: 5,
  },
});
