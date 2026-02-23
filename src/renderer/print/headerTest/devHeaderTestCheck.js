import { V2_LAYOUT } from "../v2/v2LayoutConfig.js";

function pxToMm(px) {
  return (px * 25.4) / 96;
}

function _rect(el) {
  return el?.getBoundingClientRect ? el.getBoundingClientRect() : null;
}

function _q(page, key) {
  return page.querySelector('[data-v2="' + key + '"], [data-ht="' + key + '"]');
}

export function runHeaderTestChecks({ debug, cfg = V2_LAYOUT } = {}) {
  if (!debug) return;

  const pages = Array.from(document.querySelectorAll(".headerTestPage"));
  if (!pages.length) return;

  const tol = Number(cfg?.devCheck?.toleranceMm || 1);

  // Page 1: line1 -> line2 distance
  const page1 = pages.find((p) => String(p.getAttribute("data-ht-page")) === "1") || pages[0];
  if (page1) {
    const line1 = _q(page1, "line1");
    const line2 = _q(page1, "line2");
    if (!line1 || !line2) {
      console.error("[HEADERTEST_CHECK] page1 missing line1/line2", { line1: !!line1, line2: !!line2 });
    } else {
      const r1 = _rect(line1);
      const r2 = _rect(line2);
      if (r1 && r2) {
        const distMm = pxToMm(r2.top - r1.top);
        const target = Number(cfg?.full?.heightMm || 40);
        const delta = Math.abs(distMm - target);
        console.warn("[HEADERTEST_CHECK] page1 line1->line2 mm=", distMm.toFixed(2), "target", target);
        if (delta > tol) {
          console.error("[HEADERTEST_CHECK] page1 line distance out of tolerance", {
            distMm,
            target,
            toleranceMm: tol,
          });
        }
      }
    }
  }

  // Page 2+: mini gaps
  for (const page of pages) {
    const pageNo = Number(page.getAttribute("data-ht-page") || 0);
    if (pageNo < 2) continue;

    const miniText = _q(page, "miniText");
    const miniLine = _q(page, "miniLine");
    const listStart = page.querySelector('[data-ht="listStart"], [data-v2="listStart"]');

    if (!miniLine) {
      console.error("[HEADERTEST_CHECK] page", pageNo, "missing mini line");
      continue;
    }

    if (miniText && miniLine && listStart) {
      const rText = _rect(miniText);
      const rLine = _rect(miniLine);
      const rList = _rect(listStart);
      if (rText && rLine && rList) {
        const gapTextToLineMm = pxToMm(rLine.top - rText.bottom);
        const gapLineToListMm = pxToMm(rList.top - rLine.top);
        const targetTextLine = Number(cfg?.mini?.gapTextToLineMm || 3);
        const targetLineBody = Number(cfg?.mini?.gapLineToBodyMm || 3);

        console.warn(
          "[HEADERTEST_CHECK] page",
          pageNo,
          "mini gaps mm=",
          gapTextToLineMm.toFixed(2),
          "/",
          gapLineToListMm.toFixed(2),
          "targets",
          targetTextLine,
          "/",
          targetLineBody
        );

        if (Math.abs(gapTextToLineMm - targetTextLine) > tol) {
          console.error("[HEADERTEST_CHECK] mini gap text->line out of tolerance", {
            pageNo,
            gapTextToLineMm,
            targetTextLine,
            toleranceMm: tol,
          });
        }
        if (Math.abs(gapLineToListMm - targetLineBody) > tol) {
          console.error("[HEADERTEST_CHECK] mini gap line->body out of tolerance", {
            pageNo,
            gapLineToListMm,
            targetLineBody,
            toleranceMm: tol,
          });
        }
      }
    }
  }
}
