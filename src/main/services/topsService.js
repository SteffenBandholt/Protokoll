class TopsService {
  constructor({ topsRepo }) {
    this.topsRepo = topsRepo;
  }

  listByMeeting(meetingId) {
    return {
      ok: true,
      list: this.topsRepo.listByMeeting(meetingId)
    };
  }

  create({ projectId, meetingId, level, parentTopId, title }) {
    return {
      ok: true,
      top: this.topsRepo.createTop({
        projectId,
        meetingId,
        parentTopId,
        level,
        title
      })
    };
  }
}

module.exports = TopsService;
