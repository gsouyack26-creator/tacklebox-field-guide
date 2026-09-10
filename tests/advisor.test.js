import { beforeAll, describe, expect, test } from "bun:test";

beforeAll(async () => {
  globalThis.window = {};
  await import("../data.js?advisor-techniques");
  await import("../manual-data.js?advisor-manual");
  await import("../advisor-data.js?advisor-rules");
  await import("../advisor-engine.js?advisor-engine");
});

const pick = overrides => ({water:"fresh",target:"general",trend:"stable",clarity:"stained",wind:"moderate",structure:"open",forage:"unknown",current:"moderate",light:"day",trouble:"none",...overrides});

describe("conditions advisor", () => {
  test("references only existing techniques and procedures", () => {
    const techniques = new Set(window.TACKLEBOX_DATA.techniques.map(item => item.id));
    const procedures = new Set(window.TACKLEBOX_DATA.manual.procedures.map(item => item.id));
    for (const profile of window.TACKLEBOX_ADVISOR.profiles) expect(techniques.has(profile.technique)).toBe(true);
    for (const id of Object.values(window.TACKLEBOX_ADVISOR.procedureByTarget)) expect(procedures.has(id)).toBe(true);
  });

  test("covers every existing core technique", () => {
    const techniques = new Set(window.TACKLEBOX_DATA.techniques.map(item => item.id));
    const profiles = new Set(window.TACKLEBOX_ADVISOR.profiles.map(item => item.technique));
    expect(profiles).toEqual(techniques);
  });

  test("selects finesse for clear calm cooling freshwater", () => {
    const result = window.TACKLEBOX_ADVISOR_ENGINE.recommend(window.TACKLEBOX_ADVISOR, pick({target:"bass",trend:"cooling",clarity:"clear",wind:"calm",structure:"open"}));
    expect(result.profile.technique).toBe("finesse");
    expect(result.matched).toContain("structure");
  });

  test("selects power tackle for stained windy vegetation", () => {
    const result = window.TACKLEBOX_ADVISOR_ENGINE.recommend(window.TACKLEBOX_ADVISOR, pick({target:"bass",trend:"warming",clarity:"stained",wind:"strong",structure:"vegetation",forage:"large-bait"}));
    expect(result.profile.technique).toBe("power-bass");
  });

  test("selects surf tackle for rough open beach", () => {
    const result = window.TACKLEBOX_ADVISOR_ENGINE.recommend(window.TACKLEBOX_ADVISOR, pick({water:"salt",target:"striper-bluefish",trend:"cooling",clarity:"stained",wind:"strong",structure:"open-beach",forage:"sand-eel",current:"moderate",light:"low"}));
    expect(result.profile.technique).toBe("salt-surf");
  });

  test("selects structure tackle for sheepshead in current", () => {
    const result = window.TACKLEBOX_ADVISOR_ENGINE.recommend(window.TACKLEBOX_ADVISOR, pick({water:"salt",target:"sheeps",structure:"bridge-jetty",forage:"crab-shrimp",current:"strong",clarity:"stained"}));
    expect(result.profile.technique).toBe("inshore-structure");
  });

  test("provides eight controlled troubleshooting paths", () => {
    expect(Object.keys(window.TACKLEBOX_ADVISOR.trouble)).toHaveLength(8);
    for (const item of Object.values(window.TACKLEBOX_ADVISOR.trouble)) {
      expect(item.action.length).toBeGreaterThan(30);
      expect(item.check.length).toBeGreaterThan(20);
    }
  });
});