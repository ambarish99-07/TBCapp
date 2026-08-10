import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { requestOtpRequest, verifyOtpRequest } from "../../api/auth.api";
import { OtpInput } from "../../components/OtpInput";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type PhoneStep = "enter" | "otp" | "name";

const RESEND_COOLDOWN_SECONDS = 30;

function isNetworkError(err: unknown): boolean {
  return err instanceof Error && err.message === "Network Error";
}

export function LoginScreen({}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const setSession = useAuthStore((state) => state.setSession);

  // Phone + OTP
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return undefined;
    const timer = setInterval(() => setResendSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  async function handleSendOtp(isResend: boolean) {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 7) {
      Alert.alert("Invalid number", "Please enter a valid mobile number.");
      return;
    }
    setSendingOtp(true);
    setOtpError(null);
    try {
      await requestOtpRequest({ phone: cleaned });
      setPhone(cleaned);
      setOtp("");
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      if (!isResend) setPhoneStep("otp");
    } catch (err) {
      Alert.alert(
        "Couldn't send code",
        isNetworkError(err) ? "Please check your internet connection and try again." : "We couldn't complete your request right now. Please try again."
      );
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const result = await verifyOtpRequest({ phone, otp: code, fullName: fullName || undefined });
      if ("requiresName" in result) {
        setPhoneStep("name");
        return;
      }
      await setSession(result.token, result.user);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401) setOtpError("The OTP is incorrect. Please try again.");
      else if (status === 429) setOtpError("Too many incorrect attempts. Please request a new code.");
      else if (isNetworkError(err)) setOtpError("Please check your internet connection and try again.");
      else setOtpError("This OTP has expired. Please request a new one.");
      setOtp("");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleCompleteSignup() {
    if (!fullName.trim()) {
      Alert.alert("What should we call you?", "Please enter your name to continue.");
      return;
    }
    await handleVerifyOtp(otp);
  }

  function handleChangeNumber() {
    setPhoneStep("enter");
    setOtp("");
    setOtpError(null);
    setFullName("");
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image source={require("../../../assets/splash-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandName}>Devour</Text>
          <Text style={styles.brandTagline}>One Place, Endless Cravings</Text>
        </View>

        {phoneStep === "enter" ? (
          <>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter mobile number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>
            <Pressable style={styles.button} onPress={() => handleSendOtp(false)} disabled={sendingOtp}>
              <Text style={styles.buttonText}>{sendingOtp ? "Sending…" : "Continue"}</Text>
            </Pressable>
          </>
        ) : phoneStep === "otp" ? (
          <>
            <Text style={styles.otpTitle}>Enter OTP</Text>
            <Text style={styles.otpHint}>We sent a verification code to{"\n"}+91 {phone}</Text>

            <OtpInput value={otp} onChange={setOtp} onComplete={handleVerifyOtp} autoFocus hasError={!!otpError} />
            {otpError && <Text style={styles.errorText}>{otpError}</Text>}
            {verifyingOtp && <Text style={styles.otpHint}>Verifying…</Text>}

            <View style={styles.resendRow}>
              {resendSecondsLeft > 0 ? (
                <Text style={styles.otpHint}>Resend OTP in 0:{resendSecondsLeft.toString().padStart(2, "0")}</Text>
              ) : (
                <Pressable onPress={() => handleSendOtp(true)} disabled={sendingOtp}>
                  <Text style={styles.link}>{sendingOtp ? "Sending…" : "Didn't receive the OTP? Resend OTP"}</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={handleChangeNumber}>
              <Text style={styles.link}>Change phone number</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.otpTitle}>Welcome!</Text>
            <Text style={styles.otpHint}>What should we call you?</Text>
            <TextInput style={styles.input} placeholder="Enter your name" value={fullName} onChangeText={setFullName} autoFocus />
            <Pressable style={styles.button} onPress={handleCompleteSignup} disabled={verifyingOtp}>
              <Text style={styles.buttonText}>{verifyingOtp ? "Creating account…" : "Continue"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    screen: { flexGrow: 1, padding: theme.spacing(2), justifyContent: "center" },
    brand: { alignItems: "center", marginBottom: theme.spacing(3) },
    logo: { width: 96, height: 96, borderRadius: 48, marginBottom: theme.spacing(1.5) },
    brandName: { fontSize: 22, fontWeight: "800", color: colors.primary },
    brandTagline: { fontSize: 13, color: colors.muted, marginTop: 4 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: theme.radius, padding: theme.spacing(1.25), marginBottom: theme.spacing(1), color: colors.text },
    phoneRow: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(1) },
    countryCode: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      paddingHorizontal: theme.spacing(1.5),
      justifyContent: "center",
    },
    countryCodeText: { fontSize: 16, fontWeight: "700", color: colors.text },
    phoneInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      fontSize: 16,
      color: colors.text,
    },
    otpTitle: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 4 },
    otpHint: { fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: theme.spacing(2) },
    errorText: { fontSize: 13, color: colors.danger, textAlign: "center", marginTop: theme.spacing(1) },
    resendRow: { alignItems: "center", marginTop: theme.spacing(2), marginBottom: theme.spacing(1) },
    button: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: "center", marginTop: theme.spacing(1) },
    buttonText: { color: "#fff", fontWeight: "700" },
    link: { textAlign: "center", color: colors.primary, marginTop: theme.spacing(2) },
  });
