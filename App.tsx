import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

// Definimos la interfaz para los datos de groups
interface Group {
  id: string;
  name: string;
  station_id: string;
  is_active: boolean;
  created_at: string;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSession(session);
    if (session) {
      fetchData();
    } else {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      fetchData();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setSession(null);
      setData([]);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData() {
    try {
      setError(null);
      console.log("Iniciando fetch de datos...");

      const { data: result, error: queryError } = await supabase
        .from("groups")
        .select("*")
        .throwOnError();

      if (queryError) {
        console.error("Error en la consulta:", queryError);
        throw queryError;
      }

      console.log("Datos recibidos:", result);
      setData(result || []);
    } catch (error: any) {
      console.error("Error detallado:", error);
      setError(error.message || "Error al cargar los datos");

      if (error.details) {
        console.error("Detalles del error:", error.details);
      }
      if (error.hint) {
        console.error("Sugerencia:", error.hint);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.inner}>
            <StatusBar style="auto" />
            <View style={styles.authContainer}>
              <Text style={styles.title}>Iniciar Sesión</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                importantForAutofill="yes"
              />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="password"
                importantForAutofill="yes"
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Cargando..." : "Iniciar Sesión"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Bienvenido, {session?.user?.email}
        </Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <Text style={styles.loadingText}>Cargando...</Text>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <Text style={styles.errorDetail}>
            Por favor, verifica las políticas de seguridad en Supabase
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          <Text style={styles.title}>Grupos Disponibles:</Text>
          {data.length === 0 ? (
            <Text style={styles.noDataText}>No hay grupos disponibles</Text>
          ) : (
            data.map((group) => (
              <View key={group.id} style={styles.groupCard}>
                <Text style={styles.groupId}>ID: {group.id}</Text>
                <Text style={styles.groupName}>Nombre: {group.name}</Text>
                <Text style={styles.groupDetail}>
                  Estación: {group.station_id}
                </Text>
                <Text style={styles.groupDetail}>
                  Estado: {group.is_active ? "Activo" : "Inactivo"}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  authContainer: {
    width: "100%",
    alignItems: "center",
  },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  button: {
    width: "100%",
    height: 48,
    backgroundColor: "#0284c7",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "500",
  },
  signOutButton: {
    padding: 8,
  },
  signOutButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 18,
    textAlign: "center",
  },
  errorContainer: {
    padding: 20,
    backgroundColor: "#ffebee",
    margin: 10,
    borderRadius: 8,
  },
  errorText: {
    color: "#c62828",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  errorDetail: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  },
  noDataText: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
  },
  groupCard: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  groupId: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  groupName: {
    fontSize: 18,
    marginBottom: 5,
  },
  groupDetail: {
    fontSize: 14,
    color: "#666",
  },
});
