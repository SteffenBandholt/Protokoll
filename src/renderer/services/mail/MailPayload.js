export class MailPayload {
  constructor() {
    this.to = [];
    this.cc = [];
    this.bcc = [];
    this.subject = "";
    this.body = "";
    this.attachments = [];

    this.projectId = null;
    this.meetingId = null;

    this.projectNumber = "";
    this.projectShortName = "";
    this.protocolTitle = "";
    this.meetingIndex = "";
    this.meetingDate = "";

    this.protocolFilePath = "";
    this.protocolFileName = "";
  }
}
