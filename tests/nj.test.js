import { beforeAll, describe, expect, test } from "bun:test";

beforeAll(async () => {
  globalThis.window = {};
  await import("../data.js?nj-playbook-tests");
});

describe("NJ shore playbook", () => {
  test("keeps the core technique contract untouched", () => {
    expect(window.TACKLEBOX_DATA.techniques).toHaveLength(18);
  });

  test("contains complete isolated species modules", () => {
    const nj = window.TACKLEBOX_DATA.nj;
    expect(Object.keys(nj.species)).toEqual(["striper", "fluke", "sheeps"]);
    for (const [id, species] of Object.entries(nj.species)) {
      expect(species.fields).toHaveLength(3);
      expect(species.plays.length).toBeGreaterThanOrEqual(6);
      expect(new Set(species.plays.map(play => play.id)).size).toBe(species.plays.length);
      for (const play of species.plays) {
        expect(play.name.length).toBeGreaterThan(4);
        expect(play.lure.length).toBeGreaterThan(10);
        expect(play.rig.length).toBeGreaterThan(10);
        expect(play.retrieve.length).toBeGreaterThan(10);
        expect(play.why.length).toBeGreaterThan(10);
        expect(play.caution.length).toBeGreaterThan(10);
        for (const key of Object.keys(play.match)) expect(species.fields.some(field => field.id === key)).toBe(true);
      }
      expect(species.footer.length).toBeGreaterThan(40);
      expect(id.length).toBeGreaterThan(4);
    }
  });

  test("uses secure public regulatory sources", () => {
    for (const source of window.TACKLEBOX_DATA.nj.sources) {
      expect(source.url.startsWith("https://")).toBe(true);
    }
  });
});