import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Alert,
} from "react-native";
import { Device } from "react-native-ble-plx";
import { bleManager } from "../../lib/ble-manager";

interface BleDeviceSelectionProps {
  onDeviceSelected: (device: Device) => void;
}

export function BleDeviceSelection({
  onDeviceSelected,
}: BleDeviceSelectionProps) {
  const manager = bleManager;
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Permiso de ubicación para BLE",
            message:
              "Esta aplicación necesita acceso a la ubicación para escanear dispositivos BLE.",
            buttonNeutral: "Preguntar luego",
            buttonNegative: "Cancelar",
            buttonPositive: "OK",
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn("Permiso BLE denegado");
        }
      }
    }
    requestPermissions();
  }, [manager]);

  const startScan = () => {
    if (isScanning) {
      console.warn(
        "Ya se está escaneando, deteniendo y reiniciando el escaneo."
      );
      manager.stopDeviceScan();
      setIsScanning(false);
      return;
    }

    setDevices([]);
    setIsScanning(true);
    try {
      manager.startDeviceScan(null, null, (error, scannedDevice) => {
        if (error) {
          if (error.message.includes("Cannot start scanning operation")) {
            console.warn(
              "Operación de escaneo ya en curso. Se ignorará este error."
            );
          } else {
            console.error("Error al escanear:", error);
            Alert.alert(
              "Error",
              error.message || "No se pudo iniciar el escaneo."
            );
            setIsScanning(false);
          }
          return;
        }

        if (scannedDevice && scannedDevice.name) {
          setDevices((prevDevices) => {
            if (!prevDevices.find((d) => d.id === scannedDevice.id)) {
              return [...prevDevices, scannedDevice];
            }
            return prevDevices;
          });
        }
      });
      setTimeout(() => {
        manager.stopDeviceScan();
        setIsScanning(false);
      }, 10000);
    } catch (err: any) {
      console.error("Error iniciando escaneo:", err);
      Alert.alert("Error", err.message || "No se pudo iniciar el escaneo.");
      setIsScanning(false);
    }
  };

  const handleDevicePress = async (device: Device) => {
    manager.stopDeviceScan();
    setIsScanning(false);
    try {
      const connectedDevice = await device.connect({ autoConnect: true });
      await connectedDevice.discoverAllServicesAndCharacteristics();
      onDeviceSelected(connectedDevice);
    } catch (error: any) {
      console.error("Error al conectar:", error);
      Alert.alert(
        "Error",
        error.message ||
          "No se pudo conectar al dispositivo. Verifica que esté en modo de configuración y con suficiente energía."
      );
    }
  };

  const renderItem = ({ item }: { item: Device }) => (
    <TouchableOpacity
      style={deviceSelectionStyles.deviceItem}
      onPress={() => handleDevicePress(item)}
    >
      <Text style={deviceSelectionStyles.deviceName}>{item.name}</Text>
      <Text style={deviceSelectionStyles.deviceId}>ID: {item.id}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={deviceSelectionStyles.container}>
      <TouchableOpacity
        style={deviceSelectionStyles.scanButton}
        onPress={startScan}
        disabled={isScanning}
      >
        <Text style={deviceSelectionStyles.scanButtonText}>
          {isScanning ? "Escaneando..." : "Escanear dispositivos"}
        </Text>
      </TouchableOpacity>
      {isScanning && <ActivityIndicator size="large" color="#0284c7" />}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          !isScanning ? <Text>No se encontraron dispositivos</Text> : null
        }
      />
    </View>
  );
}

const deviceSelectionStyles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
    flex: 1,
  },
  scanButton: {
    backgroundColor: "#0284c7",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deviceItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "500",
  },
  deviceId: {
    fontSize: 12,
    color: "#666",
  },
});
