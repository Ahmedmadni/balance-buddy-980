import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { auditConsentManager } from "./audit";

describe("Privacy disclosure stays aligned with real functionality", () => {
  test("does not claim blanket jurisdictional compliance from local consent", () => {
    const audit = auditConsentManager();
    for (const id of ["gdpr", "ccpa", "pdpl"]) {
      expect(audit.items.find(item => item.id === id)?.status).toBe("warning");
    }
  });
  test("explains encrypted cloud backups, limitations and essential cloud processing", () => {
    const copy = readFileSync("src/lib/compliance/privacy-policy.ts", "utf8");
    expect(copy).toContain("Supabase Storage");
    expect(copy).toContain("لا تشمل النسخ المالية الحالية الملفات المرفقة");
    expect(copy).not.toContain("النسخ الاحتياطي محلي بالكامل");
    const banner = readFileSync("src/components/ConsentBanner.tsx","utf8");
    expect(banner).toContain("خدمات سحابية أساسية");
    expect(banner).not.toContain("لا شيء يُرسَل");
  });
});
