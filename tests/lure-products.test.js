import { beforeAll, describe, expect, test } from "bun:test";

beforeAll(async () => {
  globalThis.window = {};
  await import("../data.js?product-techniques");
  await import("../manual-data.js?product-procedures");
  await import("../lure-products.js?product-registry");
});

describe("actual lure products", () => {
  test("registry is unique complete and non-affiliate", () => {
    const products = window.TACKLEBOX_LURE_PRODUCTS;
    expect(products.length).toBeGreaterThanOrEqual(14);
    expect(new Set(products.map(item => item.id)).size).toBe(products.length);
    for (const item of products) {
      expect(item.name.length).toBeGreaterThan(3);
      expect(item.maker.length).toBeGreaterThan(2);
      expect(item.spec.length).toBeGreaterThan(8);
      expect(item.use.length).toBeGreaterThan(15);
      expect(item.url.startsWith("https://")).toBe(true);
      expect(item.url).not.toMatch(/[?&](ref|utm_|aff|tag)=/i);
      expect(item.techniques.length + item.procedures.length).toBeGreaterThan(0);
    }
  });

  test("maps only to existing technique and procedure IDs", () => {
    const techniques = new Set(window.TACKLEBOX_DATA.techniques.map(item => item.id));
    const procedures = new Set(window.TACKLEBOX_DATA.manual.procedures.map(item => item.id));
    for (const item of window.TACKLEBOX_LURE_PRODUCTS) {
      for (const id of item.techniques) expect(techniques.has(id)).toBe(true);
      for (const id of item.procedures) expect(procedures.has(id)).toBe(true);
    }
  });

  test("covers fresh salt advisor and NJ procedure surfaces", () => {
    const products = window.TACKLEBOX_LURE_PRODUCTS;
    expect(products.some(item => item.techniques.includes("finesse"))).toBe(true);
    expect(products.some(item => item.techniques.includes("salt-surf"))).toBe(true);
    expect(products.some(item => item.techniques.includes("offshore-troll"))).toBe(true);
    expect(products.some(item => item.procedures.includes("striper-pencil"))).toBe(true);
    expect(products.some(item => item.procedures.includes("fluke-bucktail"))).toBe(true);
    expect(products.some(item => item.procedures.includes("bluefish-metal"))).toBe(true);
  });
});