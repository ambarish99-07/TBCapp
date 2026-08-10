export interface ColorPalette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  danger: string;
  border: string;
}

export const lightColors: ColorPalette = {
  background: "#FFFFFF",
  surface: "#F7F3EF",
  text: "#241C15",
  muted: "#8A7B6C",
  primary: "#6B3F2A",
  accent: "#D98E4A",
  danger: "#B3261E",
  border: "#E4DCD3",
};

export const darkColors: ColorPalette = {
  background: "#161210",
  surface: "#241C17",
  text: "#F2E9DE",
  muted: "#A8977F",
  // Lighter than the light-theme primary so it still pops against a near-black
  // background, but dark enough that the "#fff" text every button already uses
  // stays legible without having to make button-text colors theme-aware too.
  primary: "#9C6B3F",
  accent: "#D98E4A",
  danger: "#E5675C",
  border: "#3A2E22",
};

export const theme = {
  spacing: (n: number) => n * 8,
  radius: 12,
};
