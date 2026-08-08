import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { loginRequest, requestOtpRequest, verifyOtpRequest } from "../../api/auth.api";
import { theme } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type LoginMethod = "email" | "phone";

export function LoginScreen({ navigation }: Props) {
  const [method, setMethod] = useState<LoginMethod>("email");
  const setSession = useAuthStore((state) => state.setSession);

  // Email + password
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submittingEmail, setSubmittingEmail] = useState(false);

  // Phone + OTP
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  async function handleEmailLogin() {
    setSubmittingEmail(true);
    try {
      const { token, user } = await loginRequest({ identifier, password });
      await setSession(token, user);
      // No further navigation needed — the root navigator switches to the
      // logged-in stack (starting at Menu) as soon as the session is set.
    } catch {
      Alert.alert("Login failed", "Check your email/phone and password and try again.");
    } finally {
      setSubmittingEmail(false);
    }
  }

  async function handleSendOtp() {
    setSendingOtp(true);
    try {
      await requestOtpRequest({ phone });
      setOtpSent(true);
    } catch {
      Alert.alert("Couldn't send code", "Check the phone number and try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    setVerifyingOtp(true);
    try {
      const { token, user } = await verifyOtpRequest({ phone, otp, fullName: fullName || undefined });
      await setSession(token, user);
    } catch {
      Alert.alert("Verification failed", "That code is invalid, or a full name is needed for a new account.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Log In</Text>

      <View style={styles.methodRow}>
        <Pressable style={[styles.methodTab, method === "email" && styles.methodTabActive]} onPress={() => setMethod("email")}>
          <Text style={[styles.methodText, method === "email" && styles.methodTextActive]}>Email</Text>
        </Pressable>
        <Pressable style={[styles.methodTab, method === "phone" && styles.methodTabActive]} onPress={() => setMethod("phone")}>
          <Text style={[styles.methodText, method === "phone" && styles.methodTextActive]}>Phone (OTP)</Text>
        </Pressable>
      </View>

      {method === "email" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email or phone number"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Pressable style={styles.button} onPress={handleEmailLogin} disabled={submittingEmail}>
            <Text style={styles.buttonText}>{submittingEmail ? "Logging in…" : "Log In"}</Text>
          </Pressable>
        </>
      ) : (
        <>
          {!otpSent ? (
            <>
              <TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Pressable style={styles.button} onPress={handleSendOtp} disabled={sendingOtp}>
                <Text style={styles.buttonText}>{sendingOtp ? "Sending code…" : "Send OTP"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.otpHint}>Code sent to {phone}.</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                style={styles.input}
                placeholder="Full name (only needed if this is a new account)"
                value={fullName}
                onChangeText={setFullName}
              />
              <Pressable style={styles.button} onPress={handleVerifyOtp} disabled={verifyingOtp}>
                <Text style={styles.buttonText}>{verifyingOtp ? "Verifying…" : "Verify & Log In"}</Text>
              </Pressable>
              <Pressable onPress={() => setOtpSent(false)}>
                <Text style={styles.link}>Change phone number</Text>
              </Pressable>
            </>
          )}
        </>
      )}

      <Pressable onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.link}>New here? Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2), justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: theme.spacing(2) },
  methodRow: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(1.5) },
  methodTab: { flex: 1, padding: theme.spacing(1), borderRadius: theme.radius, backgroundColor: theme.colors.surface, alignItems: "center" },
  methodTabActive: { backgroundColor: theme.colors.primary },
  methodText: { color: theme.colors.text, fontWeight: "600" },
  methodTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing(1.25), marginBottom: theme.spacing(1) },
  otpHint: { fontSize: 12, color: theme.colors.muted, marginBottom: theme.spacing(1) },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: "center", marginTop: theme.spacing(1) },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { textAlign: "center", color: theme.colors.primary, marginTop: theme.spacing(2) },
});
