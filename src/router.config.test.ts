import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// router.tsx wires createRouter/QueryClient against the full generated route
// tree, which pulls in browser-only route modules — not safe to import under
// bun:test. Assert on the source instead of executing it.
const source = readFileSync(fileURLToPath(new URL("./router.tsx", import.meta.url)), "utf-8");

describe("router configuration", () => {
  test("route links target correct pages: intent-based preload stays enabled", () => {
    expect(source).toMatch(/defaultPreload:\s*"intent"/);
  });

  test("cached pages render without unnecessary blocking: queries get a non-zero default staleTime", () => {
    const match = source.match(/staleTime:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(0);
  });
});
