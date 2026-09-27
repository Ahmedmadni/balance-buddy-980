import { supabase } from "@/integrations/supabase/client";
import { LOCAL_STORAGE_KEYS } from "@/lib/compliance/data-deletion-plan";

export const ACCOUNT_DELETION_CONFIRMATION = "حذف حسابي";

export interface AccountDeletionResult {
  deleted: true;
  requestId: string;
  storageFilesDeleted: number;
  tablesProcessed: number;
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `delete_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function requestAccountDeletion(
  password: string,
  confirmation = ACCOUNT_DELETION_CONFIRMATION,
): Promise<AccountDeletionResult> {
  const { data, error } = await supabase.functions.invoke<AccountDeletionResult>("delete-account", {
    body: { password, confirmation, requestId: newRequestId() },
  });

  if (error) throw error;
  if (!data?.deleted) throw new Error("لم يؤكد الخادم اكتمال حذف الحساب");
  return data;
}

export async function clearLocalAccountData(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The Auth user no longer exists after a successful deletion. Local cleanup
    // must still continue even when the remote sign-out request cannot succeed.
  }

  for (const key of LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
  sessionStorage.clear();

  if ("caches" in globalThis) {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith("rasd-")).map((name) => caches.delete(name)),
    );
  }
}
