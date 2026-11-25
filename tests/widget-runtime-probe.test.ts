import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { seedWidgetRuntimeProbe } from "../mobile/packaged-guest/widget-runtime-probe";

const html = readFileSync(new URL("../mobile/native/widgets/widget-runtime-probe.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
async function probe(factory: IDBFactory, origin = "https://localhost") {
  if (!script) throw Error("missing synthetic probe script");
  const window = { location: { origin }, __byeolharuWidgetProbeResult: "pending" };
  runInNewContext(script, { window, indexedDB: factory });
  await vi.waitFor(() => expect(window.__byeolharuWidgetProbeResult).not.toBe("pending"));
  return window.__byeolharuWidgetProbeResult;
}
describe("cold widget synthetic storage capability probe", () => {
  it("reads only the marker seeded by the normal runtime", async () => {
    const factory = new IDBFactory();
    expect(await seedWidgetRuntimeProbe("https://localhost", factory)).toBe(true);
    expect(await probe(factory)).toBe("readable");
    expect(await probe(factory)).toBe("readable");
    expect((await factory.databases()).map(db => db.name)).toEqual(["byeolharu-widget-runtime-probe-v1"]);
  });
  it("does not create a persistent database if the marker is absent", async () => {
    const factory = new IDBFactory();
    expect(await probe(factory)).toBe("missing");
    await vi.waitFor(async () => expect(await factory.databases()).toEqual([]));
  });
  it("rejects an unexpected origin without seeding or reading", async () => {
    const factory = new IDBFactory();
    expect(await seedWidgetRuntimeProbe("https://example.com", factory)).toBe(false);
    expect(await probe(factory, "https://example.com")).toBe("origin");
    expect(await factory.databases()).toEqual([]);
  });
});
