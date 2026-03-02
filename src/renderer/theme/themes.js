// src/renderer/theme/themes.js

export const DEFAULT_THEME_SETTINGS = {
  headerBaseColor: "#F4F4F9",
  sidebarBaseColor: "#696969",
  mainBaseColor: "#F8FAFC",
  headerTone: 43, // 0 = hell, 50 = Basisfarbe, 100 = dunkel
  sidebarTone: 38,
  mainTone: 52,
  headerUseDefault: false,
  sidebarUseDefault: false,
  mainUseDefault: false,
};

function resolveThemeDefaults(raw = {}) {
  return {
    headerBaseColor: normalizeHexCandidate(
      raw.defaultHeaderBaseColor ?? raw["defaults.ui.themeHeaderBaseColor"],
      DEFAULT_THEME_SETTINGS.headerBaseColor
    ),
    sidebarBaseColor: normalizeHexCandidate(
      raw.defaultSidebarBaseColor ?? raw["defaults.ui.themeSidebarBaseColor"],
      DEFAULT_THEME_SETTINGS.sidebarBaseColor
    ),
    mainBaseColor: normalizeHexCandidate(
      raw.defaultMainBaseColor ?? raw["defaults.ui.themeMainBaseColor"],
      DEFAULT_THEME_SETTINGS.mainBaseColor
    ),
    headerTone: clamp(
      raw.defaultHeaderTone ?? raw["defaults.ui.themeHeaderTone"],
      0,
      100
    ),
    sidebarTone: clamp(
      raw.defaultSidebarTone ?? raw["defaults.ui.themeSidebarTone"],
      0,
      100
    ),
    mainTone: clamp(
      raw.defaultMainTone ?? raw["defaults.ui.themeMainTone"],
      0,
      100
    ),
    headerUseDefault: parseBool(
      raw.defaultHeaderUseDefault ?? raw["defaults.ui.themeHeaderUseDefault"],
      DEFAULT_THEME_SETTINGS.headerUseDefault
    ),
    sidebarUseDefault: parseBool(
      raw.defaultSidebarUseDefault ?? raw["defaults.ui.themeSidebarUseDefault"],
      DEFAULT_THEME_SETTINGS.sidebarUseDefault
    ),
    mainUseDefault: parseBool(
      raw.defaultMainUseDefault ?? raw["defaults.ui.themeMainUseDefault"],
      DEFAULT_THEME_SETTINGS.mainUseDefault
    ),
  };
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function toHex2(n) {
  return Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex({ r, g, b }) {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

function hexToRgb(hex) {
  const s = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: Number.parseInt(s.slice(0, 2), 16),
    g: Number.parseInt(s.slice(2, 4), 16),
    b: Number.parseInt(s.slice(4, 6), 16),
  };
}

function rgbText({ r, g, b }) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function mixRgb(a, b, ratio01) {
  const t = clamp(ratio01, 0, 1);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function adjustTone(baseHex, tone) {
  const base = hexToRgb(baseHex) || hexToRgb(DEFAULT_THEME_SETTINGS.mainBaseColor);
  const t = clamp(tone, 0, 100);
  if (t === 50) return rgbToHex(base);
  if (t < 50) {
    const ratio = (50 - t) / 50;
    return rgbToHex(mixRgb(base, { r: 255, g: 255, b: 255 }, ratio));
  }
  const ratio = (t - 50) / 50;
  return rgbToHex(mixRgb(base, { r: 0, g: 0, b: 0 }, ratio));
}

function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return 1;
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

function contrastText(bgHex) {
  return luminance(bgHex) > 0.55 ? "#0F172A" : "#E2E8F0";
}

function normalizeHexCandidate(raw, fallback) {
  const parsed = parseCssColor(raw);
  if (!parsed) return fallback;
  return parsed.hex;
}

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
  if (["0", "false", "no", "nein", "off"].includes(s)) return false;
  return fallback;
}

export function parseCssColor(raw) {
  const inputRaw = String(raw || "").trim();
  const alias = {
    blau: "blue",
    hellblau: "lightblue",
    gruen: "green",
    grün: "green",
    hellgruen: "lightgreen",
    hellgrün: "lightgreen",
    rot: "red",
    gelb: "yellow",
    orange: "orange",
    weiss: "white",
    weiß: "white",
    schwarz: "black",
    grau: "gray",
    hellgrau: "lightgray",
    dunkelgrau: "dimgray",
    lila: "purple",
    violett: "violet",
    pink: "hotpink",
    türkis: "turquoise",
    tuerkis: "turquoise",
    braun: "saddlebrown",
    beige: "beige",
  };
  const lower = inputRaw.toLowerCase();

  const fuzzyBase = () => {
    const isLight = lower.includes("hell");
    const isDark = lower.includes("dunkel");
    const pick = (lightHex, baseHex, darkHex) => {
      if (isLight) return lightHex;
      if (isDark) return darkHex;
      return baseHex;
    };
    if (lower.includes("blau")) return pick("#8EC5FF", "#3B82F6", "#1E3A8A");
    if (lower.includes("rot")) return pick("#FCA5A5", "#EF4444", "#991B1B");
    if (lower.includes("gruen") || lower.includes("grün")) return pick("#86EFAC", "#22C55E", "#166534");
    if (lower.includes("gelb")) return pick("#FDE68A", "#EAB308", "#A16207");
    if (lower.includes("orange")) return pick("#FDBA74", "#F97316", "#9A3412");
    if (lower.includes("lila") || lower.includes("violett")) return pick("#C4B5FD", "#8B5CF6", "#5B21B6");
    if (lower.includes("pink")) return pick("#FDA4AF", "#EC4899", "#9D174D");
    if (lower.includes("tuerkis") || lower.includes("türkis")) return pick("#99F6E4", "#14B8A6", "#115E59");
    if (lower.includes("grau")) return pick("#E5E7EB", "#9CA3AF", "#374151");
    return null;
  };

  const input = alias[lower] || fuzzyBase() || inputRaw;
  if (!input) return null;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#000000";
    const before = ctx.fillStyle;
    ctx.fillStyle = input;
    const out = ctx.fillStyle;
    if (out === before && input.toLowerCase() !== "#000" && input.toLowerCase() !== "#000000") {
      return null;
    }
    const rgb = hexToRgb(out);
    if (!rgb) return null;
    return {
      hex: rgbToHex(rgb),
      rgb,
      rgbText: rgbText(rgb),
    };
  } catch {
    return null;
  }
}

export function normalizeThemeSettings(raw = {}) {
  const def = resolveThemeDefaults(raw);
  const headerUseDefault = parseBool(
    raw.headerUseDefault ?? raw["ui.themeHeaderUseDefault"],
    def.headerUseDefault
  );
  const sidebarUseDefault = parseBool(
    raw.sidebarUseDefault ?? raw["ui.themeSidebarUseDefault"],
    def.sidebarUseDefault
  );
  const mainUseDefault = parseBool(
    raw.mainUseDefault ?? raw["ui.themeMainUseDefault"],
    def.mainUseDefault
  );

  return {
    headerBaseColor: normalizeHexCandidate(
      raw.headerBaseColor ?? raw["ui.themeHeaderBaseColor"],
      def.headerBaseColor
    ),
    sidebarBaseColor: normalizeHexCandidate(
      raw.sidebarBaseColor ?? raw["ui.themeSidebarBaseColor"],
      def.sidebarBaseColor
    ),
    mainBaseColor: normalizeHexCandidate(
      raw.mainBaseColor ?? raw["ui.themeMainBaseColor"],
      def.mainBaseColor
    ),
    headerTone: clamp(raw.headerTone ?? raw["ui.themeHeaderTone"], 0, 100),
    sidebarTone: clamp(raw.sidebarTone ?? raw["ui.themeSidebarTone"], 0, 100),
    mainTone: clamp(raw.mainTone ?? raw["ui.themeMainTone"], 0, 100),
    headerUseDefault,
    sidebarUseDefault,
    mainUseDefault,
  };
}

export function resolveTheme(themeSettings = {}) {
  const s = normalizeThemeSettings(themeSettings);
  const headerBase = s.headerUseDefault ? DEFAULT_THEME_SETTINGS.headerBaseColor : s.headerBaseColor;
  const sidebarBase = s.sidebarUseDefault ? DEFAULT_THEME_SETTINGS.sidebarBaseColor : s.sidebarBaseColor;
  const mainBase = s.mainUseDefault ? DEFAULT_THEME_SETTINGS.mainBaseColor : s.mainBaseColor;
  const headerTone = s.headerUseDefault ? DEFAULT_THEME_SETTINGS.headerTone : s.headerTone;
  const sidebarTone = s.sidebarUseDefault ? DEFAULT_THEME_SETTINGS.sidebarTone : s.sidebarTone;
  const mainTone = s.mainUseDefault ? DEFAULT_THEME_SETTINGS.mainTone : s.mainTone;

  const headerBg = adjustTone(headerBase, headerTone);
  const sidebarBg = adjustTone(sidebarBase, sidebarTone);
  const mainBg = adjustTone(mainBase, mainTone);
  const sidebarHoverBg = adjustTone(sidebarBase, clamp(sidebarTone + 10, 0, 100));
  const sidebarActiveBg = adjustTone(sidebarBase, clamp(sidebarTone - 12, 0, 100));
  const cardBg = adjustTone(mainBase, clamp(mainTone - 12, 0, 100));
  const cardBorder = adjustTone(mainBase, clamp(mainTone + 22, 0, 100));

  return {
    headerBg,
    headerText: contrastText(headerBg),
    sidebarBg,
    sidebarText: contrastText(sidebarBg),
    sidebarHoverBg,
    sidebarActiveBg,
    mainBg,
    mainText: contrastText(mainBg),
    cardBg,
    cardBorder,
  };
}

export function applyTheme(theme, overrides = {}) {
  const finalTheme = { ...(theme || {}), ...(overrides || {}) };
  const root = document.documentElement;
  root.style.setProperty("--header-bg", finalTheme.headerBg || DEFAULT_THEME_SETTINGS.headerBaseColor);
  root.style.setProperty("--header-text", finalTheme.headerText || "#0F172A");
  root.style.setProperty("--sidebar-bg", finalTheme.sidebarBg || DEFAULT_THEME_SETTINGS.sidebarBaseColor);
  root.style.setProperty("--sidebar-text", finalTheme.sidebarText || "#E2E8F0");
  root.style.setProperty("--sidebar-hover-bg", finalTheme.sidebarHoverBg || "#172554");
  root.style.setProperty("--sidebar-active-bg", finalTheme.sidebarActiveBg || "#1D4ED8");
  root.style.setProperty("--main-bg", finalTheme.mainBg || DEFAULT_THEME_SETTINGS.mainBaseColor);
  root.style.setProperty("--text-main", finalTheme.mainText || "#0F172A");
  root.style.setProperty("--card-bg", finalTheme.cardBg || "#FFFFFF");
  root.style.setProperty("--card-border", finalTheme.cardBorder || "#E2E8F0");
}

export function applyThemeForSettings(raw = {}) {
  const theme = resolveTheme(raw);
  applyTheme(theme);
  return theme;
}
