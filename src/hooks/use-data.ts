// Reusable read-only data hooks — Single Source of Truth for shared lookup lists.
// Additive only: existing pages keep their inline queries unchanged.
// New code should prefer these hooks to avoid duplicate fetches across the app.
//
// All hooks share TanStack Query cache keys so multiple consumers on the same
// page de-duplicate to a single network call.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const dataKeys = {
  wallets: ["data", "wallets"] as const,
  walletsAll: ["data", "wallets", "all"] as const,
  contacts: ["data", "contacts"] as const,
  categories: ["data", "categories"] as const,
  walletTxCategories: ["data", "wallet_tx_categories"] as const,
  projects: (status: "active" | "all" = "active") => ["data", "projects", status] as const,
  transactions: (limit = 200) => ["data", "transactions", limit] as const,
};

/** Active (non-archived) wallets, ordered by creation. */
export function useWallets() {
  return useQuery({
    queryKey: dataKeys.wallets,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** All wallets including archived — for management screens. */
export function useAllWallets() {
  return useQuery({
    queryKey: dataKeys.walletsAll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContacts() {
  return useQuery({
    queryKey: dataKeys.contacts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name,phone,email,kind,tags,notes")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: dataKeys.categories,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWalletTxCategories() {
  return useQuery({
    queryKey: dataKeys.walletTxCategories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_tx_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjects(status: "active" | "all" = "active") {
  return useQuery({
    queryKey: dataKeys.projects(status),
    queryFn: async () => {
      let q = supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (status === "active") q = q.eq("status", "active");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Unified transactions feed — the canonical source for any cross-module
 * reporting. Backed by the `transactions` table populated by DB triggers
 * from expenses, wallet_transactions, person_ledger, investment_transactions.
 */
export function useTransactions(limit = 200) {
  return useQuery({
    queryKey: dataKeys.transactions(limit),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("happened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}
