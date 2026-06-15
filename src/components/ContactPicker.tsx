import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronsUpDown, Check, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type Contact = { id: string; name: string; phone: string | null };

export function ContactPicker({
  value,
  onChange,
  disabled,
}: {
  value: { id: string | null; name: string };
  onChange: (v: { id: string | null; name: string; phone?: string | null }) => void;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name,phone")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const { data, error } = await supabase
        .from("contacts")
        .insert({ user_id: u.user.id, name: newName.trim(), phone: newPhone.trim() || null })
        .select("id,name,phone")
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (c) => {
      toast.success("تمت إضافة جهة الاتصال");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      onChange({ id: c.id, name: c.name, phone: c.phone });
      setAddOpen(false);
      setNewName(""); setNewPhone("");
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {value.name || "اختر جهة اتصال..."}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="ابحث بالاسم..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-sm text-muted-foreground">لا توجد جهات مطابقة</div>
              </CommandEmpty>
              <CommandGroup>
                {contacts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      onChange({ id: c.id, name: c.name, phone: c.phone });
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value.id === c.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex-1">
                      <div>{c.name}</div>
                      {c.phone && <div className="text-[11px] text-muted-foreground" dir="ltr">{c.phone}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => { setOpen(false); setAddOpen(true); }}
                >
                  <Plus className="h-4 w-4" /> إضافة جهة اتصال جديدة
                </Button>
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>جهة اتصال جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={100} autoFocus />
            </div>
            <div>
              <Label>رقم الجوال (اختياري)</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} maxLength={30} dir="ltr" placeholder="+9665..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!newName.trim() || create.isPending} className="w-full">
              {create.isPending ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Trigger button to open the picker as standalone (used outside forms) */
export function ContactPickerTrigger() { return null; }

// Helper to expose Add Contact dialog usage elsewhere
export function AddContactDialog({ trigger, onCreated }: { trigger: React.ReactNode; onCreated?: (c: Contact) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const { data, error } = await supabase
        .from("contacts")
        .insert({ user_id: u.user.id, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null })
        .select("id,name,phone")
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (c) => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      onCreated?.(c);
      setOpen(false);
      setName(""); setPhone(""); setEmail(""); setNotes("");
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>جهة اتصال جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus /></div>
          <div><Label>رقم الجوال</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} dir="ltr" placeholder="+9665..." /></div>
          <div><Label>البريد الإلكتروني (اختياري)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} dir="ltr" /></div>
          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} className="w-full">
            {create.isPending ? "جاري الحفظ..." : "إضافة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
