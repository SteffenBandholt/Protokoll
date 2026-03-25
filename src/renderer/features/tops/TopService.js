export class TopService {
  async createTop(payload) {
    return window.bbmDb.topsCreate(payload);
  }
}
