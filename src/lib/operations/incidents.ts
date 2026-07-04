// =============================================================
// PART 6 — generateIncidentPlaybook()
// -------------------------------------------------------------
// Pure documentation — each category names the real existing tool that
// would detect/mitigate it (validateFinancialIntegrity(), Emergency
// Mode actions, verifyBackupIntegrity(), notification health check,
// Supabase Auth) rather than inventing a new detection mechanism.
// =============================================================
export interface IncidentPlaybookEntry {
  id: string;
  label: string;
  detection: string;
  immediateAction: string;
  resolution: string;
}

export interface IncidentPlaybook {
  entries: IncidentPlaybookEntry[];
  generatedAt: string;
}

export function generateIncidentPlaybook(): IncidentPlaybook {
  const entries: IncidentPlaybookEntry[] = [
    {
      id: "financial_incident",
      label: "Financial Incident",
      detection: "validateFinancialIntegrity() (لوحة النظام) يُبلِّغ أخطاء سلامة مالية فورية",
      immediateAction:
        "تجميد الثقة بالأرقام المعروضة، إشعار المستخدمين المتأثرين، عدم تعديل أي صف يدوياً قبل التشخيص",
      resolution:
        "تتبّع سبب عدم التطابق عبر سجل الحركات (transactions/investment_transactions) دون كتابة يدوية مباشرة — أي إصلاح يتطلب مراجعة مطوّر يملك صلاحية على المحرك المالي المجمَّد",
    },
    {
      id: "security_incident",
      label: "Security Incident",
      detection: "نشاط مصادقة غير معتاد عبر Supabase Auth logs، أو بلاغ مستخدم بدخول غير مصرَّح",
      immediateAction:
        "تدوير مفاتيح Supabase إن اشتُبه بتسريبها، إبلاغ المستخدمين المتأثرين، مراجعة RLS Policies (بدون تعديلها إلا بعد تأكيد الحاجة)",
      resolution:
        "تحقيق كامل، وإن لزم Amendment لسياسة RLS يمر عبر عملية مراجعة منفصلة خارج هذا الـ Runbook",
    },
    {
      id: "backup_failure",
      label: "Backup Failure",
      detection:
        "verifyBackupIntegrity() (Backup Health في لوحة النظام) يُبلِّغ status: error أو نسخة تالفة",
      immediateAction: "تنبيه المستخدم لأخذ نسخة يدوية فورية عبر exportUserData() كإجراء احترازي",
      resolution:
        "تشخيص سبب الفشل (مساحة تخزين، بنية بيانات غير متوقعة) دون تعديل Backup Engine نفسه",
    },
    {
      id: "notification_failure",
      label: "Notification Failure",
      detection: "processPendingNotifications() (Notification Health) يُبلِّغ عدد failed مرتفع",
      immediateAction:
        "فحص notifications/provider.ts للتأكد من عدم تغيّر إذن المتصفح (Notification.permission)",
      resolution: "لا إصلاح تلقائي — يتطلب تدخّل مطوّر لأن Notification Engine مجمَّد",
    },
    {
      id: "authentication_failure",
      label: "Authentication Failure",
      detection: "فشل تسجيل دخول جماعي مُبلَّغ من عدة مستخدمين، أو خطأ 401/403 متكرر في الشبكة",
      immediateAction:
        "التحقق من صلاحية VITE_SUPABASE_URL/KEY (نفس فحص validateEnvironment())، وحالة خدمة Supabase Cloud",
      resolution:
        "إن كانت المشكلة من طرف Supabase: الانتظار/التواصل مع الدعم؛ إن كانت من طرف التطبيق: مراجعة integrations/supabase/client.ts",
    },
    {
      id: "data_corruption",
      label: "Data Corruption",
      detection: "runSystemHealthCheck() (قسم Health) يُبلِّغ status: error في قاعدة البيانات",
      immediateAction:
        "إيقاف أي عملية كتابة إضافية على الجدول المتأثر، أخذ نسخة احتياطية للحالة الحالية قبل أي إصلاح",
      resolution:
        "استعادة من آخر نسخة احتياطية سليمة (راجع operations/disaster.ts) إن تعذّر الإصلاح المباشر",
    },
    {
      id: "service_outage",
      label: "Service Outage",
      detection: "فشل تحميل أي صفحة رئيسية، أو runSystemHealthCheck() لا يستجيب إطلاقاً",
      immediateAction:
        "تفعيل وضع الصيانة عبر enableMaintenanceMode() (Emergency Mode) لعرض رسالة واضحة للمستخدمين",
      resolution:
        "تشخيص الطبقة المتعطلة (Supabase Cloud مقابل CDN استضافة الواجهة) ثم disableMaintenanceMode() بعد التأكد",
    },
  ];

  return {
    entries,
    generatedAt: new Date().toISOString(),
  };
}
