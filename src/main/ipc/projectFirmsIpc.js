// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
// src/main/ipc/projectFirmsIpc.js

const { ipcMain } = require("electron");
const projectFirmsRepo = require("../db/projectFirmsRepo");
const projectPersonsRepo = require("../db/projectPersonsRepo");
const { appSettingsGetMany } = require("../db/appSettingsRepo");

function _err(e) {
  return e?.message || String(e);
}

const DEFAULT_FIRM_ROLE_ORDER = [10, 20, 30, 40, 50, 60];

function _getFirmRoleOrder() {
  try {
    const data = appSettingsGetMany(["firm_role_order"]);
    const raw = data?.firm_role_order || "";
    let parsed = [];
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) parsed = arr;
    } catch {
      parsed = [];
    }

    const out = [];
    const seen = new Set();
    for (const v of parsed) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (seen.has(n)) continue;
      out.push(n);
      seen.add(n);
    }
    for (const n of DEFAULT_FIRM_ROLE_ORDER) {
      if (seen.has(n)) continue;
      out.push(n);
      seen.add(n);
    }
    return out;
  } catch {
    return [...DEFAULT_FIRM_ROLE_ORDER];
  }
}

function _sortFirmsByRoleOrder(list, roleOrder) {
  const order = Array.isArray(roleOrder) ? roleOrder : DEFAULT_FIRM_ROLE_ORDER;
  const pos = new Map(order.map((c, i) => [c, i]));
  const len = order.length;

  const norm = (v) => (v == null ? "" : String(v)).toLowerCase();
  const roleCode = (item) => {
    const n = Number(item?.role_code);
    return Number.isFinite(n) ? n : 60;
  };

  const out = Array.isArray(list) ? [...list] : [];
  out.sort((a, b) => {
    const ai = pos.has(roleCode(a)) ? pos.get(roleCode(a)) : len;
    const bi = pos.has(roleCode(b)) ? pos.get(roleCode(b)) : len;
    if (ai !== bi) return ai - bi;

    const an = norm(a?.name);
    const bn = norm(b?.name);
    if (an < bn) return -1;
    if (an > bn) return 1;

    const as = norm(a?.short);
    const bs = norm(b?.short);
    if (as < bs) return -1;
    if (as > bs) return 1;

    return 0;
  });

  return out;
}

function registerProjectFirmsIpc() {
  // --------------------------------------------
  // HINWEIS:
  // 'firms:listGlobal' wird bereits global registriert (Stammdaten).
  // Hier NICHT nochmal registrieren, sonst crasht Electron beim Start.
  // --------------------------------------------

  // --------------------------------------------
  // Project Firms
  // --------------------------------------------
  ipcMain.handle("projectFirms:listByProject", (_evt, projectId) => {
    try {
      const list = projectFirmsRepo.listActiveByProject(projectId);
      const roleOrder = _getFirmRoleOrder();
      const sorted = _sortFirmsByRoleOrder(list, roleOrder);
      return { ok: true, list: sorted };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectFirms:create", (_evt, data) => {
    try {
      const firm = projectFirmsRepo.createProjectFirm(data || {});
      return { ok: true, firm };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectFirms:update", (_evt, data) => {
    try {
      const projectFirmId = data?.projectFirmId;
      const patch = data?.patch;
      const firm = projectFirmsRepo.updateProjectFirm({ projectFirmId, patch });
      return { ok: true, firm };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectFirms:delete", (_evt, projectFirmId) => {
    try {
      const res = projectFirmsRepo.softDeleteProjectFirm(projectFirmId);
      return { ok: true, result: res };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  // --------------------------------------------
  // Global-Firma ↔ Projekt-Zuordnung + Kandidaten
  // --------------------------------------------
  ipcMain.handle("projectFirms:listFirmCandidatesByProject", (_evt, projectId) => {
    try {
      const list = projectFirmsRepo.listFirmCandidatesByProject(projectId);
      return { ok: true, list };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectFirms:assignGlobalFirm", (_evt, data) => {
    try {
      const result = projectFirmsRepo.assignGlobalFirmToProject({
        projectId: data?.projectId,
        firmId: data?.firmId,
      });
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectFirms:unassignGlobalFirm", (_evt, data) => {
    try {
      const result = projectFirmsRepo.unassignGlobalFirmFromProject({
        projectId: data?.projectId,
        firmId: data?.firmId,
      });
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectFirms:setActive", (_evt, data) => {
    try {
      const result = projectFirmsRepo.setProjectFirmActive({
        projectId: data?.projectId,
        firmId: data?.firmId,
        isActive: data?.isActive,
      });
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  // --------------------------------------------
  // Project Persons
  // --------------------------------------------
  ipcMain.handle("projectPersons:listByProjectFirm", (_evt, projectFirmId) => {
    try {
      const list = projectPersonsRepo.listActiveByProjectFirm(projectFirmId);
      return { ok: true, list };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectPersons:create", (_evt, data) => {
    try {
      const person = projectPersonsRepo.createProjectPerson(data || {});
      return { ok: true, person };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectPersons:update", (_evt, data) => {
    try {
      const projectPersonId = data?.projectPersonId;
      const patch = data?.patch;
      const person = projectPersonsRepo.updateProjectPerson({ projectPersonId, patch });
      return { ok: true, person };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  ipcMain.handle("projectPersons:delete", (_evt, projectPersonId) => {
    try {
      const res = projectPersonsRepo.softDeleteProjectPerson(projectPersonId);
      return { ok: true, result: res };
    } catch (e) {
      return { ok: false, error: _err(e) };
    }
  });

  console.log("[main] projectFirms/projectPersons IPC registered");
}

module.exports = { registerProjectFirmsIpc };
