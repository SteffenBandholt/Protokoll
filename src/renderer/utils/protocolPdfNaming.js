export function buildProtocolFileName({
  projectNumber,
  projectShort,
  protocolTitle,
  meetingIndex,
  date
}){

  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();

  return `${projectNumber}_${projectShort}_${protocolTitle}_#${meetingIndex} - ${dd}.${mm}.${yyyy}.pdf`;
}