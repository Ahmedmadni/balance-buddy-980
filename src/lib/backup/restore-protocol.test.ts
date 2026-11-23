import { describe, expect, test } from "bun:test";
import { classifyServerRestoreStatus, selectRestoreApiMode } from "./restore-protocol";
const id = "e8888888-8888-4888-8888-888888888888";
describe("staged server restore capabilities", () => {
  test("uses new server only with explicit matching not_found probe", () => {
    expect(selectRestoreApiMode({ data: { status: "not_found", operation_id: id }, error: null }, id)).toBe("once");
    expect(selectRestoreApiMode({ data: { status: "not_found", operation_id: "other" }, error: null }, id)).toBe("unavailable");
  });
  test("legacy path is permitted only on specific missing-RPC error", () => {
    expect(selectRestoreApiMode({ error: { code: "PGRST202" }, status: 404 }, id)).toBe("legacy");
    expect(selectRestoreApiMode({ error: { code: "PGRST301" }, status: 401 }, id)).toBe("unavailable");
    expect(selectRestoreApiMode({ error: { code: "57014" }, status: 504 }, id)).toBe("unavailable");
    expect(selectRestoreApiMode({ data: null, status: 200 }, id)).toBe("unavailable");
  });
  test("only trusted committed status resolves an unconfirmed operation", () => {
    expect(classifyServerRestoreStatus({ data: { status: "committed", format: "rasd-backup", version: 2, operation_id: id } }, id)).toBe("committed");
    expect(classifyServerRestoreStatus({ data: { status: "committed", operation_id: id } }, id)).toBe("unavailable");
    expect(classifyServerRestoreStatus({ data: { status: "not_found", operation_id: id } }, id)).toBe("not_found");
    expect(classifyServerRestoreStatus({ data: { status: "not_found", operation_id: "other" } }, id)).toBe("unavailable");
  });
});
