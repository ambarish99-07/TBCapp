import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { create } from "zustand";
import { darkColors, lightColors, theme, type ColorPalette } from "../constants/theme";

const THEME_MODE_KEY = "tbc_theme_mode";

export type ThemeMode = "light" | "dark" | "system";

function resolveScheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  return mode;
}

interface ThemeState {
  mode: ThemeMode;
  resolvedScheme: "light" | "dark";
  isHydrating: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",
  resolvedScheme: resolveScheme("system"),
  isHydrating: true,

  hydrate: async () => {
    const saved = await SecureStore.getItemAsync(THEME_MODE_KEY);
    const mode: ThemeMode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    set({ mode, resolvedScheme: resolveScheme(mode), isHydrating: false });
  },

  setMode: async (mode) => {
    await SecureStore.setItemAsync(THEME_MODE_KEY, mode);
    set({ mode, resolvedScheme: resolveScheme(mode) });
  },
}));

// Keeps "system" mode live if the OS theme changes while the app is open —
// doesn't fire for explicit light/dark choices, which are meant to stick.
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode } = useThemeStore.getState();
  if (mode === "system") {
    useThemeStore.setState({ resolvedScheme: colorScheme === "dark" ? "dark" : "light" });
  }
});

/** The one hook screens use — resolves to the active color palette plus the mode controls. */
export function useTheme(): { colors: ColorPalette; mode: ThemeMode; resolvedScheme: "light" | "dark"; setMode: (mode: ThemeMode) => Promise<void>; spacing: (n: number) => number; radius: number } {
  const mode = useThemeStore((s) => s.mode);
  const resolvedScheme = useThemeStore((s) => s.resolvedScheme);
  const setMode = useThemeStore((s) => s.setMode);
  const colors = resolvedScheme === "dark" ? darkColors : lightColors;
  return { colors, mode, resolvedScheme, setMode, spacing: theme.spacing, radius: theme.radius };
}
