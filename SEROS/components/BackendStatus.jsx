import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { BACKEND_URL } from "../constants/config";
import { C } from "../constants/theme";

export default function BackendStatus() {
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(BACKEND_URL.replace("/api/detect/", ""));
        // As long as the fetch doesn't throw a network error, backend is reachable
        setIsConnected(true);
      } catch (e) {
        setIsConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isConnected ? C.green : C.red, marginRight: 5 }} />
      <Text style={{ color: isConnected ? C.green : C.red, fontSize: 12, fontWeight: 'bold' }}>
        {isConnected ? 'Backend Up' : 'Backend Down'}
      </Text>
    </View>
  );
}
