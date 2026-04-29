import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C } from "../constants/theme";

export default function FanBar({ leftOn, rightOn }) {
  return (
    <View style={styles.fanBar}>
      <View style={[styles.fanSide, { borderColor: leftOn ? C.green : C.dim }]}>
        <Text style={[styles.fanIcon, { color: leftOn ? C.green : C.dim }]}>⟳</Text>
        <Text style={[styles.fanLabel, { color: leftOn ? C.green : C.dim }]}>LEFT FAN</Text>
        <Text style={[styles.fanState, { color: leftOn ? C.green : C.dim }]}>{leftOn ? "ON" : "OFF"}</Text>
      </View>

      <View style={styles.fanDivider} />

      <View style={[styles.fanSide, { borderColor: rightOn ? C.green : C.dim }]}>
        <Text style={[styles.fanIcon, { color: rightOn ? C.green : C.dim }]}>⟳</Text>
        <Text style={[styles.fanLabel, { color: rightOn ? C.green : C.dim }]}>RIGHT FAN</Text>
        <Text style={[styles.fanState, { color: rightOn ? C.green : C.dim }]}>{rightOn ? "ON" : "OFF"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fanBar: {
    flexDirection: "row",
  },
  fanSide: {
    flex:           1,
    alignItems:     "center",
    borderWidth:    1,
    borderRadius:   6,
    paddingVertical: 12,
  },
  fanDivider: {
    width: 10,
  },
  fanIcon: {
    fontSize: 26,
  },
  fanLabel: {
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 1,
    marginTop:     4,
  },
  fanState: {
    fontSize:   13,
    fontWeight: "800",
    marginTop:  4,
  },
});
