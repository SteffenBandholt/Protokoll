export class IdleCreateMeetingService {
  constructor({ getDbApi, formatDateForTitle } = {}) {
    this.getDbApi = typeof getDbApi === "function" ? getDbApi : () => window.bbmDb || {};
    this.formatDateForTitle =
      typeof formatDateForTitle === "function" ? formatDateForTitle : (value) => String(value || "").trim();
  }

  async createMeetingForProject({ projectId, dateISO, keyword }) {
    if (!projectId) {
      return { ok: false, error: "Kein Projekt ausgewählt." };
    }

    const api = this.getDbApi();
    if (typeof api.meetingsCreate !== "function") {
      return { ok: false, error: "meetingsCreate ist nicht verfügbar (Preload/IPC fehlt)." };
    }

    const nextIndex = await this.getNextMeetingIndex(projectId);
    const title = this.buildMeetingTitle({ nextIndex, dateISO, keyword });
    const createRes = await api.meetingsCreate({ projectId, title });

    return {
      ok: !!createRes?.ok,
      error: createRes?.error || "",
      title,
      nextIndex,
      createRes,
      meetingId: createRes?.meeting?.id || null,
    };
  }

  async getNextMeetingIndex(projectId) {
    const api = this.getDbApi();
    if (!projectId || typeof api.meetingsListByProject !== "function") {
      return 1;
    }

    try {
      const res = await api.meetingsListByProject(projectId);
      if (!res?.ok) return 1;
      const list = Array.isArray(res.list) ? res.list : [];
      const maxIdx = list.reduce((mx, item) => Math.max(mx, Number(item?.meeting_index || 0)), 0);
      return (maxIdx || 0) + 1;
    } catch (_err) {
      return 1;
    }
  }

  buildMeetingTitle({ nextIndex, dateISO, keyword }) {
    const dd = this.formatDateForTitle(dateISO);
    const idx = `#${Number(nextIndex) > 0 ? Number(nextIndex) : 1}`;
    const suffix = String(keyword || "").trim();
    return suffix ? `${idx} ${dd} - ${suffix}` : `${idx} ${dd}`;
  }
}
