// src/main/preload.js
const { contextBridge, ipcRenderer } = require("electron");

// kleine Helper: erlaubt beide Signaturen (id) oder ({...})
function _wrapIdArg(name, objKey) {
  return (arg) => {
    // arg kann z.B. projectId sein oder {projectId}
    if (arg && typeof arg === "object") return ipcRenderer.invoke(name, arg);
    const payload = {};
    payload[objKey] = arg;
    return ipcRenderer.invoke(name, payload);
  };
}

contextBridge.exposeInMainWorld("bbmDb", {
  // ============================================================
  // Projekte
  // ============================================================
  projectsList: () => ipcRenderer.invoke("projects:list"),
  projectsCreate: (data) => ipcRenderer.invoke("projects:create", data),
  projectsUpdate: (data) => ipcRenderer.invoke("projects:update", data),

  // Archiv
  projectsArchive: _wrapIdArg("projects:archive", "projectId"),
  projectsUnarchive: _wrapIdArg("projects:unarchive", "projectId"),
  projectsListArchived: () => ipcRenderer.invoke("projects:listArchived"),
  projectsDeleteForever: _wrapIdArg("projects:deleteForever", "projectId"),

  // ============================================================
  // Besprechungen
  // ============================================================
  meetingsListByProject: (projectId) =>
    ipcRenderer.invoke("meetings:listByProject", projectId),
  meetingsCreate: (data) => ipcRenderer.invoke("meetings:create", data),
  meetingsClose: (meetingId) => ipcRenderer.invoke("meetings:close", meetingId),

  // ============================================================
  // TOPs
  // ============================================================
  topsListByMeeting: (meetingId) => ipcRenderer.invoke("tops:listByMeeting", meetingId),
  topsCreate: (data) => ipcRenderer.invoke("tops:create", data),
  topsMove: (data) => ipcRenderer.invoke("tops:move", data),
  topsDelete: (data) => ipcRenderer.invoke("tops:delete", data),
  topsShiftLeft: (data) => ipcRenderer.invoke("tops:shiftLeft", data),
  topsShiftRight: (data) => ipcRenderer.invoke("tops:shiftRight", data),
  meetingTopsUpdate: (data) => ipcRenderer.invoke("meetingTops:update", data),
  meetingTopsFixNumberGap: (data) => ipcRenderer.invoke("meetingTops:fixNumberGap", data),

  // ============================================================
  // GLOBAL Firmen
  // ============================================================
  firmsListGlobal: () => ipcRenderer.invoke("firms:listGlobal"),
  firmsCreateGlobal: (data) => ipcRenderer.invoke("firms:createGlobal", data),
  firmsUpdateGlobal: (data) => ipcRenderer.invoke("firms:updateGlobal", data),
  firmsDeleteGlobal: (firmId) => ipcRenderer.invoke("firms:deleteGlobal", firmId),

  // ============================================================
  // GLOBAL Mitarbeiter (Persons) je Firma
  // ============================================================
  personsListByFirm: (firmId) => ipcRenderer.invoke("persons:listByFirm", firmId),
  personsCreate: (data) => ipcRenderer.invoke("persons:create", data),
  personsUpdate: (data) => ipcRenderer.invoke("persons:update", data),
  personsDelete: (personId) => ipcRenderer.invoke("persons:delete", personId),

  // ============================================================
  // PROJEKT Firmen (lokal) + PROJEKT Mitarbeiter (lokal)
  // ============================================================
  projectFirmsListByProject: (projectId) =>
    ipcRenderer.invoke("projectFirms:listByProject", projectId),
  projectFirmsCreate: (data) => ipcRenderer.invoke("projectFirms:create", data),
  projectFirmsUpdate: (data) => ipcRenderer.invoke("projectFirms:update", data),
  projectFirmsDelete: (projectFirmId) =>
    ipcRenderer.invoke("projectFirms:delete", projectFirmId),

  projectPersonsListByProjectFirm: (projectFirmId) =>
    ipcRenderer.invoke("projectPersons:listByProjectFirm", projectFirmId),
  projectPersonsCreate: (data) => ipcRenderer.invoke("projectPersons:create", data),
  projectPersonsUpdate: (data) => ipcRenderer.invoke("projectPersons:update", data),
  projectPersonsDelete: (projectPersonId) =>
    ipcRenderer.invoke("projectPersons:delete", projectPersonId),

  // ============================================================
  // Projekt ↔ Global-Firma Zuordnung (nur Zuordnung)
  // ============================================================
  projectFirmsListFirmCandidatesByProject: (projectId) =>
    ipcRenderer.invoke("projectFirms:listFirmCandidatesByProject", projectId),
  projectFirmsAssignGlobalFirm: (data) =>
    ipcRenderer.invoke("projectFirms:assignGlobalFirm", data),
  projectFirmsUnassignGlobalFirm: (data) =>
    ipcRenderer.invoke("projectFirms:unassignGlobalFirm", data),
  projectFirmsSetActive: (data) => ipcRenderer.invoke("projectFirms:setActive", data),

  // ============================================================
  // Kandidaten & Teilnehmer (INVARIANT)
  // - Pool (Projekt-Basisliste)
  // - Kandidaten (Projekt)
  // - Teilnehmer (Meeting)
  // ============================================================
  projectParticipantsPool: _wrapIdArg("projectParticipants:pool", "projectId"),
  projectCandidatesList: (data) => ipcRenderer.invoke("projectCandidates:list", data),
  projectCandidatesSet: (data) => ipcRenderer.invoke("projectCandidates:set", data),
  projectCandidatesSetActive: (data) => ipcRenderer.invoke("projectCandidates:setActive", data),

  meetingParticipantsList: (data) => ipcRenderer.invoke("meetingParticipants:list", data),
  meetingParticipantsSet: (data) => ipcRenderer.invoke("meetingParticipants:set", data),

  // ============================================================
  // Druck (HTML -> PDF)
  // ============================================================
  printHtmlToPdf: (data) => ipcRenderer.invoke("print:htmlToPdf", data),

  // ============================================================
  // App
  // ============================================================
  appQuit: () => ipcRenderer.invoke("app:quit"),
  appGetBundledIconPath: () => ipcRenderer.invoke("app:getBundledIconPath"),
  appIsWindows: () => ipcRenderer.invoke("app:isWindows"),
  openQuickAssist: () => ipcRenderer.invoke("app:openQuickAssist"),

  // ============================================================
  // Settings: Kategorien
  // ============================================================
  settingsCategoriesDelete: (data) => ipcRenderer.invoke("settings:categoriesDelete", data),

  // ============================================================
  // App-Settings (Key/Value)
  // ============================================================
  appSettingsGetMany: (keys) => ipcRenderer.invoke("appSettings:getMany", keys),
  appSettingsSetMany: (data) => ipcRenderer.invoke("appSettings:setMany", data),
  securitySettingsPinStatus: () => ipcRenderer.invoke("security:settingsPinStatus"),
  securitySettingsPinSet: (data) => ipcRenderer.invoke("security:settingsPinSet", data),
  securitySettingsPinDisable: (data) => ipcRenderer.invoke("security:settingsPinDisable", data),
  selectDirectory: (data) => ipcRenderer.invoke("dialog:selectDirectory", data),
  selectCsvFile: (data) => ipcRenderer.invoke("dialog:selectCsvFile", data),
  dbDiagnosticsGet: () => ipcRenderer.invoke("db:diagnostics"),
  dbLegacyImport: () => ipcRenderer.invoke("db:legacyImport"),
  dbOpenFolder: (data) => ipcRenderer.invoke("db:openFolder", data),
  firmsImportParseCsv: (data) => ipcRenderer.invoke("firms:importParseCsv", data),
  firmsImportApplyStaging: (data) => ipcRenderer.invoke("firms:importApplyStaging", data),
  personsImportParseCsv: (data) => ipcRenderer.invoke("persons:importParseCsv", data),
  personsImportApplyStaging: (data) => ipcRenderer.invoke("persons:importApplyStaging", data),

  // ============================================================
  // Nutzerdaten (DB)
  // ============================================================
  userProfileGet: () => ipcRenderer.invoke("userProfile:get"),
  userProfileUpsert: (data) => ipcRenderer.invoke("userProfile:upsert", data),
});
