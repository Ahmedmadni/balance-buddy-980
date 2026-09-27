import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link } from "@tanstack/react-router";
import { Phone, MessageCircle, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildPersonStatement, type StatementRow } from "@/lib/statement";
import { StatementTable } from "@/components/StatementTable";
import { kindSign, PersonTxForm, type PersonLedgerInitial } from "@/components/PersonTxForm";
import { mutatePersonLedger } from "@/lib/person-ledger";
import { normalizeContactName } from "@/lib/contacts/encoding";
import { toast } from "sonner";

export function PersonStatementDrawer({
  contactId, contactName, onOpenChange,
}: { contactId: string | null; contactName?: string; onOpenChange: (v: boolean) => void }) {
  const open = !!contactId;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PersonLedgerInitial | null>(null);
  const [confirmDel, setConfirmDel] = useState<StatementRow | null>(null);
  const { data } = useQuery({
    enabled: !!contactId,
    queryKey: ["person-statement", contactId],
    queryFn: async () => {
      const [lRes, cRes] = await Promise.all([
        supabase.from("person_ledger")
          .select("id,kind,amount,currency,happened_at,notes,due_date,settled_at,contact_name,contact_id,wallet_id,reminder_enabled")
          .eq("contact_id", contactId!)
          .order("happened_at", { ascending: false }),
        supabase.from("contacts").select("id,name,phone").eq("id", contactId!).maybeSingle(),
      ]);
      return { rows: lRes.data ?? [], contact: cRes.data };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["person-statement", contactId] });
    qc.invalidateQueries({ queryKey: ["person_ledger"] });
    qc.invalidateQueries({ queryKey: ["wallets-list"] });
    qc.invalidateQueries({ queryKey: ["wallet-detail"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["reports"] });
  };

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const name = normalizeContactName(data?.contact?.name ?? contactName ?? rows[0]?.contact_name) || "—";
  const phone = data?.contact?.phone ?? null;

  // Group by currency
  const currencies = useMemo(() => Array.from(new Set(rows.map(r => r.currency))), [rows]);
  const primaryCur = currencies[0] ?? "SAR";

  const statement = useMemo(
    () => buildPersonStatement({ currency: primaryCur, rows: rows as any }),
    [rows, primaryCur],
  );

  // Summary across all currencies
  const summary = useMemo(() => {
    const byCur: Record<string, { lent: number; collected: number; borrowed: number; paid: number; net: number }> = {};
    for (const r of rows as any[]) {
      const c = r.currency;
      byCur[c] = byCur[c] ?? { lent: 0, collected: 0, borrowed: 0, paid: 0, net: 0 };
      const a = Number(r.amount);
      if (r.kind === "lend") byCur[c].lent += a;
      else if (r.kind === "collect") byCur[c].collected += a;
      else if (r.kind === "borrow") byCur[c].borrowed += a;
      else if (r.kind === "pay") byCur[c].paid += a;
      byCur[c].net += kindSign(r.kind) * a;
    }
    return byCur;
  }, [rows]);

  const phoneDigits = phone?.replace(/[^\d+]/g, "") ?? "";
  const waText = encodeURIComponent(`السلام عليكم ${name}،\nهذا تذكير ودي بخصوص الرصيد المعلّق بيننا. شكراً لك.`);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-right">كشف حساب — {name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(summary).map(([cur, s]) => {
              const positive = s.net > 0.001, negative = s.net < -0.001;
              return (
                <div key={cur} className="rounded-xl border bg-card p-4">
                  <div className="text-xs text-muted-foreground">العملة {cur}</div>
                  <div className={cn("text-xl font-bold tabular-nums mt-1", positive ? "text-success" : negative ? "text-destructive" : "")}>
                    {positive ? "له عليك " : negative ? "عليك له " : "متساوي "}{formatMoney(Math.abs(s.net), cur)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>أقرضت: <span className="tabular-nums text-foreground">{formatMoney(s.lent, cur)}</span></div>
                    <div>حُصِّل: <span className="tabular-nums text-foreground">{formatMoney(s.collected, cur)}</span></div>
                    <div>اقترضت: <span className="tabular-nums text-foreground">{formatMoney(s.borrowed, cur)}</span></div>
                    <div>سدّدت: <span className="tabular-nums text-foreground">{formatMoney(s.paid, cur)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {phoneDigits && (
              <>
                <Button asChild variant="outline" size="sm"><a href={`tel:${phoneDigits}`}><Phone className="h-4 w-4" /> اتصال</a></Button>
                <Button asChild variant="outline" size="sm"><a href={`https://wa.me/${phoneDigits.replace(/^\+/, "")}?text=${waText}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> واتساب</a></Button>
              </>
            )}
            {contactId && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/people/$id" params={{ id: contactId }}><ExternalLink className="h-4 w-4" /> الصفحة الكاملة</Link>
              </Button>
            )}
          </div>

          {currencies.length > 1 && (
            <div className="text-xs text-muted-foreground">يعرض الكشف أدناه عملة {primaryCur} فقط — العملات الأخرى لها بطاقاتها أعلاه.</div>
          )}

          <StatementTable
            rows={statement}
            meta={{
              title: `كشف حساب — ${name}`,
              subtitle: `العملة: ${primaryCur}`,
              currency: primaryCur,
            }}
            dense
            onEdit={(row) => {
              if (row.sourceTable === "person_ledger" && row.raw) {
                const r = row.raw as any;
                setEditing({
                  id: r.id,
                  kind: r.kind,
                  contact_id: r.contact_id,
                  contact_name: r.contact_name,
                  amount: r.amount,
                  currency: r.currency,
                  happened_at: r.happened_at,
                  due_date: r.due_date,
                  reminder_enabled: !!r.reminder_enabled,
                  notes: r.notes,
                  wallet_id: r.wallet_id,
                });
              }
            }}
            onDelete={(row) => setConfirmDel(row)}
          />
        </div>

        <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            {editing && (
              <PersonTxForm
                initial={editing}
                lockContact
                onDone={() => { setEditing(null); invalidate(); }}
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmDel} onOpenChange={(v) => { if (!v) setConfirmDel(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>سيتم حذف الحركة وأي أثر مرتبط بها في كشف المحفظة.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                if (!confirmDel?.sourceId) return;
                try {
                  await mutatePersonLedger("delete", confirmDel.sourceId);
                  toast.success("تم الحذف");
                  invalidate();
                } catch (e: any) {
                  toast.error("تعذر الحذف", { description: e.userMessage ?? "تعذر حفظ الحركة" });
                } finally {
                  setConfirmDel(null);
                }
              }}>حذف</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
