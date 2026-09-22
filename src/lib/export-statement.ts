// Export utilities: PDF via print-window (native Arabic), XLSX via SheetJS
import * as XLSX from "xlsx";
import { formatMoney, formatDate } from "@/lib/format";
import type { StatementRow } from "@/lib/statement";

export type ExportMeta = {
  title: string;        // e.g. "كشف حساب — الراجحي"
  subtitle?: string;    // e.g. period or holder
  currency: string;
  openingBalance?: number;
  closingBalance?: number;
};

export function exportStatementXlsx(rows: StatementRow[], meta: ExportMeta) {
  const data: any[] = [
    [meta.title],
    meta.subtitle ? [meta.subtitle] : [],
    [],
    ["التاريخ", "البيان", "التصنيف", "مدين", "دائن", "الرصيد"],
    ...[...rows].reverse().map((r) => [
      r.date,
      r.description,
      r.category,
      r.debit ? Number(r.debit.toFixed(2)) : "",
      r.credit ? Number(r.credit.toFixed(2)) : "",
      Number(r.balance.toFixed(2)),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  (ws as any)["!sheetView"] = { rightToLeft: true };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Statement");
  XLSX.writeFile(wb, `${meta.title.replace(/[\\/:*?"<>|]+/g, "_")}.xlsx`);
}

export function exportStatementPdf(rows: StatementRow[], meta: ExportMeta) {
  const html = renderStatementHTML(rows, meta);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  // Give the browser a moment to layout before invoking print
  setTimeout(() => {
    try { w.focus(); w.print(); } catch {
      // Printing can be blocked by the browser after the export window opens.
    }
  }, 350);
}

function renderStatementHTML(rows: StatementRow[], meta: ExportMeta) {
  const chrono = [...rows].reverse();
  const totalDebit = chrono.reduce((s, r) => s + r.debit, 0);
  const totalCredit = chrono.reduce((s, r) => s + r.credit, 0);
  const closing = meta.closingBalance ?? (chrono.length ? chrono[chrono.length - 1].balance : (meta.openingBalance ?? 0));
  const rowsHtml = chrono.map((r) => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(r.description)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td class="num">${r.debit ? formatMoney(r.debit, r.currency) : "—"}</td>
      <td class="num">${r.credit ? formatMoney(r.credit, r.currency) : "—"}</td>
      <td class="num bal">${formatMoney(r.balance, r.currency)}</td>
    </tr>`).join("");
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: "Segoe UI", "Tahoma", "Noto Sans Arabic", system-ui, sans-serif; color:#0f172a; }
  h1 { margin:0; font-size:20px; }
  .sub { color:#64748b; font-size:12px; margin-top:4px; }
  .summary { display:flex; gap:16px; flex-wrap:wrap; margin:14px 0 18px; }
  .pill { background:#f1f5f9; border-radius:10px; padding:8px 12px; font-size:12px; }
  .pill b { display:block; font-size:14px; margin-top:2px; }
  table { width:100%; border-collapse: collapse; font-size:12px; }
  th, td { border-bottom:1px solid #e2e8f0; padding:8px 6px; text-align:right; vertical-align: top; }
  th { background:#f8fafc; font-weight:600; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bal { font-weight:600; }
  tfoot td { font-weight:700; background:#f8fafc; }
  .brand { color:#0ea5e9; font-weight:700; font-size:12px; }
  .footer { margin-top:18px; font-size:10px; color:#94a3b8; text-align:center; }
</style>
</head>
<body>
  <div class="brand">رصد · Rasd</div>
  <h1>${escapeHtml(meta.title)}</h1>
  ${meta.subtitle ? `<div class="sub">${escapeHtml(meta.subtitle)}</div>` : ""}
  <div class="summary">
    ${meta.openingBalance != null ? `<div class="pill">الرصيد الافتتاحي<b>${formatMoney(meta.openingBalance, meta.currency)}</b></div>` : ""}
    <div class="pill">إجمالي المدين<b>${formatMoney(totalDebit, meta.currency)}</b></div>
    <div class="pill">إجمالي الدائن<b>${formatMoney(totalCredit, meta.currency)}</b></div>
    <div class="pill">الرصيد الختامي<b>${formatMoney(closing, meta.currency)}</b></div>
    <div class="pill">عدد الحركات<b>${chrono.length}</b></div>
  </div>
  <table>
    <thead><tr><th>التاريخ</th><th>البيان</th><th>التصنيف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8">لا توجد حركات</td></tr>`}</tbody>
  </table>
  <div class="footer">صُدر من تطبيق رصد · ${new Date().toLocaleString("ar")}</div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
