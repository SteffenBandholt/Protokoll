// src/renderer/ui/HelpModal.js

import { applyPopupButtonStyle } from "./popupButtonStyles.js";
import { createPopupOverlay, stylePopupCard, registerPopupCloseHandlers } from "./popupCommon.js";
import { quickStart, glossary } from "../help/helpTexts.de.js";
import { OVERLAY_TOP } from "./zIndex.js";

const QUICK_ASSIST_ICON_URL = new URL("../assets/icons/quick-assist.svg", import.meta.url).href;

export default class HelpModal {
  constructor() {
    this.root = null;
    this.modal = null;
    this.body = null;
    this.btnQuickStart = null;
    this.btnGlossary = null;
    this.btnQuickAssist = null;
    this.btnInfo = null;
    this.quickAssistHint = null;
    this._isWindows = false;
    this.activeTab = "quickStart";
    this.infoOverlay = null;
  }

  _ensureDom() {
    if (this.root) return;
    const overlay = createPopupOverlay();
    registerPopupCloseHandlers(overlay, () => this.close());

    const modal = document.createElement("div");
    stylePopupCard(modal, { width: "min(760px, calc(100vw - 24px))" });

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.padding = "12px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Hilfe";
    title.style.fontWeight = "800";
    title.style.fontSize = "16px";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "X";
    applyPopupButtonStyle(closeBtn);
    closeBtn.style.marginLeft = "auto";
    closeBtn.onclick = () => this.close();

    head.append(title, closeBtn);

    const tabBar = document.createElement("div");
    tabBar.style.display = "flex";
    tabBar.style.gap = "8px";
    tabBar.style.padding = "10px 12px";
    tabBar.style.borderBottom = "1px solid #e2e8f0";

    const btnQuickStart = document.createElement("button");
    btnQuickStart.type = "button";
    btnQuickStart.textContent = "Erste Schritte";
    applyPopupButtonStyle(btnQuickStart);
    btnQuickStart.onclick = () => this._setTab("quickStart");

    const btnGlossary = document.createElement("button");
    btnGlossary.type = "button";
    btnGlossary.textContent = "Begriffe";
    applyPopupButtonStyle(btnGlossary);
    btnGlossary.onclick = () => this._setTab("glossary");

    tabBar.append(btnQuickStart, btnGlossary);

    const helpActions = document.createElement("div");
    helpActions.style.display = "flex";
    helpActions.style.alignItems = "center";
    helpActions.style.gap = "8px";
    helpActions.style.padding = "10px 12px";
    helpActions.style.borderBottom = "1px solid #e2e8f0";

    const btnQuickAssist = document.createElement("button");
    btnQuickAssist.type = "button";
    btnQuickAssist.style.display = "inline-flex";
    btnQuickAssist.style.alignItems = "center";
    btnQuickAssist.style.gap = "7px";
    applyPopupButtonStyle(btnQuickAssist);

    const quickAssistIcon = document.createElement("img");
    quickAssistIcon.src = QUICK_ASSIST_ICON_URL;
    quickAssistIcon.alt = "";
    quickAssistIcon.style.width = "14px";
    quickAssistIcon.style.height = "14px";
    quickAssistIcon.style.opacity = "0.85";
    quickAssistIcon.style.flex = "0 0 auto";

    const quickAssistLabel = document.createElement("span");
    quickAssistLabel.textContent = "Schnellhilfe (Windows)";

    btnQuickAssist.append(quickAssistIcon, quickAssistLabel);
    btnQuickAssist.onclick = async () => {
      await this._openQuickAssist();
    };

    const quickAssistHint = document.createElement("div");
    quickAssistHint.style.fontSize = "12px";
    quickAssistHint.style.opacity = "0.8";

    const btnInfo = document.createElement("button");
    btnInfo.type = "button";
    btnInfo.textContent = "Info";
    applyPopupButtonStyle(btnInfo);
    btnInfo.onclick = () => this._openInfoPopup();

    helpActions.append(btnQuickAssist, quickAssistHint, btnInfo);

    const body = document.createElement("div");
    body.style.padding = "12px";
    body.style.overflow = "auto";
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.lineHeight = "1.45";
    body.style.fontFamily = "Calibri, Arial, sans-serif";

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.padding = "10px 12px";
    footer.style.borderTop = "1px solid #e2e8f0";

    const btnFooterClose = document.createElement("button");
    btnFooterClose.type = "button";
    btnFooterClose.textContent = "Schließen";
    applyPopupButtonStyle(btnFooterClose, { variant: "neutral" });
    btnFooterClose.onclick = () => this.close();
    footer.appendChild(btnFooterClose);

    modal.append(head, tabBar, helpActions, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.root = overlay;
    this.modal = modal;
    this.body = body;
    this.btnQuickStart = btnQuickStart;
    this.btnGlossary = btnGlossary;
    this.btnQuickAssist = btnQuickAssist;
    this.btnInfo = btnInfo;
    this.quickAssistHint = quickAssistHint;
  }

  _openInfoPopup() {
    if (this.infoOverlay) {
      this.infoOverlay.style.display = "flex";
      return;
    }

    const overlay = createPopupOverlay();
    registerPopupCloseHandlers(overlay, () => this._closeInfoPopup());
    overlay.style.zIndex = String(OVERLAY_TOP + 1);

    const card = document.createElement("div");
    stylePopupCard(card, { width: "min(560px, calc(100vw - 24px))" });

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.padding = "12px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Info";
    title.style.fontWeight = "800";
    title.style.fontSize = "16px";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.style.marginLeft = "auto";
    btnClose.onclick = () => this._closeInfoPopup();

    head.append(title, btnClose);

    const body = document.createElement("div");
    body.style.padding = "12px";
    body.style.display = "grid";
    body.style.gap = "6px";
    body.style.lineHeight = "1.45";

    const p1 = document.createElement("div");
    p1.textContent = "Entwickelt von Steffen Bandholt";

    const mail = document.createElement("a");
    mail.href = "mailto:info@bandholt.de";
    mail.textContent = "mailto: info@bandholt.de";

    body.append(p1, mail);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.padding = "10px 12px";
    footer.style.borderTop = "1px solid #e2e8f0";

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.textContent = "Schliessen";
    applyPopupButtonStyle(btnOk, { variant: "neutral" });
    btnOk.onclick = () => this._closeInfoPopup();

    footer.appendChild(btnOk);
    card.append(head, body, footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.infoOverlay = overlay;
  }

  _closeInfoPopup() {
    if (this.infoOverlay) this.infoOverlay.style.display = "none";
  }

  async _syncQuickAssistUi() {
    const api = window.bbmDb || {};
    let isWin = false;

    if (typeof api.appIsWindows === "function") {
      const res = await api.appIsWindows();
      isWin = !!res?.ok && !!res?.isWindows;
    } else {
      const p = String(navigator?.platform || "").toLowerCase();
      isWin = p.includes("win");
    }

    this._isWindows = isWin;

    if (!this.btnQuickAssist || !this.quickAssistHint) return;

    if (isWin) {
      this.btnQuickAssist.disabled = false;
      this.btnQuickAssist.style.opacity = "1";
      this.btnQuickAssist.style.display = "inline-flex";
      this.quickAssistHint.textContent = "";
      return;
    }

    this.btnQuickAssist.disabled = true;
    this.btnQuickAssist.style.opacity = "0.55";
    this.btnQuickAssist.style.display = "inline-flex";
    this.quickAssistHint.textContent = "Nur unter Windows verfügbar.";
  }

  async _openQuickAssist() {
    const api = window.bbmDb || {};
    if (!this._isWindows) {
      alert("Schnellhilfe ist nur unter Windows verfügbar.");
      return;
    }
    if (typeof api.openQuickAssist !== "function") {
      alert("Schnellhilfe ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    const res = await api.openQuickAssist();
    if (!res?.ok) {
      alert(res?.error || "Schnellhilfe konnte nicht gestartet werden.");
    }
  }

  _setTab(tab) {
    if (tab !== "quickStart" && tab !== "glossary") return;
    this.activeTab = tab;
    this._renderContent();
    this._applyTabState();
  }

  _applyTabState() {
    const activeQuickStart = this.activeTab === "quickStart";
    const activeGlossary = this.activeTab === "glossary";

    if (this.btnQuickStart) {
      this.btnQuickStart.style.fontWeight = activeQuickStart ? "700" : "600";
      this.btnQuickStart.style.borderColor = activeQuickStart ? "rgba(25,118,210,0.65)" : "rgba(0,0,0,0.18)";
      this.btnQuickStart.style.background = activeQuickStart ? "#e8f1ff" : "#f9fbff";
    }
    if (this.btnGlossary) {
      this.btnGlossary.style.fontWeight = activeGlossary ? "700" : "600";
      this.btnGlossary.style.borderColor = activeGlossary ? "rgba(25,118,210,0.65)" : "rgba(0,0,0,0.18)";
      this.btnGlossary.style.background = activeGlossary ? "#e8f1ff" : "#f9fbff";
    }
  }

  _renderContent() {
    if (!this.body) return;
    this.body.innerHTML = "";

    if (this.activeTab === "quickStart") {
      this._renderQuickStartMarkdown(String(quickStart || ""));
      return;
    }

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gridTemplateColumns = "1fr";
    list.style.gap = "10px";

    for (const entry of glossary || []) {
      const row = document.createElement("div");
      row.style.paddingBottom = "8px";
      row.style.borderBottom = "1px solid #e2e8f0";

      const term = document.createElement("div");
      term.style.fontWeight = "700";
      term.style.marginBottom = "3px";
      term.textContent = String(entry?.term || "");

      const def = document.createElement("div");
      def.textContent = String(entry?.definition || "");

      row.append(term, def);
      list.appendChild(row);
    }

    this.body.appendChild(list);
  }

  _renderQuickStartMarkdown(markdown) {
    if (!this.body) return;
    const lines = String(markdown || "").split(/\r?\n/);
    let ul = null;

    const closeList = () => {
      ul = null;
    };

    for (const raw of lines) {
      const line = String(raw || "");
      const trimmed = line.trim();

      if (!trimmed) {
        closeList();
        continue;
      }

      if (trimmed.startsWith("# ")) {
        closeList();
        const h1 = document.createElement("h2");
        h1.textContent = trimmed.slice(2).trim();
        h1.style.margin = "0 0 10px 0";
        h1.style.fontSize = "20px";
        this.body.appendChild(h1);
        continue;
      }

      if (trimmed.startsWith("## ")) {
        closeList();
        const h2 = document.createElement("h3");
        h2.textContent = trimmed.slice(3).trim();
        h2.style.margin = "12px 0 6px 0";
        h2.style.fontSize = "15px";
        this.body.appendChild(h2);
        continue;
      }

      if (trimmed.startsWith("- ")) {
        if (!ul) {
          ul = document.createElement("ul");
          ul.style.margin = "0 0 8px 0";
          ul.style.paddingLeft = "20px";
          this.body.appendChild(ul);
        }
        const li = document.createElement("li");
        li.textContent = trimmed.slice(2).trim();
        li.style.marginBottom = "4px";
        ul.appendChild(li);
        continue;
      }

      closeList();
      const p = document.createElement("p");
      p.textContent = trimmed;
      p.style.margin = "0 0 8px 0";
      this.body.appendChild(p);
    }
  }

  async open() {
    this._ensureDom();
    this._setTab("quickStart");
    await this._syncQuickAssistUi();
    if (this.root) {
      this.root.style.display = "flex";
      try {
        this.root.focus();
      } catch (_e) {
        // ignore
      }
    }
  }

  close() {
    if (this.root) this.root.style.display = "none";
    this._closeInfoPopup();
  }
}
