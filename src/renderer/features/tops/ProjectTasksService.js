export class ProjectTasksService {
  constructor({ getDbApi, formatDate, formatStatus } = {}) {
    this.getDbApi = typeof getDbApi === "function" ? getDbApi : () => window.bbmDb || {};
    this.formatDate = typeof formatDate === "function" ? formatDate : (value) => String(value || "").trim();
    this.formatStatus = typeof formatStatus === "function" ? formatStatus : (value) => String(value || "").trim();
  }

  async loadForProject(projectId) {
    if (!projectId) {
      return { ok: false, error: "Projekt nicht gefunden." };
    }

    const api = this.getDbApi();
    if (typeof api.meetingsListProjectTasks !== "function") {
      return { ok: false, error: "Aufgabenliste ist nicht verfuegbar." };
    }

    const res = await api.meetingsListProjectTasks({ projectId });
    if (!res?.ok) {
      return { ok: false, error: res?.error || "Aufgaben konnten nicht geladen werden." };
    }

    return {
      ok: true,
      list: this.normalizeList(res.list || []),
    };
  }

  normalizeList(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list.map((task) => this.normalizeTask(task));
  }

  normalizeTask(task) {
    const statusRaw = String(task?.status || "").trim();
    const dueRaw = task?.due_date ?? task?.dueDate ?? "";
    const dueFallback = String(dueRaw || "").trim();

    return {
      title: String(task?.title || task?.short_text || task?.shortText || "(ohne Bezeichnung)"),
      responsible: String(task?.responsible_label || task?.responsibleLabel || "").trim() || "-",
      due: this.formatDate(dueRaw) || dueFallback || "-",
      status: this.formatStatus(statusRaw),
      meetingRef: String(task?.meeting_id ?? task?.meetingId ?? "").trim() || "-",
      isPending: !!statusRaw && statusRaw.toLowerCase() !== "erledigt",
    };
  }
}
