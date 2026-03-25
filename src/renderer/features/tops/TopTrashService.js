export class TopTrashService {
  async markTrashed(topId) {
    return window.bbmDb.topsMarkTrashed({ topId });
  }
}
