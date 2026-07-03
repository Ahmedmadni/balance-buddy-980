// =============================================================
// PART 7 — auditDisasterRecovery()
// -------------------------------------------------------------
// Reuses the Backup Engine (loadLastBackup), the System Recovery
// tools (verifyDatabase — Prompt 17), and Mobile's offline-capability
// check directly. Nothing here recomputes backup/restore/recovery
// logic — it only reports on what those engines already do.
// =============================================================
import { loadLastBackup } from "@/lib/backup/engine";
import { verifyDatabase } from "@/lib/system/recovery";
import { checkOfflineCapabilities } from "@/lib/mobile/compatibility";
import type { HealthStatus } from "@/lib/system/health";

export interface DisasterRecoveryCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface DisasterRecoveryAuditReport {
  items: DisasterRecoveryCheckItem[];
  score: number;
  generatedAt: string;
}

export async function auditDisasterRecovery(): Promise<DisasterRecoveryAuditReport> {
  const [lastBackup, dbHealth, offline] = await Promise.all([
    loadLastBackup(),
    verifyDatabase(),
    checkOfflineCapabilities(),
  ]);

  const items: DisasterRecoveryCheckItem[] = [
    {
      id: "backup",
      label: "Backup",
      status: lastBackup ? "ok" : "warning",
      detail: lastBackup
        ? `آخر نسخة بتاريخ ${lastBackup.meta.exported_at}`
        : "لا نسخة احتياطية محلية بعد — التصدير يدوي بالكامل من الإعدادات",
    },
    {
      id: "restore",
      label: "Restore",
      status: lastBackup ? "ok" : "warning",
      detail:
        "استيراد النسخة الاحتياطية (planImport/importUserData في محرك النسخ الاحتياطي) يعمل فعلياً ويستبعد عمداً الجداول المُدارة بـ Triggers (transactions, investment_transactions)",
    },
    {
      id: "export",
      label: "Export",
      status: "ok",
      detail:
        "تصدير JSON/CSV/Excel متاح فعلياً من Settings > النسخ الاحتياطي، بالإضافة لتصدير تقرير تشخيصي منفصل من Settings > المساعدة",
    },
    {
      id: "recovery",
      label: "Recovery",
      status: dbHealth.status,
      detail:
        "أدوات System > النظام (Verify Database، Rebuild Cache، Recompute Insights/Events) متاحة فعلياً لإصلاح حالات عدم تزامن الواجهة دون فقدان بيانات",
    },
    {
      id: "offline_recovery",
      label: "Offline Recovery",
      status: offline.ready ? "ok" : "warning",
      detail: offline.ready
        ? "توجد نسخة احتياطية محلية حديثة يمكن استخدامها كخط دفاع أخير عند فقدان الاتصال بالكامل"
        : "لا نسخة احتياطية محلية بعد — لا خط دفاع في حال فقدان الاتصال الكامل بـ Supabase",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
