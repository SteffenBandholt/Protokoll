// src/renderer/utils/ampelColors.js

export function ampelHexFrom(color) {
  const s = (color || "").toString().trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("#")) return s;
  if (s.startsWith("rgb(") || s.startsWith("rgba(")) return s;
  if (s === "gruen" || s === "grün") return "#2e7d32";
  if (s === "orange" || s === "gelb") return "#ef6c00";
  if (s === "rot") return "#c62828";
  if (s === "blau") return "#1565c0";
  return null;
}
