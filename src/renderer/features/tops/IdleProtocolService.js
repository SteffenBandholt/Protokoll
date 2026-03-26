export class IdleProtocolService {
  constructor({ getDbApi } = {}) {
    this.getDbApi = typeof getDbApi === "function" ? getDbApi : () => window.bbmDb || {};
  }

  async hasProtocols(projectId) {
    if (!projectId) return false;

    const api = this.getDbApi();
    if (typeof api.meetingsListByProject !== "function") {
      return false;
    }

    try {
      const res = await api.meetingsListByProject(projectId);
      if (!res?.ok) return false;
      const list = Array.isArray(res.list) ? res.list : [];
      return list.length > 0;
    } catch (_err) {
      return false;
    }
  }

  async findOpenMeetingId(projectId) {
    if (!projectId) return null;

    const api = this.getDbApi();
    if (typeof api.meetingsListByProject !== "function") {
      return null;
    }

    try {
      const res = await api.meetingsListByProject(projectId);
      if (!res?.ok) return null;
      const list = Array.isArray(res.list) ? res.list : [];
      const openMeeting = list.find((meeting) => Number(meeting?.is_closed) === 0);
      return openMeeting?.id || null;
    } catch (_err) {
      return null;
    }
  }
}
