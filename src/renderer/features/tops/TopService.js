export class TopService {
  async createTop(payload) {
    return window.bbmDb.topsCreate(payload);
  }

  async moveTop(payload) {
    return window.bbmDb.topsMove(payload);
  }

  async listByMeeting(meetingId) {
    return window.bbmDb.topsListByMeeting(meetingId);
  }

  async updateTop(payload) {
    return window.bbmDb.meetingTopsUpdate(payload);
  }
}
