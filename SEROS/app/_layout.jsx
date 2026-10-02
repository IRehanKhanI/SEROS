import React from "react";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import BackendStatus from "../components/BackendStatus";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerRight: () => <BackendStatus />,
        headerStyle: { backgroundColor: "#E8EEE8" },
        headerTintColor: "#26332F",
        headerTitleStyle: { fontWeight: "700", letterSpacing: 0.4 },
        tabBarStyle: {
          backgroundColor: "#E8EEE8",
          borderTopColor: "#B9C9BB",
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor: "#218A4E",
        tabBarInactiveTintColor: "#26332F",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Live Room",
          tabBarIcon: ({ color }) => (
            <Ionicons name="camera" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Forecast",
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => (
            <Ionicons name="stats-chart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="iot"
        options={{
          title: "Devices",
          tabBarIcon: ({ color }) => (
            <Ionicons name="hardware-chip" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
