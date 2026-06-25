import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Search, Pencil, Trash2 } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { exportStatementPdf, exportStatementXlsx, type ExportMeta } from "@/lib/export-statement";
import { filterByPeriod, type StatementRow } from "@/lib/statement";

export function StatementTable({
  rows, meta, dense, onEdit, onDelete,
}: {
  rows: StatementRow[];
  meta: ExportMeta;
  dense?: boolean;
  onEdit?: (row: StatementRow) => void;
  onDelete?: (row: StatementRow) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => filterByPeriod(rows, from || undefined, to || undefined, q), [rows, from, to, q]);
  const showActions = !!(onEdit || onDelete);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto_auto]">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في البيان أو التصنيف..." className="pr-9 h-9" />
        </div>
        <div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" dir="ltr" aria-label="من" />
        </div>
        <div>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" dir="ltr" aria-label="إلى" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => exportStatementPdf(filtered, meta)} disabled={!filtered.length}>
          <FileDown className="h-4 w-4" /> PDF
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exportStatementXlsx(filtered, meta)} disabled={!filtered.length}>
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </Button>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr className="[&>th]:p-2 [&>th]:text-right [&>th]:font-semibold">
                <th>التاريخ</th>
                <th>البيان</th>
                <th className="hidden sm:table-cell">التصنيف</th>
                <th className="text-center">مدين</th>
                <th className="text-center">دائن</th>
                <th className="text-center">الرصيد</th>
                {showActions && <th className="text-center">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={showActions ? 7 : 6} className="p-8 text-center text-muted-foreground text-sm">لا توجد حركات في النطاق المختار</td></tr>
              ) : filtered.map((r) => {
                const clickable = !!onEdit && !r.lockedMirror;
                return (
                <tr
                  key={r.id}
                  className={cn("border-t hover:bg-accent/30", dense ? "[&>td]:p-1.5" : "[&>td]:p-2", clickable && "cursor-pointer")}
                  onClick={clickable ? () => onEdit!(r) : undefined}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit!(r); } } : undefined}
                >
                  <td className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="min-w-[180px]">
                    {r.description}
                    {r.lockedMirror && (
                      <span className="ms-2 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        مرتبطة بـ {r.category}
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell text-xs text-muted-foreground">{r.category}</td>
                  <td className="text-center tabular-nums text-destructive">{r.debit ? formatMoney(r.debit, r.currency) : "—"}</td>
                  <td className="text-center tabular-nums text-success">{r.credit ? formatMoney(r.credit, r.currency) : "—"}</td>
                  <td className="text-center tabular-nums font-semibold">{formatMoney(r.balance, r.currency)}</td>
                  {showActions && (
                    <td className="text-center whitespace-nowrap">
                      {r.lockedMirror ? (
                        <span className="text-[10px] text-muted-foreground">عدّل من المصدر</span>
                      ) : (
                        <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {onEdit && (
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)} aria-label="تعديل">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(r)} aria-label="حذف">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-muted/40 text-xs font-bold">
                <tr className="[&>td]:p-2">
                  <td colSpan={3} className="text-right">الإجمالي</td>
                  <td className="text-center tabular-nums text-destructive">{formatMoney(filtered.reduce((s, r) => s + r.debit, 0), meta.currency)}</td>
                  <td className="text-center tabular-nums text-success">{formatMoney(filtered.reduce((s, r) => s + r.credit, 0), meta.currency)}</td>
                  <td className="text-center tabular-nums">{formatMoney(filtered[0]?.balance ?? 0, meta.currency)}</td>
                  {showActions && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
