import { beforeAll, describe, expect, test } from "bun:test";

beforeAll(async () => {
  globalThis.window = {};
  await import("../data.js?manual-core");
  await import("../manual-data.js?manual-tests");
});

describe("Northeast field manual", () => {
  test("is heavy on striped bass and covers four target species", () => {
    const procedures = window.TACKLEBOX_DATA.manual.procedures;
    const counts = Object.fromEntries(["striper","fluke","bluefish","sheeps"].map(id => [id, procedures.filter(item => item.species === id).length]));
    expect(counts.striper).toBeGreaterThanOrEqual(12);
    expect(counts.fluke).toBeGreaterThanOrEqual(1);
    expect(counts.bluefish).toBeGreaterThanOrEqual(1);
    expect(counts.sheeps).toBeGreaterThanOrEqual(1);
    expect(counts.striper).toBeGreaterThan(counts.fluke + counts.bluefish + counts.sheeps);
  });

  test("every procedure teaches cast retrieve hookset rig and knot", () => {
    const manual = window.TACKLEBOX_DATA.manual;
    for (const item of manual.procedures) {
      expect(item.cast.length).toBeGreaterThanOrEqual(2);
      expect(item.retrieve.length).toBeGreaterThanOrEqual(2);
      expect(item.hookset.length).toBeGreaterThan(15);
      expect(item.mistakes.length).toBeGreaterThan(15);
      expect(manual.rigs[item.rig]).toBeDefined();
      expect(manual.knots[item.knot]).toBeDefined();
    }
  });

  test("knots and rigs have complete field instructions", () => {
    const manual = window.TACKLEBOX_DATA.manual;
    expect(Object.keys(manual.knots).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(manual.rigs).length).toBeGreaterThanOrEqual(7);
    for (const knot of Object.values(manual.knots)) {
      expect(knot.steps.length).toBeGreaterThanOrEqual(4);
      expect(knot.avoid.length).toBeGreaterThan(10);
    }
    for (const rig of Object.values(manual.rigs)) expect(rig.parts.length).toBeGreaterThanOrEqual(4);
  });


  test("knot videos are verified IDs and remain optional supplements", () => {
    const knots = window.TACKLEBOX_DATA.manual.knots;
    expect(Object.keys(knots)).toHaveLength(5);
    for (const knot of Object.values(knots)) {
      expect(knot.video).toBeDefined();
      expect(knot.video.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(knot.video.title.length).toBeGreaterThan(10);
      expect(knot.video.channel.length).toBeGreaterThan(3);
      expect(knot.steps.length).toBeGreaterThanOrEqual(4);
    }
  });

  test("uses the five reviewed YouTube tutorials", () => {
    const knots = window.TACKLEBOX_DATA.manual.knots;
    expect(knots.palomar.video).toEqual({id:"TFk_Ktw2f1w", title:"Palomar Knot - Quick Tutorial on How to Tie This Strong Knot", channel:"Salt Strong"});
    expect(knots["improved-clinch"].video.id).toBe("fXWRZe784QU");
    expect(knots.loop.video.id).toBe("C0u5HQBiv_I");
    expect(knots["double-uni"].video.id).toBe("6VgQLBpwJUY");
    expect(knots["dropper-loop"].video.id).toBe("zDYQ-oIDbUo");
  });

  test("every procedure has budget mid-tier and high-tier setups", () => {
    const manual = window.TACKLEBOX_DATA.manual;
    const allowedTiers = ["budget", "mid", "high"];
    for (const procedure of manual.procedures) {
      const profileId = manual.setupMap[procedure.id];
      expect(profileId).toBeDefined();
      const profile = manual.setupProfiles[profileId];
      expect(profile).toBeDefined();
      expect(profile.tiers.map(item => item.tier)).toEqual(allowedTiers);
      for (const tier of profile.tiers) {
        expect(tier.rod.length).toBeGreaterThan(15);
        expect(tier.reel.length).toBeGreaterThan(8);
        expect(tier.reelOptions).toHaveLength(3);
        expect(tier.reelOptions.some(item => item.includes("PENN"))).toBe(true);
        expect(tier.reelOptions.some(item => item.includes("Shimano"))).toBe(true);
        expect(tier.reelOptions.some(item => item.includes("Daiwa"))).toBe(true);
        expect(tier.url.startsWith("https://")).toBe(true);
        expect(tier.url).not.toMatch(/[?&](ref|utm_|aff|tag)=/i);
      }
    }
  });

  test("every setup profile includes verified alternate rods", () => {
    const profiles = window.TACKLEBOX_DATA.manual.setupProfiles;
    for (const profile of Object.values(profiles)) {
      expect(profile.rodOptions).toHaveLength(3);
      expect(new Set(profile.rodOptions.map(rod => rod.name)).size).toBe(3);
      for (const rod of profile.rodOptions) {
        expect(rod.name.length).toBeGreaterThan(30);
        expect(rod.name).toMatch(/\d/);
        expect(rod.url.startsWith("https://")).toBe(true);
        expect(rod.url).not.toMatch(/[?&](ref|utm_|aff|tag)=/i);
      }
    }
  });

  test("surf alternatives include Bigwater and Tiralejo in supported classes", () => {
    const profiles = window.TACKLEBOX_DATA.manual.setupProfiles;
    expect(profiles["surf-medium"].rodOptions.some(rod => rod.name.includes("Tiralejo TRS96MA"))).toBe(true);
    expect(profiles["surf-heavy"].rodOptions.some(rod => rod.name.includes("Tiralejo TRS110MHA"))).toBe(true);
    expect(profiles["surf-heavy"].rodOptions.some(rod => rod.name.includes("Bigwater BWSF1530S102"))).toBe(true);
  });

  test("recommended setup module can derive every matched technique", () => {
    const manual = window.TACKLEBOX_DATA.manual;
    const reverse = Object.fromEntries(Object.keys(manual.setupProfiles).map(id => [id, []]));
    for (const [procedureId, profileId] of Object.entries(manual.setupMap)) reverse[profileId].push(procedureId);
    expect(Object.keys(reverse)).toHaveLength(5);
    expect(Object.values(reverse).flat()).toHaveLength(manual.procedures.length);
    for (const ids of Object.values(reverse)) expect(ids.length).toBeGreaterThan(0);
    for (const procedure of manual.procedures) expect(reverse[manual.setupMap[procedure.id]]).toContain(procedure.id);
  });

  test("setup manufacturer registry is secure and non-affiliate", () => {
    const links = window.TACKLEBOX_DATA.manual.brandLinks;
    expect(Object.keys(links)).toEqual(["penn", "jigging-world", "shimano", "daiwa"]);
    for (const item of Object.values(links)) {
      expect(item.url.startsWith("https://")).toBe(true);
      expect(item.url).not.toMatch(/[?&](ref|utm_|aff|tag)=/i);
    }
  });

  test("hotspots are public area guidance without coordinates", () => {
    const hotspots = window.TACKLEBOX_DATA.manual.hotspots;
    expect(hotspots.length).toBeGreaterThanOrEqual(8);
    const species = new Set(hotspots.flatMap(item => item.species));
    for (const target of ["striper","fluke","bluefish","sheeps"]) expect(species.has(target)).toBe(true);
    for (const item of hotspots) {
      expect(item.source.startsWith("https://")).toBe(true);
      expect(item.access.length).toBeGreaterThan(30);
      expect(item.safety.length).toBeGreaterThan(25);
      expect(JSON.stringify(item)).not.toMatch(/-?\d{1,3}\.\d{4,}/);
    }
  });

  test("regulation cards cover all four priority targets", () => {
    const labels = window.TACKLEBOX_DATA.manual.regulations.map(item => item.species);
    expect(labels).toEqual(["Striped bass","Fluke","Bluefish","Sheepshead"]);
    for (const item of window.TACKLEBOX_DATA.manual.regulations) expect(item.source.startsWith("https://")).toBe(true);
  });
});