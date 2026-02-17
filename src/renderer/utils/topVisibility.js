// src/renderer/utils/topVisibility.js

function _meetingIdFrom(meeting) {
  return meeting?.id ?? meeting?.meetingId ?? null;
}

function _completedInMeetingIdFrom(top) {
  return top?.completed_in_meeting_id ?? top?.completedInMeetingId ?? null;
}

function _isDoneStatus(status) {
  const st = (status || "").toString().trim().toLowerCase();
  return st === "erledigt";
}

export function shouldShowTopForMeeting(top, meeting) {
  if (!top) return false;

  const meetingId = _meetingIdFrom(meeting);
  if (!meetingId) return true;

  if (!_isDoneStatus(top.status)) return true;

  const completedIn = _completedInMeetingIdFrom(top);
  if (!completedIn) {
    const isOld = Number(top.is_carried_over ?? top.isCarriedOver ?? 0) === 1;
    return !isOld;
  }

  return String(completedIn) === String(meetingId);
}

export function shouldGrayTopForMeeting(top, meeting) {
  if (!top) return false;
  if (!_isDoneStatus(top.status)) return false;
  return shouldShowTopForMeeting(top, meeting);
}
