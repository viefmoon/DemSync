import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
} from "react-native";
import { BleManager, Device, State } from "react-native-ble-plx";

export function BLEScanner() {
  const manager = new BleManager();
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    // Espera a que el bluetooth esté encendido antes de iniciar cualquier acción
    const subscription = manager.onStateChange((state: State) => {
      if (state === State.PoweredOn) {
        console.log("Bluetooth encendido");
        subscription.remove();
      }
    }, true);

    // Limpia el manager al desmontar el componente
    return () => {
      manager.destroy();
    };
  }, [manager]);

  async function requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS === "android" && Platform.Version >= 31) {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ];
      try {
        const grantedPermissions = await PermissionsAndroid.requestMultiple(permissions);
        const hasAllPermissions = permissions.every(
          (permission) => grantedPermissions[permission] === PermissionsAndroid.RESULTS.GRANTED
        );
        if (!hasAllPermissions) {
          Alert.alert(
            "Permisos insuficientes",
            "Se requieren permisos de Bluetooth y ubicación para escanear dispositivos."
          );
          return false;
        }
        return true;
      } catch (err) {
        console.error("Error al solicitar permisos de Bluetooth:", err);
        Alert.alert("Error", "No se pudieron solicitar los permisos.");
        return false;
      }
    }
    return true;
  }

  async function startScan() {
    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) return;

    setDevices([]);
    setIsScanning(true);
    manager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error("Error al escanear:", error);
        setIsScanning(false);
        return;
      }
      if (scannedDevice) {
        // Evita duplicados
        setDevices((prevDevices) => {
          if (!prevDevices.find((device) => device.id === scannedDevice.id)) {
            return [...prevDevices, scannedDevice];
          }
          return prevDevices;
        });
      }
    });
  }

  function stopScan() {
    manager.stopDeviceScan();
    setIsScanning(false);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.scanButton, isScanning && styles.buttonDisabled]}
        onPress={isScanning ? stopScan : startScan}
      >
        <Text style={styles.buttonText}>
          {isScanning ? "Detener escaneo" : "Iniciar escaneo"}
        </Text>
      </TouchableOpacity>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <Text style={styles.deviceText}>ID: {item.id}</Text>
            <Text style={styles.deviceText}>
              Nombre: {item.name || "Desconocido"}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.placeholderText}>
            {isScanning ? "Buscando dispositivos..." : "No hay dispositivos"}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scanButton: {
    height: 48,
    backgroundColor: "#0284c7",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  deviceItem: {
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 10,
  },
  deviceText: {
    fontSize: 14,
    color: "#333",
  },
  placeholderText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
    color: "#666",
  },
}); 