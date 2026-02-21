import { applyPopupCardStyle } from "./popupButtonStyles.js";
import { OVERLAY } from "./zIndex.js";

const CLOSE_HANDLERS = Symbol("bbm.popup.closeHandlers");

export function createPopupOverlay({ background = "rgba(0,0,0,0.25)", zIndex = OVERLAY } = {}) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = background;
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = String(zIndex);
  overlay.tabIndex = -1;
  overlay.dataset.bbmPopupOverlay = "1";
  return overlay;
}

export function stylePopupCard(modal, { width = "min(760px, calc(100vw - 24px))", maxHeight = "calc(100vh - 24px)" } = {}) {
  applyPopupCardStyle(modal);
  modal.style.width = width;
  modal.style.maxHeight = maxHeight;
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.overflow = "hidden";
}

export function registerPopupCloseHandlers(overlay, onClose, { closeOnBackdrop = true } = {}) {
  if (!overlay || typeof onClose !== "function") return () => {};

  const handleClick = (event) => {
    if (closeOnBackdrop && event.target === overlay) {
      onClose();
    }
  };

  const handleKey = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onClose();
  };

  overlay.addEventListener("mousedown", handleClick);
  overlay.addEventListener("keydown", handleKey);

  const cleanup = () => {
    overlay.removeEventListener("mousedown", handleClick);
    overlay.removeEventListener("keydown", handleKey);
  };

  const extra = overlay[CLOSE_HANDLERS] || [];
  extra.push(cleanup);
  overlay[CLOSE_HANDLERS] = extra;

  return cleanup;
}

export function cleanupPopupHandlers(overlay) {
  const handlers = overlay?.[CLOSE_HANDLERS] || [];
  for (const fn of handlers) {
    if (typeof fn === "function") fn();
  }
  overlay[CLOSE_HANDLERS] = [];
}
