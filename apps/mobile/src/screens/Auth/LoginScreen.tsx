import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { loginRequest } from "../../api/auth.api";
import { theme } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function handleLogin() {
    setSubmitting(true);
    try {
      const { token, user } = await loginRequest({ email, password });
      await setSession(token, user);
      navigation.navigate("Account");
    } catch {
      Alert.alert("Login failed", "Check your email and password and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Log In</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable style={styles.button} onPress={handleLogin} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Logging in…" : "Log In"}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.link}>New here? Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2), justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: theme.spacing(2) },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing(1.25), marginBottom: theme.spacing(1) },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: "center", marginTop: theme.spacing(1) },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { textAlign: "center", color: theme.colors.primary, marginTop: theme.spacing(2) },
});
