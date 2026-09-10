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
  expect(await Bun.file(new URL("advisor-data.js", root)).exists()).toBe(true);
  expect(await Bun.file(new URL("advisor-engine.js", root)).exists()).toBe(true);
  const serviceWorker = await Bun.file(new URL("sw.js", root)).text();
  expect(serviceWorker).toContain("./manual-data.js?v=13");
  expect(serviceWorker).toContain("./advisor-data.js?v=13");
  expect(serviceWorker).toContain("./advisor-engine.js?v=13");
  expect(serviceWorker).not.toContain("youtube.com");
  const html = await Bun.file(new URL("index.html", root)).text();
  expect(html).toContain("frame-src https://www.youtube-nocookie.com");
  expect(html).not.toContain("<iframe");
});


test("module navigation is task-first and mobile ready", async () => {
  const root = new URL("../", import.meta.url);
  const html = await Bun.file(new URL("index.html", root)).text();
  const app = await Bun.file(new URL("app.js", root)).text();
  const css = await Bun.file(new URL("styles.css", root)).text();
  const order = ["home","advisor","how-to","setups","nj-playbook","rigs","areas","regulations","library","quiver","seasons","notes","sources"];
  expect((html.match(/data-module=/g) || []).length).toBe(13);
  expect((html.match(/data-module="[^"]+" hidden/g) || []).length).toBe(12);
  expect(html).toContain("id=\"module-sidebar\"");
  expect(html).toContain("id=\"module-menu-button\"");
  expect(app).toContain(`const modules = [`);
  let position = -1;
  for (const id of order) { const next = app.indexOf(`id:"${id}"`); expect(next).toBeGreaterThan(position); position = next; }
  expect(app).toContain("window.addEventListener(\"hashchange\"");
  expect(app).toContain("localStorage.setItem(\"tacklebox-module\", JSON.stringify(id))");
  expect(css).toContain(".module-menu-open .module-sidebar");
  expect(css).toContain("[data-module][hidden]");
});

test("conditions advisor is wired into the mobile app", async () => {
  const root = new URL("../", import.meta.url);
  const html = await Bun.file(new URL("index.html", root)).text();
  const app = await Bun.file(new URL("app.js", root)).text();
  const css = await Bun.file(new URL("styles.css", root)).text();
  for (const id of ["advisor-water","advisor-target","advisor-trend","advisor-clarity","advisor-wind","advisor-structure","advisor-forage","advisor-current","advisor-light","advisor-trouble","advisor-result"]) expect(html).toContain(`id="${id}"`);
  expect(app).toContain("advisorEngine.recommend");
  expect(app).toContain("localStorage.setItem(\"tacklebox-advisor\"");
  expect(app).toContain("button.dataset.procedure");
  expect(app).toContain("button.dataset.open");
  expect(app).toContain(`$("#advisor-current-field").hidden = water !== "salt"`);
  expect(css).toContain(".advisor-layout");
  expect(css).toContain(".advisor-adjust");
});

test("recommended setups use compact accessible disclosure", async () => {
  const root = new URL("../", import.meta.url);
  const app = await Bun.file(new URL("app.js", root)).text();
  const css = await Bun.file(new URL("styles.css", root)).text();
  expect(app).toContain(`<details class="setup-system-card">`);
  expect(app).not.toContain(`class="setup-system-card" open`);
  expect(app).toContain(`class="setup-system-summary"`);
  expect(app).toContain(`class="setup-system-preview"`);
  expect(app).toContain(`<dl>`);
  expect(app).toContain(`class="setup-system-tier"`);
  expect(css).toContain(".setup-system-card > .setup-system-body { display: grid !important; }");
});

test("production UI is permanently dark themed", async () => {
  const root = new URL("../", import.meta.url);
  const css = await Bun.file(new URL("styles.css", root)).text();
  const html = await Bun.file(new URL("index.html", root)).text();
  const app = await Bun.file(new URL("app.js", root)).text();
  const manifest = await Bun.file(new URL("manifest.webmanifest", root)).json();
  expect(css).toContain("color-scheme: dark");
  expect(css).not.toContain("body.sunlight");
  expect(html).not.toContain("sunlight-toggle");
  expect(app).not.toContain("sunlight-toggle");
  expect(manifest.background_color).toBe("#07131f");
  expect(manifest.theme_color).toBe("#07131f");
  expect(css).toContain("@media print { .setup-system-card > .setup-system-body");
  expect(css).toContain("[data-module][hidden] { display: block !important; }");
  expect(css).toContain(".field-manual, .recommended-setups, .rig-bench");
  expect(css).toContain(".technique-card, .manual-card, .setup-system-card, .setup-system-tier");
});
