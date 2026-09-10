import { beforeAll, describe, expect, test } from "bun:test";

beforeAll(async () => {
  globalThis.window = {};
  await import("../data.js");
});

describe("field-guide dataset", () => {
  test("covers fresh and salt water evenly", () => {
    const techniques = window.TACKLEBOX_DATA.techniques;
    expect(techniques).toHaveLength(18);
    expect(techniques.filter(item => item.water === "fresh")).toHaveLength(9);
    expect(techniques.filter(item => item.water === "salt")).toHaveLength(9);
  });

  test("each field card is complete and uniquely addressable", () => {
    const techniques = window.TACKLEBOX_DATA.techniques;
    expect(new Set(techniques.map(item => item.id)).size).toBe(techniques.length);
    for (const item of techniques) {
      expect(item.name.length).toBeGreaterThan(3);
      expect(item.access.length).toBeGreaterThan(0);
      expect(item.seasons.length).toBeGreaterThan(0);
      expect(item.species.length).toBeGreaterThan(0);
      expect(item.lures.length).toBeGreaterThanOrEqual(4);
      expect(Object.keys(item.rig)).toEqual(["Rod", "Reel", "Mainline", "Leader"]);
      expect(item.tip.length).toBeGreaterThan(10);
    }
  });

  test("supporting guide sections and sources are populated", () => {
    const data = window.TACKLEBOX_DATA;
    expect(data.quiver).toHaveLength(3);
    expect(data.seasons).toHaveLength(4);
    expect(data.notes.length).toBeGreaterThanOrEqual(6);
    expect(data.sources.length).toBeGreaterThanOrEqual(8);
    for (const source of data.sources) expect(source.url.startsWith("https://")).toBe(true);
  });
});

test("PWA assets are complete", async () => {
  const root = new URL("../", import.meta.url);
  const manifest = await Bun.file(new URL("manifest.webmanifest", root)).json();
  expect(manifest.start_url).toBe("./");
  expect(manifest.scope).toBe("./");
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) {
    expect(await Bun.file(new URL(icon.src, root)).exists()).toBe(true);
  }
  expect(await Bun.file(new URL("icons/apple-touch-icon.png", root)).exists()).toBe(true);
  expect(await Bun.file(new URL("manual-data.js", root)).exists()).toBe(true);
  const serviceWorker = await Bun.file(new URL("sw.js", root)).text();
  expect(serviceWorker).toContain("./manual-data.js?v=8");
  expect(serviceWorker).not.toContain("youtube.com");
  const html = await Bun.file(new URL("index.html", root)).text();
  expect(html).toContain("frame-src https://www.youtube-nocookie.com");
  expect(html).not.toContain("<iframe");
});
