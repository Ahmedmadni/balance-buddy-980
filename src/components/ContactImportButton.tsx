import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Parse a vCard (.vcf) file into { name, phone, email } records
function parseVCF(text: string) {
  const out: { name: string; phone: string | null; email: string | null }[] = [];
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  for (const card of cards) {
    const block = card.split(/END:VCARD/i)[0];
    const nameM = block.match(/^FN[^:]*:(.+)$/im) ?? block.match(/^N[^:]*:(.+)$/im);
    const phoneM = block.match(/^TEL[^:]*:(.+)$/im);
    const emailM = block.match(/^EMAIL[^:]*:(.+)$/im);
    const name = (nameM?.[1] ?? "").replace(/;+/g, " ").replace(/\s+/g, " ").trim();
    if (!name) continue;
    out.push({
      name,
      phone: phoneM ? phoneM[1].trim().replace(/\s+/g, "") : null,
      email: emailM ? emailM[1].trim() : null,
    });
  }
  return out;
}

export function ContactImportButton({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const hasPicker = typeof navigator !== "undefined" && "contacts" in navigator && "select" in (navigator as any).contacts;

  const importMany = useMutation({
    mutationFn: async (rows: { name: string; phone: string | null; email: string | null }[]) => {
      if (rows.length === 0) throw new Error("لا توجد جهات");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload = rows.map((r) => ({ user_id: u.user!.id, name: r.name, phone: r.phone, email: r.email }));
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(`تم استيراد ${n} جهة اتصال`); qc.invalidateQueries({ queryKey: ["contacts"] }); onDone?.(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  async function pickFromPhone() {
    setBusy(true);
    try {
      const props = ["name", "tel", "email"];
      const picked = await (navigator as any).contacts.select(props, { multiple: true });
      const rows = (picked as any[]).map((p) => ({
        name: (p.name?.[0] ?? "").trim() || "بدون اسم",
        phone: p.tel?.[0] ?? null,
        email: p.email?.[0] ?? null,
      })).filter((r) => r.name);
      await importMany.mutateAsync(rows);
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") toast.error("تعذّر فتح جهات الاتصال", { description: e?.message ?? "" });
    } finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      const rows = parseVCF(text);
      if (rows.length === 0) { toast.error("لم يتم العثور على بطاقات vCard"); return; }
      await importMany.mutateAsync(rows);
    } finally { setBusy(false); e.target.value = ""; }
  }

  return (
    <div className="flex gap-2">
      {hasPicker && (
        <Button type="button" variant="outline" onClick={pickFromPhone} disabled={busy}>
          <Smartphone className="h-4 w-4" /> من جهات الهاتف
        </Button>
      )}
      <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Upload className="h-4 w-4" /> استيراد .vcf
      </Button>
      <input ref={fileRef} type="file" accept=".vcf,text/vcard" className="hidden" onChange={onFile} />
    </div>
  );
}
