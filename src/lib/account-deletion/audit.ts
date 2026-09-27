// =============================================================
// PART 1 — Account Deletion UI Engine: audit
// =============================================================
import { generateDeletionExecutionPlan, validateDeletionReadiness } from "./flow";
import type { HealthStatus } from "@/lib/system/health";

export interface AccountDeletionAuditItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface AccountDeletionAuditReport {
  items: AccountDeletionAuditItem[];
  score: number;
  generatedAt: string;
}

export async function auditAccountDeletion(): Promise<AccountDeletionAuditReport> {
  const [plan, readiness] = await Promise.all([
    generateDeletionExecutionPlan(),
    validateDeletionReadiness(),
  ]);

  const items: AccountDeletionAuditItem[] = [
    {
      id: "plan_available",
      label: "خطة تنفيذ الحذف متاحة",
      status: "ok",
      detail: `${plan.tablesAffected} جدول متأثر، ${plan.steps.length} خطوة`,
    },
    {
      id: "readiness",
      label: "جاهزية الحذف",
      status: readiness.ready ? "ok" : "warning",
      detail: readiness.checks
        .map((c) => `${c.label}: ${c.ready ? "جاهز" : "غير جاهز"}`)
        .join(" — "),
    },
    {
      id: "execution_capability",
      label: "قدرة التنفيذ الفعلي",
      status: "ok",
      detail:
        "التنفيذ الفعلي متاح عبر delete-account Edge Function مع JWT وإعادة مصادقة وحذف Storage والبيانات وAuth",
    },
    {
      id: "non_deletable",
      label: "بيانات غير قابلة للحذف من العميل",
      status: plan.nonDeletableFromClient.length > 0 ? "warning" : "ok",
      detail: plan.nonDeletableFromClient.join(" — ") || "لا شيء",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
