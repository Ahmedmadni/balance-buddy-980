/**
 * Synthetic device-only export examples. Never read Supabase, real reports,
 * cached queries, localStorage or user identifiers.
 */
export async function createDiagnosticExcel(): Promise<Blob> {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    ["اختبار رصد", "القيمة", "العملة"],
    ["رصيد تجريبي", 123.45, "SAR"],
    ["مصروف تجريبي", 23.4, "SAR"],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "اختبار رصد");
  const data = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * The built-in jsPDF font cannot correctly typeset Arabic without embedding
 * an Arabic-compatible font, so this printable English test avoids a false
 * positive while verifying PDF file generation and Android sharing.
 */
export async function createDiagnosticPdf(): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Rasd Android PDF Test", 20, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Synthetic export only. No real financial records.", 20, 43);
  doc.text("Amount: 123.45 SAR (test data)", 20, 54);
  return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
}
