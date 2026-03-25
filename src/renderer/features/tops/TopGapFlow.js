export class TopGapFlow {
  constructor({ view }) {
    this.view = view;
  }

  async autoFixAfterDelete() {
    if (this.view.isReadOnly) return;
    if (typeof window.bbmDb?.meetingTopsFixNumberGap !== "function") return;

    const maxSteps = 20;
    for (let i = 0; i < maxSteps; i += 1) {
      const gap = this.view._firstNumberGapFromItems();
      if (!gap?.lastTopId) break;

      const fixRes = await window.bbmDb.meetingTopsFixNumberGap({
        meetingId: this.view.meetingId,
        level: gap.level,
        parentTopId: gap.parentTopId ?? null,
        fromTopId: gap.lastTopId,
        toNumber: gap.missingNumber,
      });
      if (!fixRes?.ok) {
        console.warn("[tops] auto fixNumberGap failed:", fixRes?.error || fixRes?.errorCode);
        break;
      }

      await this.view.reloadList(false);
    }
  }
}
