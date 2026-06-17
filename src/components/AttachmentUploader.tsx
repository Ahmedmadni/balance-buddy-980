import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, FileText, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  entityType: "expense" | "person_ledger" | "wallet_tx" | "debt" | "recurring_expense";
  entityId: string;
  compact?: boolean;
};

type Att = {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string | null;
  created_at: string;
};

export function AttachmentUploader({ entityType, entityId, compact }: Props) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["attachments", entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id,file_path,file_name,mime_type,size_bytes,kind,created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Att[];
    },
  });

  const del = useMutation({
    mutationFn: async (a: Att) => {
      await supabase.storage.from("attachments").remove([a.file_path]);
      const { error } = await supabase.from("attachments").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attachments", entityType, entityId] }); toast.success("تم الحذف"); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  async function onPick(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      for (const f of Array.from(files)) {
        const ext = f.name.split(".").pop() ?? "bin";
        const key = `${u.user.id}/${entityType}/${entityId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("attachments").upload(key, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("attachments").insert({
          user_id: u.user.id, entity_type: entityType, entity_id: entityId,
          file_path: key, file_name: f.name, mime_type: f.type, size_bytes: f.size,
        });
        if (insErr) throw insErr;
      }
      qc.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
      toast.success("تم الرفع");
    } catch (e: any) {
      toast.error("فشل الرفع", { description: e.message });
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function download(a: Att) {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(a.file_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> المرفقات {items?.length ? `(${items.length})` : ""}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={uploading}>
          <Upload className="h-3.5 w-3.5" /> {uploading ? "جاري الرفع..." : "إضافة"}
        </Button>
        <input ref={ref} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
      </div>
      {(items?.length ?? 0) > 0 && (
        <ul className="space-y-1">
          {items!.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{a.file_name}</span>
              {!compact && a.size_bytes != null && (
                <span className="text-[10px] text-muted-foreground tabular-nums">{(a.size_bytes / 1024).toFixed(0)} KB</span>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(a)}><Download className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(a)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
