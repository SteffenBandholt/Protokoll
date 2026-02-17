// src/renderer/ui/popupButtonStyles.js

export function applyPopupButtonStyle(btn, { variant = "neutral" } = {}) {
  if (!btn || !btn.style) return;
  btn.style.padding = "6px 10px";
  btn.style.borderRadius = "8px";
  btn.style.fontWeight = "600";
  btn.style.minHeight = "30px";
  btn.style.cursor = "pointer";
  btn.style.transition = "background 120ms ease, box-shadow 120ms ease, border-color 120ms ease";

  if (variant === "primary" || variant === "danger" || variant === "warn") {
    btn.dataset.variant = variant;
  } else {
    delete btn.dataset.variant;
  }
}

export function applyPopupCardStyle(card) {
  if (!card || !card.style) return;
  card.style.border = "1px solid var(--card-border)";
  card.style.borderRadius = "10px";
  card.style.background = "var(--card-bg)";
  card.style.boxShadow = "0 1px 0 rgba(0,0,0,0.05)";
  card.style.color = "var(--text-main)";
}
