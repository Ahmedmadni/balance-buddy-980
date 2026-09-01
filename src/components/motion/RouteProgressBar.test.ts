import { describe, expect, test } from "bun:test";
import { shouldShowRouteProgress } from "./route-progress";

describe("route transition pending UI", () => {
  test("navigation triggers pending UI while the router resolves a route", () => {
    expect(shouldShowRouteProgress("pending", 0)).toBe(true);
  });

  test("shows while the new route's queries are still in flight", () => {
    expect(shouldShowRouteProgress("idle", 2)).toBe(true);
  });

  test("pending state clears once routing is idle and nothing is fetching", () => {
    expect(shouldShowRouteProgress("idle", 0)).toBe(false);
  });
});
