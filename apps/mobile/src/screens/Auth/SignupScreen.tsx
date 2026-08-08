import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { signupRequest } from "../../api/auth.api";
import { theme } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;
type SignupMethod = "email" | "phone";

export function SignupScreen({ navigation }: Props) {
  const [method, setMethod] = useState<SignupMethod>("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function handleSignup() {
    setSubmitting(true);
    try {
      const { token, user } = await signupRequest({
        fullName,
        password,
        email: method === "email" ? email : undefined,
        phone: method === "phone" ? phone : undefined,
      });
      await setSession(token, user);
      // No further navigation needed — the root navigator switches to the
      // logged-in stack (starting at Menu) as soon as the session is set.
    } catch {
      Alert.alert("Signup failed", method === "email" ? "That email may already be registered." : "That phone number may already be registered.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create an Account</Text>
      <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />

      <View style={styles.methodRow}>
        <Pressable style={[styles.methodTab, method === "email" && styles.methodTabActive]} onPress={() => setMethod("email")}>
          <Text style={[styles.methodText, method === "email" && styles.methodTextActive]}>Email</Text>
        </Pressable>
        <Pressable style={[styles.methodTab, method === "phone" && styles.methodTabActive]} onPress={() => setMethod("phone")}>
          <Text style={[styles.methodText, method === "phone" && styles.methodTextActive]}>Phone</Text>
        </Pressable>
      </View>

      {method === "email" ? (
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      ) : (
        <TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      )}

      <TextInput style={styles.input} placeholder="Password (min. 8 characters)" value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable style={styles.button} onPress={handleSignup} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Creating account…" : "Create Account"}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2), justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: theme.spacing(2) },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing(1.25), marginBottom: theme.spacing(1) },
  methodRow: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(1) },
  methodTab: { flex: 1, padding: theme.spacing(1), borderRadius: theme.radius, backgroundColor: theme.colors.surface, alignItems: "center" },
  methodTabActive: { backgroundColor: theme.colors.primary },
  methodText: { color: theme.colors.text, fontWeight: "600" },
  methodTextActive: { color: "#fff" },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: "center", marginTop: theme.spacing(1) },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { textAlign: "center", color: theme.colors.primary, marginTop: theme.spacing(2) },
});
