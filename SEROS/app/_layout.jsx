import React from "react";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import BackendStatus from "../components/BackendStatus";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerRight: () => <BackendStatus />,
        headerStyle: { backgroundColor: "#0a0f1e" },
        headerTintColor: "#fff",
        tabBarStyle: {
          backgroundColor: "#1b2528",
          borderTopColor: "#3d5558",
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#9fb2b5",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Camera",
          tabBarIcon: ({ color }) => (
            <Ionicons name="camera" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
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
