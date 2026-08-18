import { useState } from "react";
import {
  SafeAreaView,
  Text,
  TextInput,
  Pressable,
  View,
  ScrollView,
} from "react-native";

const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [apps, setApps] = useState([]);
  const [error, setError] = useState("");

  async function login() {
    setError("");
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Login failed");
      return;
    }
    setToken(body.accessToken ?? body.token ?? "");
  }

  async function loadApps() {
    const res = await fetch(`${API}/api/v1/applications`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    setApps(body.applications ?? []);
  }

  async function approve(id) {
    const res = await fetch(`${API}/api/v1/applications/${id}/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Approve failed");
      return;
    }
    await loadApps();
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>JobAutomater</Text>
      {!token ? (
        <View style={{ marginTop: 24, gap: 8 }}>
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={{ borderWidth: 1, padding: 8 }}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{ borderWidth: 1, padding: 8 }}
          />
          <Pressable onPress={login} style={{ padding: 12, borderWidth: 1 }}>
            <Text>Log in</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 16, flex: 1 }}>
          <Pressable onPress={loadApps} style={{ padding: 12, borderWidth: 1 }}>
            <Text>Refresh applications</Text>
          </Pressable>
          <ScrollView style={{ marginTop: 12 }}>
            {apps.map((a) => (
              <View key={a.id} style={{ paddingVertical: 8 }}>
                <Text>
                  {a.jobTitle ?? a.jobId} · {a.status}
                </Text>
                {a.canApprove ? (
                  <Pressable onPress={() => approve(a.id)}>
                    <Text>Approve (does not skip review gate)</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      {error ? <Text>{error}</Text> : null}
    </SafeAreaView>
  );
}
