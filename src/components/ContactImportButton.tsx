import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createAuditEntry } from "@/lib/system/audit";
import { captureApplicationError } from "@/lib/system/errors";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Row = { name: string; phone: string | null; email: string | null };

// Parse a vCard (.vcf) file into { name, phone, email } records.
// vCard lines can be folded (continuation lines start with a space/tab) and
// quoted-printable values use a trailing "=" as a soft line break — both are
// unfolded here BEFORE decoding, otherwise Arabic names get truncated and
// stored as "=D8=A9=20=D8=B2...".
function parseVCF(text: string): Row[] {
  const unfolded = text
    .replace(/=\r?\n/g, "")      // quoted-printable soft breaks
    .replace(/\r?\n[ \t]/g, ""); // RFC 6350 folded lines
  const out: Row[] = [];
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  for (const card of cards) {
    const block = card.split(/END:VCARD/i)[0];
    const nameM = block.match(/^FN[^:]*:(.+)$/im) ?? block.match(/^N[^:]*:(.+)$/im);
    const phoneM = block.match(/^TEL[^:]*:(.+)$/im);
    const emailM = block.match(/^EMAIL[^:]*:(.+)$/im);
    const rawName = (nameM?.[1] ?? "").replace(/;+/g, " ").replace(/\s+/g, " ").trim();
    const name = normalizeContactName(rawName);
    if (!name) continue;
    out.push({
      name,
      phone: phoneM ? phoneM[1].trim().replace(/\s+/g, "") : null,
      email: emailM ? normalizeContactName(emailM[1].trim()) : null,
    });
  }
  return out;
}

export function ContactImportButton({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const hasPicker = typeof navigator !== "undefined" && "contacts" in navigator && "select" in (navigator as any).contacts;

  const importMany = useMutation({
    mutationFn: async (picked: Row[]) => {
      if (picked.length === 0) throw new Error("لم يتم اختيار أي جهة");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload = picked.map((r) => ({ user_id: u.user!.id, name: r.name, phone: r.phone, email: r.email }));
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) throw error;
      return picked.length;
    },
    onSuccess: (n) => {
      toast.success(`تم استيراد ${n} جهة اتصال`);
      createAuditEntry("import", `استيراد ${n} جهة اتصال`, { entityType: "contacts", meta: { count: n } });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false); setRows([]); setSelected(new Set()); setSearch("");
      onDone?.();
    },
    onError: (e: any) => { captureApplicationError(e, "import", { scope: "contacts" }); toast.error("خطأ", { description: e.message }); },
  });

  function openReview(list: Row[]) {
    if (list.length === 0) { toast.error("لم يتم العثور على جهات"); return; }
    setRows(list);
    setSelected(new Set(list.map((_, i) => i)));
    setSearch("");
    setOpen(true);
  }

  async function pickFromPhone() {
    if (!hasPicker) {
      toast.error("جهاز غير مدعوم", { description: "اختيار جهات الاتصال متاح على Chrome للأندرويد فقط حالياً." });
      return;
    }
    setBusy(true);
    try {
      const props = ["name", "tel", "email"];
      const picked = await (navigator as any).contacts.select(props, { multiple: true });
      const list: Row[] = (picked as any[]).map((p) => ({
        name: (p.name?.[0] ?? "").trim() || "بدون اسم",
        phone: p.tel?.[0] ?? null,
        email: p.email?.[0] ?? null,
      })).filter((r) => r.name);
      openReview(list);
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") toast.error("تعذّر فتح جهات الاتصال", { description: e?.message ?? "" });
    } finally { setBusy(false); }
  }


  const q = search.trim().toLowerCase();
  const visibleIdx = rows
    .map((_, i) => i)
    .filter((i) => {
      if (!q) return true;
      const r = rows[i];
      return r.name.toLowerCase().includes(q) || (r.phone ?? "").includes(q);
    });
  const allVisibleSelected = visibleIdx.length > 0 && visibleIdx.every((i) => selected.has(i));

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelected(next);
  }
  function toggleAllVisible() {
    const next = new Set(selected);
    if (allVisibleSelected) visibleIdx.forEach((i) => next.delete(i));
    else visibleIdx.forEach((i) => next.add(i));
    setSelected(next);
  }

  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" onClick={pickFromPhone} disabled={busy}>
        <Smartphone className="h-4 w-4" /> من جهات الهاتف
      </Button>


      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows([]); setSelected(new Set()); setSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>اختر الجهات للاستيراد</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الجوال..." />

            <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} />
                تحديد الكل {q ? "(المعروض)" : ""}
              </label>
              <span className="text-xs text-muted-foreground">{selected.size} / {rows.length}</span>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1">
              {visibleIdx.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">لا نتائج</div>
              ) : visibleIdx.map((i) => {
                const r = rows[i];
                const checked = selected.has(i);
                return (
                  <label key={i} className="flex items-center gap-3 rounded-xl border bg-card p-2.5 cursor-pointer hover:bg-accent/40">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(i)} />
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-white font-bold text-sm shrink-0">
                      {r.name.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{r.name}</div>
                      {r.phone && <div className="text-[11px] text-muted-foreground" dir="ltr">{r.phone}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={importMany.isPending}>إلغاء</Button>
            <Button
              type="button"
              onClick={() => importMany.mutate(Array.from(selected).map((i) => rows[i]))}
              disabled={selected.size === 0 || importMany.isPending}
            >
              {importMany.isPending ? "جاري الاستيراد..." : `استيراد (${selected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
