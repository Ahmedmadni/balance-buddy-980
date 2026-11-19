import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import { createDiagnosticExcel, createDiagnosticPdf } from "./diagnostic-files";

describe("Android Excel/PDF export diagnostic samples", () => {
  test("creates a real xlsx workbook with Arabic labels and numeric values", async () => {
    const blob = await createDiagnosticExcel();
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const book = XLSX.read(await blob.arrayBuffer(), { type: "array" });
    expect(book.SheetNames).toEqual(["اختبار رصد"]);
    const values = XLSX.utils.sheet_to_json<(string | number)[]>(
      book.Sheets["اختبار رصد"], { header: 1, raw: true },
    );
    expect(values[0]).toEqual(["اختبار رصد", "القيمة", "العملة"]);
    expect(values[1]).toEqual(["رصيد تجريبي", 123.45, "SAR"]);
    expect(values[2]).toEqual(["مصروف تجريبي", 23.4, "SAR"]);
  });
  test("creates a nonempty valid PDF header with no financial user data", async () => {
    const blob = await createDiagnosticPdf();
    expect(blob.type).toBe("application/pdf");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(800);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toStartWith("%PDF-");
    const full = new TextDecoder("latin1").decode(bytes);
    expect(full).toContain("Rasd Android PDF Test");
    expect(full).toContain("Synthetic export only");
  });
});
