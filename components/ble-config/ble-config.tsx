import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { Device } from "react-native-ble-plx";
import { BleDeviceSelection } from "./ble-device-selection";
// Si no tienes instalado "base-64", instálalo con npm/yarn
import { decode as atob, encode as btoa } from "base-64";

// ─── CACHÉ PARA DISCOVERY ──────────────────────────────────────────
const discoveredDevices = new Set<string>();

// ─── CONSTANTES DE SERVICIOS Y CARACTERÍSTICAS BLE ───────────────
const BLE_SERVICE_UUID = "180A";
const BLE_CHAR_SYSTEM_UUID = "2A37";
const BLE_CHAR_NTC100K_UUID = "2A38";
const BLE_CHAR_NTC10K_UUID = "2A39";
const BLE_CHAR_CONDUCTIVITY_UUID = "2A3C";
const BLE_CHAR_PH_UUID = "2A3B";
const BLE_CHAR_SENSORS_UUID = "2A40";
const BLE_CHAR_LORA_CONFIG_UUID = "2A41";

// ─── CONSTANTES DE NAMESPACES Y CLAVES ───────────────────────────
const NAMESPACE_SYSTEM = "system";
const NAMESPACE_NTC100K = "ntc_100k";
const NAMESPACE_NTC10K = "ntc_10k";
const NAMESPACE_COND = "cond";
const NAMESPACE_PH = "ph";
const NAMESPACE_SENSORS = "sensors";
const NAMESPACE_LORAWAN = "lorawan";

const KEY_INITIALIZED = "initialized";
const KEY_SLEEP_TIME = "sleep_time";
const KEY_DEVICE_ID = "deviceId";
const KEY_STATION_ID = "stationId";

const KEY_NTC100K_T1 = "n100k_t1";
const KEY_NTC100K_R1 = "n100k_r1";
const KEY_NTC100K_T2 = "n100k_t2";
const KEY_NTC100K_R2 = "n100k_r2";
const KEY_NTC100K_T3 = "n100k_t3";
const KEY_NTC100K_R3 = "n100k_r3";

const KEY_NTC10K_T1 = "n10k_t1";
const KEY_NTC10K_R1 = "n10k_r1";
const KEY_NTC10K_T2 = "n10k_t2";
const KEY_NTC10K_R2 = "n10k_r2";
const KEY_NTC10K_T3 = "n10k_t3";
const KEY_NTC10K_R3 = "n10k_r3";

const KEY_CONDUCT_CT = "c_ct";
const KEY_CONDUCT_CC = "c_cc";
const KEY_CONDUCT_V1 = "c_v1";
const KEY_CONDUCT_T1 = "c_t1";
const KEY_CONDUCT_V2 = "c_v2";
const KEY_CONDUCT_T2 = "c_t2";
const KEY_CONDUCT_V3 = "c_v3";
const KEY_CONDUCT_T3 = "c_t3";

const KEY_PH_V1 = "ph_v1";
const KEY_PH_T1 = "ph_t1";
const KEY_PH_V2 = "ph_v2";
const KEY_PH_T2 = "ph_t2";
const KEY_PH_V3 = "ph_v3";
const KEY_PH_T3 = "ph_t3";

const KEY_SENSOR = "k";
const KEY_SENSOR_ID = "id";
const KEY_SENSOR_TIMESTAMP = "ts";
const KEY_SENSOR_TYPE = "t";
const KEY_SENSOR_VALUE = "v";
const KEY_SENSOR_ENABLE = "e";

const KEY_LORA_DEVADDR = "devAddr";
const KEY_LORA_FNWS_INTKEY = "fNwkSIntKey";
const KEY_LORA_SNWS_INTKEY = "sNwkSIntKey";
const KEY_LORA_NWKSENC_KEY = "nwkSEncKey";
const KEY_LORA_APPS_KEY = "appSKey";

// ─── HELPER: decodificar base64 ─────────────────────────────────────
function decodeBase64(value?: string | null): string {
  return value ? atob(value) : "";
}

// ─── HELPER: leer configuración de una característica BLE ────────
async function readConfigCharacteristic(
  device: Device,
  serviceUUID: string,
  charUUID: string
): Promise<any> {
  try {
    if (!discoveredDevices.has(device.id)) {
      if (__DEV__) console.log("Descubriendo servicios y características...");
      await device.discoverAllServicesAndCharacteristics();
      discoveredDevices.add(device.id);

      if (__DEV__) {
        const services = await device.services();
        console.log(
          "Servicios disponibles:",
          services.map((s) => s.uuid).join(", ")
        );
        for (const service of services) {
          const characteristics = await service.characteristics();
          console.log(
            `Características para servicio ${service.uuid}:`,
            characteristics.map((c) => c.uuid).join(", ")
          );
        }
      }
    }
    if (__DEV__)
      console.log(
        `Intentando leer la característica ${charUUID} del servicio ${serviceUUID}`
      );
    const characteristic = await device.readCharacteristicForService(
      serviceUUID,
      charUUID
    );
    if (__DEV__)
      console.log(
        `Característica ${charUUID} leída correctamente:`,
        characteristic
      );
    const decoded = decodeBase64(characteristic.value);
    return JSON.parse(decoded);
  } catch (error: any) {
    console.error(`Error leyendo la característica ${charUUID}:`, error);
    if (error.reason) console.error("Razón del error:", error.reason);
    throw error;
  }
}

// ─── COMPONENTE: Sección de Configuración ─────────────────────────
interface ConfigSectionProps {
  title: string;
  children: React.ReactNode;
}

export function ConfigSection({ title, children }: ConfigSectionProps) {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

// ─── FORMULARIO: Configuración del Sistema ─────────────────────────
interface SystemConfigFormProps {
  device: Device;
}

export function SystemConfigForm({ device }: SystemConfigFormProps) {
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [sleepTime, setSleepTime] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [stationId, setStationId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readConfigCharacteristic(
          device,
          BLE_SERVICE_UUID,
          BLE_CHAR_SYSTEM_UUID
        );
        if (config?.[NAMESPACE_SYSTEM]) {
          setInitialized(config[NAMESPACE_SYSTEM][KEY_INITIALIZED]);
          setSleepTime(config[NAMESPACE_SYSTEM][KEY_SLEEP_TIME].toString());
          setDeviceId(config[NAMESPACE_SYSTEM][KEY_DEVICE_ID]);
          setStationId(config[NAMESPACE_SYSTEM][KEY_STATION_ID]);
        }
      } catch (error) {
        console.error("Error cargando configuración del sistema", error);
      }
    }
    loadConfig();
  }, [device]);

  async function handleSend() {
    setIsSending(true);
    const sleepTimeNum = parseInt(sleepTime) || 0;
    const config = {
      [NAMESPACE_SYSTEM]: {
        [KEY_INITIALIZED]: initialized,
        [KEY_SLEEP_TIME]: sleepTimeNum,
        [KEY_DEVICE_ID]: deviceId,
        [KEY_STATION_ID]: stationId,
      },
    };
    try {
      const jsonConfig = JSON.stringify(config);
      const base64Config = btoa(jsonConfig);
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_SYSTEM_UUID,
        base64Config
      );
      Alert.alert("Éxito", "Configuración del sistema enviada correctamente");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la configuración"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ConfigSection title="Configuración del Sistema">
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Inicializado:</Text>
        <Switch value={Boolean(initialized)} onValueChange={setInitialized} />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Tiempo de sueño (s):</Text>
        <TextInput
          style={styles.input}
          value={sleepTime}
          onChangeText={setSleepTime}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>ID del dispositivo:</Text>
        <TextInput
          style={styles.input}
          value={deviceId}
          onChangeText={setDeviceId}
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>ID de estación:</Text>
        <TextInput
          style={styles.input}
          value={stationId}
          onChangeText={setStationId}
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.buttonText}>
          {isSending ? "Enviando..." : "Enviar configuración"}
        </Text>
      </TouchableOpacity>
    </ConfigSection>
  );
}

// ─── FORMULARIO: Configuración NTC 100K ─────────────────────────────
interface NTC100KConfigFormProps {
  device: Device;
}

export function NTC100KConfigForm({ device }: NTC100KConfigFormProps) {
  const [t1, setT1] = useState<string>("");
  const [r1, setR1] = useState<string>("");
  const [t2, setT2] = useState<string>("");
  const [r2, setR2] = useState<string>("");
  const [t3, setT3] = useState<string>("");
  const [r3, setR3] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readConfigCharacteristic(
          device,
          BLE_SERVICE_UUID,
          BLE_CHAR_NTC100K_UUID
        );
        if (config?.[NAMESPACE_NTC100K]) {
          setT1(config[NAMESPACE_NTC100K][KEY_NTC100K_T1].toString());
          setR1(config[NAMESPACE_NTC100K][KEY_NTC100K_R1].toString());
          setT2(config[NAMESPACE_NTC100K][KEY_NTC100K_T2].toString());
          setR2(config[NAMESPACE_NTC100K][KEY_NTC100K_R2].toString());
          setT3(config[NAMESPACE_NTC100K][KEY_NTC100K_T3].toString());
          setR3(config[NAMESPACE_NTC100K][KEY_NTC100K_R3].toString());
        }
      } catch (error) {
        console.error("Error cargando configuración NTC 100K", error);
      }
    }
    loadConfig();
  }, [device]);

  async function handleSend() {
    setIsSending(true);
    const config = {
      [NAMESPACE_NTC100K]: {
        [KEY_NTC100K_T1]: parseFloat(t1),
        [KEY_NTC100K_R1]: parseFloat(r1),
        [KEY_NTC100K_T2]: parseFloat(t2),
        [KEY_NTC100K_R2]: parseFloat(r2),
        [KEY_NTC100K_T3]: parseFloat(t3),
        [KEY_NTC100K_R3]: parseFloat(r3),
      },
    };
    try {
      const jsonConfig = JSON.stringify(config);
      const base64Config = btoa(jsonConfig);
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_NTC100K_UUID,
        base64Config
      );
      Alert.alert("Éxito", "Configuración NTC 100K enviada correctamente");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la configuración"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ConfigSection title="Configuración NTC 100K">
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T1 (°C):</Text>
        <TextInput
          style={styles.input}
          value={t1}
          onChangeText={setT1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>R1 (Ω):</Text>
        <TextInput
          style={styles.input}
          value={r1}
          onChangeText={setR1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T2 (°C):</Text>
        <TextInput
          style={styles.input}
          value={t2}
          onChangeText={setT2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>R2 (Ω):</Text>
        <TextInput
          style={styles.input}
          value={r2}
          onChangeText={setR2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T3 (°C):</Text>
        <TextInput
          style={styles.input}
          value={t3}
          onChangeText={setT3}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>R3 (Ω):</Text>
        <TextInput
          style={styles.input}
          value={r3}
          onChangeText={setR3}
          keyboardType="numeric"
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.buttonText}>
          {isSending ? "Enviando..." : "Enviar configuración"}
        </Text>
      </TouchableOpacity>
    </ConfigSection>
  );
}

// ─── FORMULARIO: Configuración NTC 10K (Nuevos) ─────────────────────
interface NTC10KConfigFormProps {
  device: Device;
}

export function NTC10KConfigForm({ device }: NTC10KConfigFormProps) {
  const [t1, setT1] = useState<string>("");
  const [r1, setR1] = useState<string>("");
  const [t2, setT2] = useState<string>("");
  const [r2, setR2] = useState<string>("");
  const [t3, setT3] = useState<string>("");
  const [r3, setR3] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readConfigCharacteristic(
          device,
          BLE_SERVICE_UUID,
          BLE_CHAR_NTC10K_UUID
        );
        if (config?.[NAMESPACE_NTC10K]) {
          setT1(config[NAMESPACE_NTC10K][KEY_NTC10K_T1].toString());
          setR1(config[NAMESPACE_NTC10K][KEY_NTC10K_R1].toString());
          setT2(config[NAMESPACE_NTC10K][KEY_NTC10K_T2].toString());
          setR2(config[NAMESPACE_NTC10K][KEY_NTC10K_R2].toString());
          setT3(config[NAMESPACE_NTC10K][KEY_NTC10K_T3].toString());
          setR3(config[NAMESPACE_NTC10K][KEY_NTC10K_R3].toString());
        }
      } catch (error) {
        console.error("Error cargando configuración NTC 10K", error);
      }
    }
    loadConfig();
  }, [device]);

  async function handleSend() {
    setIsSending(true);
    const config = {
      [NAMESPACE_NTC10K]: {
        [KEY_NTC10K_T1]: parseFloat(t1),
        [KEY_NTC10K_R1]: parseFloat(r1),
        [KEY_NTC10K_T2]: parseFloat(t2),
        [KEY_NTC10K_R2]: parseFloat(r2),
        [KEY_NTC10K_T3]: parseFloat(t3),
        [KEY_NTC10K_R3]: parseFloat(r3),
      },
    };
    try {
      const jsonConfig = JSON.stringify(config);
      const base64Config = btoa(jsonConfig);
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_NTC10K_UUID,
        base64Config
      );
      Alert.alert("Éxito", "Configuración NTC 10K enviada correctamente");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la configuración"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ConfigSection title="Configuración NTC 10K">
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T1 (°C):</Text>
        <TextInput
          style={styles.input}
          value={t1}
          onChangeText={setT1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>R1 (Ω):</Text>
        <TextInput
          style={styles.input}
          value={r1}
          onChangeText={setR1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T2 (°C):</Text>
        <TextInput
          style={styles.input}
          value={t2}
          onChangeText={setT2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>R2 (Ω):</Text>
        <TextInput
          style={styles.input}
          value={r2}
          onChangeText={setR2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T3 (°C):</Text>
        <TextInput
          style={styles.input}
          value={t3}
          onChangeText={setT3}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>R3 (Ω):</Text>
        <TextInput
          style={styles.input}
          value={r3}
          onChangeText={setR3}
          keyboardType="numeric"
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.buttonText}>
          {isSending ? "Enviando..." : "Enviar configuración"}
        </Text>
      </TouchableOpacity>
    </ConfigSection>
  );
}

// ─── FORMULARIO: Configuración de Conductividad ─────────────────────
interface ConductivityConfigFormProps {
  device: Device;
}

export function ConductivityConfigForm({
  device,
}: ConductivityConfigFormProps) {
  const [calTemp, setCalTemp] = useState<string>("");
  const [coefComp, setCoefComp] = useState<string>("");
  const [v1, setV1] = useState<string>("");
  const [t1, setT1] = useState<string>("");
  const [v2, setV2] = useState<string>("");
  const [t2, setT2] = useState<string>("");
  const [v3, setV3] = useState<string>("");
  const [t3, setT3] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readConfigCharacteristic(
          device,
          BLE_SERVICE_UUID,
          BLE_CHAR_CONDUCTIVITY_UUID
        );
        if (config?.[NAMESPACE_COND]) {
          setCalTemp(config[NAMESPACE_COND][KEY_CONDUCT_CT].toString());
          setCoefComp(config[NAMESPACE_COND][KEY_CONDUCT_CC].toString());
          setV1(config[NAMESPACE_COND][KEY_CONDUCT_V1].toString());
          setT1(config[NAMESPACE_COND][KEY_CONDUCT_T1].toString());
          setV2(config[NAMESPACE_COND][KEY_CONDUCT_V2].toString());
          setT2(config[NAMESPACE_COND][KEY_CONDUCT_T2].toString());
          setV3(config[NAMESPACE_COND][KEY_CONDUCT_V3].toString());
          setT3(config[NAMESPACE_COND][KEY_CONDUCT_T3].toString());
        }
      } catch (error) {
        console.error("Error cargando configuración de Conductividad", error);
      }
    }
    loadConfig();
  }, [device]);

  async function handleSend() {
    setIsSending(true);
    const config = {
      [NAMESPACE_COND]: {
        [KEY_CONDUCT_CT]: parseFloat(calTemp),
        [KEY_CONDUCT_CC]: parseFloat(coefComp),
        [KEY_CONDUCT_V1]: parseFloat(v1),
        [KEY_CONDUCT_T1]: parseFloat(t1),
        [KEY_CONDUCT_V2]: parseFloat(v2),
        [KEY_CONDUCT_T2]: parseFloat(t2),
        [KEY_CONDUCT_V3]: parseFloat(v3),
        [KEY_CONDUCT_T3]: parseFloat(t3),
      },
    };
    try {
      const jsonConfig = JSON.stringify(config);
      const base64Config = btoa(jsonConfig);
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_CONDUCTIVITY_UUID,
        base64Config
      );
      Alert.alert(
        "Éxito",
        "Configuración de Conductividad enviada correctamente"
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la configuración"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ConfigSection title="Configuración de Conductividad">
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Temp. calibración (°C):</Text>
        <TextInput
          style={styles.input}
          value={calTemp}
          onChangeText={setCalTemp}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Coef. Compensación:</Text>
        <TextInput
          style={styles.input}
          value={coefComp}
          onChangeText={setCoefComp}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Voltaje 1:</Text>
        <TextInput
          style={styles.input}
          value={v1}
          onChangeText={setV1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T1:</Text>
        <TextInput
          style={styles.input}
          value={t1}
          onChangeText={setT1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Voltaje 2:</Text>
        <TextInput
          style={styles.input}
          value={v2}
          onChangeText={setV2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T2:</Text>
        <TextInput
          style={styles.input}
          value={t2}
          onChangeText={setT2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Voltaje 3:</Text>
        <TextInput
          style={styles.input}
          value={v3}
          onChangeText={setV3}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T3:</Text>
        <TextInput
          style={styles.input}
          value={t3}
          onChangeText={setT3}
          keyboardType="numeric"
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.buttonText}>
          {isSending ? "Enviando..." : "Enviar configuración"}
        </Text>
      </TouchableOpacity>
    </ConfigSection>
  );
}

// ─── FORMULARIO: Configuración pH (Nuevos) ──────────────────────────
interface PHConfigFormProps {
  device: Device;
}

export function PHConfigForm({ device }: PHConfigFormProps) {
  const [v1, setV1] = useState<string>("");
  const [t1, setT1] = useState<string>("");
  const [v2, setV2] = useState<string>("");
  const [t2, setT2] = useState<string>("");
  const [v3, setV3] = useState<string>("");
  const [t3, setT3] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readConfigCharacteristic(
          device,
          BLE_SERVICE_UUID,
          BLE_CHAR_PH_UUID
        );
        if (config?.[NAMESPACE_PH]) {
          setV1(config[NAMESPACE_PH][KEY_PH_V1].toString());
          setT1(config[NAMESPACE_PH][KEY_PH_T1].toString());
          setV2(config[NAMESPACE_PH][KEY_PH_V2].toString());
          setT2(config[NAMESPACE_PH][KEY_PH_T2].toString());
          setV3(config[NAMESPACE_PH][KEY_PH_V3].toString());
          setT3(config[NAMESPACE_PH][KEY_PH_T3].toString());
        }
      } catch (error) {
        console.error("Error cargando configuración pH", error);
      }
    }
    loadConfig();
  }, [device]);

  async function handleSend() {
    setIsSending(true);
    const config = {
      [NAMESPACE_PH]: {
        [KEY_PH_V1]: parseFloat(v1),
        [KEY_PH_T1]: parseFloat(t1),
        [KEY_PH_V2]: parseFloat(v2),
        [KEY_PH_T2]: parseFloat(t2),
        [KEY_PH_V3]: parseFloat(v3),
        [KEY_PH_T3]: parseFloat(t3),
      },
    };
    try {
      const jsonConfig = JSON.stringify(config);
      const base64Config = btoa(jsonConfig);
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_PH_UUID,
        base64Config
      );
      Alert.alert("Éxito", "Configuración pH enviada correctamente");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la configuración"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ConfigSection title="Configuración pH">
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Voltaje 1:</Text>
        <TextInput
          style={styles.input}
          value={v1}
          onChangeText={setV1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T1:</Text>
        <TextInput
          style={styles.input}
          value={t1}
          onChangeText={setT1}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Voltaje 2:</Text>
        <TextInput
          style={styles.input}
          value={v2}
          onChangeText={setV2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T2:</Text>
        <TextInput
          style={styles.input}
          value={t2}
          onChangeText={setT2}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Voltaje 3:</Text>
        <TextInput
          style={styles.input}
          value={v3}
          onChangeText={setV3}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>T3:</Text>
        <TextInput
          style={styles.input}
          value={t3}
          onChangeText={setT3}
          keyboardType="numeric"
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.buttonText}>
          {isSending ? "Enviando..." : "Enviar configuración"}
        </Text>
      </TouchableOpacity>
    </ConfigSection>
  );
}

// ─── FORMULARIO: Configuración de Sensores (Nuevos) ─────────────────
interface SensorsConfigFormProps {
  device: Device;
}

export function SensorsConfigForm({ device }: SensorsConfigFormProps) {
  const [sensorId, setSensorId] = useState<string>("");
  const [sensorType, setSensorType] = useState<string>("");
  const [sensorEnable, setSensorEnable] = useState<boolean>(false);
  const [sensorTimestamp, setSensorTimestamp] = useState<string>("");
  const [sensorValue, setSensorValue] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readConfigCharacteristic(
          device,
          BLE_SERVICE_UUID,
          BLE_CHAR_SENSORS_UUID
        );
        if (config?.[NAMESPACE_SENSORS]) {
          setSensorId(config[NAMESPACE_SENSORS][KEY_SENSOR_ID] || "");
          setSensorType(config[NAMESPACE_SENSORS][KEY_SENSOR_TYPE] || "");
          setSensorEnable(!!config[NAMESPACE_SENSORS][KEY_SENSOR_ENABLE]);
          setSensorTimestamp(
            config[NAMESPACE_SENSORS][KEY_SENSOR_TIMESTAMP]?.toString() || ""
          );
          setSensorValue(
            config[NAMESPACE_SENSORS][KEY_SENSOR_VALUE]?.toString() || ""
          );
        }
      } catch (error) {
        console.error("Error cargando configuración de Sensores", error);
      }
    }
    loadConfig();
  }, [device]);

  async function handleSend() {
    setIsSending(true);
    const config = {
      [NAMESPACE_SENSORS]: {
        [KEY_SENSOR_ID]: sensorId,
        [KEY_SENSOR_TYPE]: sensorType,
        [KEY_SENSOR_ENABLE]: sensorEnable,
      },
    };
    try {
      const jsonConfig = JSON.stringify(config);
      const base64Config = btoa(jsonConfig);
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_SENSORS_UUID,
        base64Config
      );
      Alert.alert("Éxito", "Configuración de Sensores enviada correctamente");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la configuración"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ConfigSection title="Configuración de Sensores">
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>ID del sensor:</Text>
        <TextInput
          style={styles.input}
          value={sensorId}
          onChangeText={setSensorId}
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Tipo de sensor:</Text>
        <TextInput
          style={styles.input}
          value={sensorType}
          onChangeText={setSensorType}
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Habilitado:</Text>
        <Switch value={sensorEnable} onValueChange={setSensorEnable} />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Timestamp:</Text>
        <Text style={styles.readonlyText}>{sensorTimestamp}</Text>
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Valor:</Text>
        <Text style={styles.readonlyText}>{sensorValue}</Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.buttonText}>
          {isSending ? "Enviando..." : "Enviar configuración"}
        </Text>
      </TouchableOpacity>
    </ConfigSection>
  );
}

// ─── FORMULARIO: Configuración LoRa ──────────────────────────────────
interface LoRaConfigFormProps {
  device: Device;
}

// Añade estas funciones helper para la validación y formato
function formatHexToDevAddr(hex: string): string {
  // Elimina '0x' si existe y convierte a mayúsculas
  return `0x${hex.replace(/^0x/i, "").toUpperCase()}`;
}

function formatKeyString(key: string): string {
  // Elimina espacios y comas, convierte a mayúsculas
  const cleanKey = key.replace(/[\s,]/g, "").toUpperCase();
  // Agrupa en pares y une con comas
  return cleanKey.match(/.{2}/g)?.join(",") || "";
}

function isValidDevAddr(addr: string): boolean {
  return /^(0x)?[0-9A-Fa-f]{8}$/.test(addr);
}

function isValidKey(key: string): boolean {
  const cleanKey = key.replace(/[\s,]/g, "");
  return /^[0-9A-Fa-f]{32}$/.test(cleanKey);
}

export function LoRaConfigForm({ device }: LoRaConfigFormProps) {
  const [devAddr, setDevAddr] = useState<string>("");
  const [fNwkSIntKey, setFNwkSIntKey] = useState<string>("");
  const [sNwkSIntKey, setSNwkSIntKey] = useState<string>("");
  const [nwkSEncKey, setNwkSEncKey] = useState<string>("");
  const [appSKey, setAppSKey] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readConfigCharacteristic(
          device,
          BLE_SERVICE_UUID,
          BLE_CHAR_LORA_CONFIG_UUID
        );
        if (config?.[NAMESPACE_LORAWAN]) {
          const loraConfig = config[NAMESPACE_LORAWAN];

          // Soporte para devAddr: si viene como string se quita el '0x',
          // si viene como number se convierte a hexadecimal de 8 dígitos.
          if (loraConfig[KEY_LORA_DEVADDR] != null) {
            if (typeof loraConfig[KEY_LORA_DEVADDR] === "string") {
              setDevAddr(loraConfig[KEY_LORA_DEVADDR].replace(/^0x/i, ""));
            } else if (typeof loraConfig[KEY_LORA_DEVADDR] === "number") {
              setDevAddr(
                loraConfig[KEY_LORA_DEVADDR].toString(16)
                  .padStart(8, "0")
                  .toUpperCase()
              );
            } else {
              setDevAddr("");
            }
          } else {
            setDevAddr("");
          }

          setFNwkSIntKey(
            typeof loraConfig[KEY_LORA_FNWS_INTKEY] === "string"
              ? loraConfig[KEY_LORA_FNWS_INTKEY].replace(/,/g, "")
              : ""
          );

          setSNwkSIntKey(
            typeof loraConfig[KEY_LORA_SNWS_INTKEY] === "string"
              ? loraConfig[KEY_LORA_SNWS_INTKEY].replace(/,/g, "")
              : ""
          );

          setNwkSEncKey(
            typeof loraConfig[KEY_LORA_NWKSENC_KEY] === "string"
              ? loraConfig[KEY_LORA_NWKSENC_KEY].replace(/,/g, "")
              : ""
          );

          setAppSKey(
            typeof loraConfig[KEY_LORA_APPS_KEY] === "string"
              ? loraConfig[KEY_LORA_APPS_KEY].replace(/,/g, "")
              : ""
          );
        }
      } catch (error) {
        console.error("Error cargando configuración LoRa", error);
      }
    }
    loadConfig();
  }, [device]);

  function validateFields(): boolean {
    const newErrors: Record<string, string> = {};

    if (!isValidDevAddr(devAddr)) {
      newErrors.devAddr = "DevAddr debe ser un valor hexadecimal de 8 dígitos";
    }
    if (!isValidKey(fNwkSIntKey)) {
      newErrors.fNwkSIntKey =
        "fNwkSIntKey debe ser un valor hexadecimal de 32 dígitos";
    }
    if (!isValidKey(sNwkSIntKey)) {
      newErrors.sNwkSIntKey =
        "sNwkSIntKey debe ser un valor hexadecimal de 32 dígitos";
    }
    if (!isValidKey(nwkSEncKey)) {
      newErrors.nwkSEncKey =
        "nwkSEncKey debe ser un valor hexadecimal de 32 dígitos";
    }
    if (!isValidKey(appSKey)) {
      newErrors.appSKey = "appSKey debe ser un valor hexadecimal de 32 dígitos";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSend() {
    if (!validateFields()) {
      Alert.alert("Error", "Por favor, corrige los errores antes de enviar");
      return;
    }

    setIsSending(true);
    const config = {
      [NAMESPACE_LORAWAN]: {
        [KEY_LORA_DEVADDR]: formatHexToDevAddr(devAddr),
        [KEY_LORA_FNWS_INTKEY]: formatKeyString(fNwkSIntKey),
        [KEY_LORA_SNWS_INTKEY]: formatKeyString(sNwkSIntKey),
        [KEY_LORA_NWKSENC_KEY]: formatKeyString(nwkSEncKey),
        [KEY_LORA_APPS_KEY]: formatKeyString(appSKey),
      },
    };

    try {
      const jsonConfig = JSON.stringify(config);
      const base64Config = btoa(jsonConfig);
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_LORA_CONFIG_UUID,
        base64Config
      );
      Alert.alert("Éxito", "Configuración de LoRa enviada correctamente");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la configuración"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ConfigSection title="Configuración LoRa">
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>DevAddr (hex):</Text>
        <TextInput
          style={[styles.input, errors.devAddr && styles.inputError]}
          value={devAddr}
          onChangeText={(text) => setDevAddr(text.replace(/[^0-9A-Fa-f]/g, ""))}
          placeholder="Ejemplo: 00BFE104"
          autoCapitalize="characters"
          maxLength={8}
        />
        {errors.devAddr && (
          <Text style={styles.errorText}>{errors.devAddr}</Text>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>fNwkSIntKey (hex):</Text>
        <TextInput
          style={[styles.input, errors.fNwkSIntKey && styles.inputError]}
          value={fNwkSIntKey}
          onChangeText={(text) =>
            setFNwkSIntKey(text.replace(/[^0-9A-Fa-f]/g, ""))
          }
          placeholder="32 caracteres hexadecimales"
          autoCapitalize="characters"
          maxLength={32}
        />
        {errors.fNwkSIntKey && (
          <Text style={styles.errorText}>{errors.fNwkSIntKey}</Text>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>sNwkSIntKey (hex):</Text>
        <TextInput
          style={[styles.input, errors.sNwkSIntKey && styles.inputError]}
          value={sNwkSIntKey}
          onChangeText={(text) =>
            setSNwkSIntKey(text.replace(/[^0-9A-Fa-f]/g, ""))
          }
          placeholder="32 caracteres hexadecimales"
          autoCapitalize="characters"
          maxLength={32}
        />
        {errors.sNwkSIntKey && (
          <Text style={styles.errorText}>{errors.sNwkSIntKey}</Text>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>nwkSEncKey (hex):</Text>
        <TextInput
          style={[styles.input, errors.nwkSEncKey && styles.inputError]}
          value={nwkSEncKey}
          onChangeText={(text) =>
            setNwkSEncKey(text.replace(/[^0-9A-Fa-f]/g, ""))
          }
          placeholder="32 caracteres hexadecimales"
          autoCapitalize="characters"
          maxLength={32}
        />
        {errors.nwkSEncKey && (
          <Text style={styles.errorText}>{errors.nwkSEncKey}</Text>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>appSKey (hex):</Text>
        <TextInput
          style={[styles.input, errors.appSKey && styles.inputError]}
          value={appSKey}
          onChangeText={(text) => setAppSKey(text.replace(/[^0-9A-Fa-f]/g, ""))}
          placeholder="32 caracteres hexadecimales"
          autoCapitalize="characters"
          maxLength={32}
        />
        {errors.appSKey && (
          <Text style={styles.errorText}>{errors.appSKey}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, isSending && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.buttonText}>
          {isSending ? "Enviando..." : "Enviar configuración"}
        </Text>
      </TouchableOpacity>
    </ConfigSection>
  );
}

// ─── PANTALLA PRINCIPAL: Configuración BLE ──────────────────────────
export function BleConfigScreen() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Función para desconectar el dispositivo y limpiar la selección
  async function handleDisconnect() {
    if (selectedDevice) {
      try {
        await selectedDevice.cancelConnection();
        console.log("Desconectado exitosamente del dispositivo BLE");
      } catch (error) {
        console.error("Error al desconectar del dispositivo:", error);
      }
    }
    setSelectedDevice(null);
  }

  // Efecto para asegurar que se desconecta el dispositivo al desmontar la pantalla
  useEffect(() => {
    return () => {
      if (selectedDevice) {
        selectedDevice
          .cancelConnection()
          .then(() =>
            console.log("Dispositivo BLE desconectado al salir de la sección")
          )
          .catch((err) =>
            console.warn("Error al desconectar durante desmontaje:", err)
          );
      }
    };
  }, [selectedDevice]);

  if (!selectedDevice) {
    return <BleDeviceSelection onDeviceSelected={setSelectedDevice} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          Dispositivo seleccionado: {selectedDevice.name}
        </Text>
        <TouchableOpacity
          onPress={handleDisconnect}
          style={styles.disconnectButton}
        >
          <Text style={styles.disconnectButtonText}>Cambiar dispositivo</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.mainTitle}>Configuración BLE</Text>
      <SystemConfigForm device={selectedDevice} />
      <NTC100KConfigForm device={selectedDevice} />
      <NTC10KConfigForm device={selectedDevice} />
      <ConductivityConfigForm device={selectedDevice} />
      <PHConfigForm device={selectedDevice} />
      <SensorsConfigForm device={selectedDevice} />
      <LoRaConfigForm device={selectedDevice} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#ffffff",
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  deviceInfo: {
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  disconnectButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  disconnectButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  sectionContent: {},
  fieldContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
  },
  input: {
    height: 40,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  readonlyText: {
    padding: 8,
    backgroundColor: "#e5e5e5",
    borderRadius: 4,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#0284c7",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
  },
});
