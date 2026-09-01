// =============================================================
// Regression test for the "عرض الكشف" (view statement) bug.
// -------------------------------------------------------------
// Root cause: TanStack Router's flat file-routing nests a file whose name
// extends another route's name as that route's CHILD. `app.wallets.$id.tsx`
// nested under `app.wallets.tsx`, which requires app.wallets.tsx to render
// an <Outlet/> for the child to ever appear — it doesn't (it's a plain list
// page), so navigating to /app/wallets/$id changed the URL but rendered
// nothing new. The fix renames the file with a trailing underscore
// (`app.wallets_.$id.tsx`), which TanStack Router's generator recognizes as
// an escape hatch: the route still resolves to the same clean URL
// (/app/wallets/$id) but attaches directly under the app layout instead of
// under the wallets list route. See routeTree.gen.ts and
// node_modules/@tanstack/router-generator's removeUnderscoresWithEscape /
// hasParentRoute for the underlying mechanism.
// =============================================================
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const routesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "routes",
  "_authenticated",
);
const routeTreePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "routeTree.gen.ts");

describe("wallet statement route wiring", () => {
  test("the $id detail route file uses the non-nesting filename", () => {
    // A file literally named app.wallets.$id.tsx would silently re-introduce
    // the bug (nested under app.wallets.tsx, which has no <Outlet/>).
    expect(existsSync(join(routesDir, "app.wallets.$id.tsx"))).toBe(false);
    expect(existsSync(join(routesDir, "app.wallets_.$id.tsx"))).toBe(true);
  });

  test("the wallet detail route's createFileRoute id matches the non-nesting path", () => {
    const src = readFileSync(join(routesDir, "app.wallets_.$id.tsx"), "utf8");
    expect(src).toContain('createFileRoute("/_authenticated/app/wallets_/$id")');
  });

  test("the generated route tree attaches the $id route to the app layout, not the wallets list route", () => {
    const tree = readFileSync(routeTreePath, "utf8");
    const match = tree.match(
      /const AuthenticatedAppWalletsIdRoute =\s*\n\s*AuthenticatedAppWalletsIdRouteImport\.update\(\{([\s\S]*?)\}\s*as any\)/,
    );
    expect(match).not.toBeNull();
    const block = match![1];
    expect(block).toContain("getParentRoute: () => AuthenticatedAppRoute");
    expect(block).not.toContain("getParentRoute: () => AuthenticatedAppWalletsRoute");
    // The clean URL consumers see (Link to="/app/wallets/$id") must be unchanged.
    expect(block).toContain("path: '/wallets/$id'");
  });

  test("the wallets list route no longer carries the $id route as a nested child", () => {
    const tree = readFileSync(routeTreePath, "utf8");
    expect(tree).not.toContain("AuthenticatedAppWalletsRouteWithChildren");
  });
});
