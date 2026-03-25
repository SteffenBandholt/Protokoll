export class TopPatchService {
  constructor({ view }) {
    this.view = view;
  }

  collectEditorPatch() {
    const values = this.view.topEditor.readValues();
    return this.view.topEditor.buildPatch(values);
  }

  async applyPatchAndRefresh(nextPatch, { reload, pulse }) {
    return this.view._applyPatchAndRefresh(nextPatch, { reload, pulse });
  }
}
