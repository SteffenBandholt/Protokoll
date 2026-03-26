export class ProjectTasksService {
  async loadTasks(payload) {
    return window.bbmDb.meetingsListProjectTasks(payload);
  }
}
