import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Phone, MessageCircle, Pencil, Trash2, Contact as ContactIcon, ChevronLeft, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ContactImportButton } from "@/components/ContactImportButton";

export const Route = createFileRoute("/_authenticated/app/contacts")({
  head: () => ({ meta: [{ title: "جهات الاتصال — رصد" }] }),
  component: ContactsPage,
});

type Contact = { id: string; name: string; phone: string | null; email: string | null; notes: string | null };

function ContactsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name,phone,email,notes")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const { data: ledgerIds = [] } = useQuery({
    queryKey: ["ledger_contact_ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("person_ledger").select("contact_id");
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r: any) => r.contact_id).filter(Boolean)));
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      if (ledgerIds.includes(id)) throw new Error("لا يمكن حذف جهة اتصال لها حركات. احذف الحركات أولاً.");
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const filtered = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">جهات الاتصال</h1>
          <p className="text-sm text-muted-foreground mt-1">دفتر العناوين المرتبط بدفتر الأشخاص</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="h-4 w-4" /> جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <ContactForm editing={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["contacts"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        <ContactImportButton />
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الجوال..." className="pr-9" />
      </div>


      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent">
            <ContactIcon className="h-6 w-6 text-accent-foreground" />
          </div>
          <h3 className="mt-4 font-semibold">لا توجد جهات اتصال</h3>
          <p className="mt-1 text-sm text-muted-foreground">أضف جهات اتصال لاستخدامها في تسجيل الحركات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const phoneClean = c.phone?.replace(/[^\d+]/g, "");
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shrink-0 font-bold">
                  {c.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  {c.phone && <div className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{c.phone}</div>}
                  {c.notes && <div className="text-[11px] text-muted-foreground truncate">{c.notes}</div>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {phoneClean && (
                    <>
                      <Button asChild variant="ghost" size="icon"><a href={`tel:${phoneClean}`}><Phone className="h-4 w-4" /></a></Button>
                      <Button asChild variant="ghost" size="icon"><a href={`https://wa.me/${phoneClean.replace(/^\+/, "")}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 text-success" /></a></Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف جهة الاتصال؟")) del.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  <Button asChild variant="ghost" size="icon"><Link to="/app/people/$id" params={{ id: c.id }}><ChevronLeft className="h-4 w-4" /></Link></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContactForm({ editing, onDone }: { editing: Contact | null; onDone: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null };
      if (editing) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("غير مسجل");
        const { error } = await supabase.from("contacts").insert({ user_id: u.user.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>{editing ? "تعديل جهة اتصال" : "جهة اتصال جديدة"}</DialogTitle></DialogHeader>
      <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus /></div>
      <div><Label>رقم الجوال</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} dir="ltr" placeholder="+9665..." /></div>
      <div><Label>البريد الإلكتروني</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} dir="ltr" /></div>
      <div><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} /></div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={!name.trim() || mut.isPending}>{mut.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
      </DialogFooter>
    </form>
  );
}
