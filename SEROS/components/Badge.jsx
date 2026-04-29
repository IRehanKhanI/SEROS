import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C } from "../constants/theme";

export default function Badge({ value, onColor = C.green, offColor = C.dim, label }) {
  const active =
    value === "ON" ||
    value === true ||
    (typeof value === "string" && value !== "OFF" && value !== "-" && value !== "None");

  return (
    <View style={[styles.badge, { borderColor: active ? onColor : offColor }]}>
      <View style={[styles.badgeDot, { backgroundColor: active ? onColor : offColor }]} />
      <Text style={[styles.badgeText, { color: active ? onColor : C.textSec }]}>
        {label ? <Text style={styles.badgeLabel}>{label}  </Text> : null}
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection:     "row",
    alignItems:        "center",
    borderWidth:       1,
    borderRadius:      6,
    paddingVertical:   8,
    paddingHorizontal: 12,
  },
  badgeDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginRight:  8,
  },
  badgeText: {
    fontSize:   14,
    fontWeight: "600",
  },
  badgeLabel: {
    fontWeight: "400",
    fontSize:   12,
  },
});
