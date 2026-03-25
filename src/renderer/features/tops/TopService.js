export class TopService {
  async createTop(payload) {
    return window.bbmDb.topsCreate(payload);
  }

  async moveTop(payload) {
    return window.bbmDb.topsMove(payload);
  }
}
