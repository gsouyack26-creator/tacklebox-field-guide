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