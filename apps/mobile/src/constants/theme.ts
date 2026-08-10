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

/**
 * Devour's own app-shell chrome (currently just BrandSelectScreen) — a single
 * palette, not a light/dark pair, since it's one screen and not worth doubling
 * up for. Once inside a brand's storefront, that brand's own colors take over.
 */
export const devourColors: ColorPalette = {
  background: "#0E0B09",
  surface: "#1C1613",
  text: "#F5EFE9",
  muted: "#A89A8C",
  primary: "#E8792C",
  accent: "#E8792C",
  danger: "#E5675C",
  border: "#332822",
};

export const theme = {
  spacing: (n: number) => n * 8,
  radius: 12,
};
