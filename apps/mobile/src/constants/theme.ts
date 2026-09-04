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

// Blue + golden-yellow rebrand (2026-08-24) — primary swapped again from the green it briefly was
// (2026-08-23) to blue; accent stays the same gold. Same scoping as the green rebrand before it:
// only these two tokens, every screen that reads them (buttons, active states, links, badges)
// picks it up automatically. Several screens use their own hardcoded hex gradients for specific
// effects (Premium Membership's maroon-gold card, GG Tiffin's emerald footer pill, the dark bottom
// tab bar) that don't read from this palette and were left as-is.
export const lightColors: ColorPalette = {
  background: "#FFFFFF",
  surface: "#F7F3EF",
  text: "#241C15",
  muted: "#8A7B6C",
  // Lighter and more saturated than the first blue pass (#1E6FE0) — reads as a brighter, "glossy"
  // sky blue rather than a flatter, more muted navy-leaning one.
  primary: "#2E9BFF",
  accent: "#F5A623",
  danger: "#B3261E",
  border: "#E4DCD3",
};

// Neutral near-black dark palette (2026-09-04) — background/surface/muted/border moved off the
// old brownish-charcoal cast (#161210/#241C17/#3A2E22 all leaned warm/muddy) onto a true neutral
// near-black. Food photography and the gold/teal premium-card gradient sit on a lot of dark
// screen real estate, and a warm-brown backdrop dulled both; a neutral black reads richer and
// lets photos, the cream text, and the gold accent actually pop instead of blending into it.
// text/primary/accent/danger are unchanged from before this pass.
export const darkColors: ColorPalette = {
  background: "#0E0D0F",
  surface: "#1C1A1D",
  text: "#F2E9DE",
  muted: "#9D9690",
  // Lighter than the light-theme primary so it still pops against a near-black
  // background, but dark enough that the "#fff" text every button already uses
  // stays legible without having to make button-text colors theme-aware too.
  primary: "#6AB8FF",
  accent: "#F5A623",
  danger: "#E5675C",
  border: "#2E2B2C",
};

export const theme = {
  spacing: (n: number) => n * 8,
  radius: 12,
};
