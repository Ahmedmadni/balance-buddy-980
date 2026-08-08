// =============================================================
// Contacts Regression Checklist (Prompt 30 — PART 4)
// -------------------------------------------------------------
// Manual-verification checklist surfaced in /app/system. Items marked
// "auto" are covered by the pure encoding/validation helpers and are
// verified in code; the rest require a real device/session run.
// =============================================================
import { decodeImportedContactName, isEncodedContactName } from "./encoding";
import { isValidContactId } from "./service";

export type ContactCheckStatus = "auto-pass" | "auto-fail" | "manual";

export interface ContactCheck {
  id: string;
  label: string;
  status: ContactCheckStatus;
  detail?: string;
}

function autoEncoding(): ContactCheck[] {
  const cases: [string, string, string][] = [
    ["arabic", "=D8=A3=D8=AD=D9=85=D8=AF", "أحمد"],
    ["english", "Ahmed el haram", "Ahmed el haram"],
    ["mixed", "=D8=A3=D8=AD=D9=85=D8=AF Ali", "أحمد Ali"],
    ["emoji", "=F0=9F=98=80 =D8=B9=D9=84=D9=8A", "😀 علي"],
    ["accents", "José Núñez", "José Núñez"],
  ];
  return cases.map(([id, input, expected]) => {
    const got = decodeImportedContactName(input);
    return {
      id: `encoding_${id}`,
      label: `فك ترميز الاسم (${id})`,
      status: got === expected ? "auto-pass" : "auto-fail",
      detail: got === expected ? got : `المتوقع "${expected}" والناتج "${got}"`,
    } as ContactCheck;
  });
}

export function getContactsRegressionChecklist(): ContactCheck[] {
  const safeName: ContactCheck = {
    id: "encoding_no_false_positive",
    label: "لا يتم فك ترميز الأسماء السليمة",
    status: !isEncodedContactName("محمد عبدالله") && !isEncodedContactName("A=B") ? "auto-pass" : "auto-fail",
  };
  const uuid: ContactCheck = {
    id: "delete_id_validation",
    label: "رفض المعرّفات غير الصالحة قبل الحذف",
    status:
      isValidContactId("db2cd3ea-4593-4ec7-9390-6154db4dc8bc") && !isValidContactId("not-a-uuid")
        ? "auto-pass"
        : "auto-fail",
  };

  const manual = [
    "استيراد جهة عربية",
    "استيراد جهة إنجليزية",
    "استيراد جهة مختلطة",
    "استيراد جهة تحتوي emoji",
    "استيراد عدة جهات دفعة واحدة",
    "البحث باسم عربي",
    "البحث باسم إنجليزي",
    "فتح جهة اتصال",
    "تعديل جهة اتصال",
    "حذف جهة واحدة",
    "تحديد عدة جهات",
    "حذف المحدد",
    "تحديث الصفحة والتحقق من الأسماء",
    "تسجيل خروج/دخول والتحقق من البقاء",
    "التأكد أن المحذوف لا يعود",
  ].map<ContactCheck>((label, i) => ({ id: `manual_${i}`, label, status: "manual" }));

  return [...autoEncoding(), safeName, uuid, ...manual];
}

export function contactsRegressionScore(): number {
  const list = getContactsRegressionChecklist();
  const auto = list.filter((c) => c.status !== "manual");
  if (!auto.length) return 0;
  return Math.round((auto.filter((c) => c.status === "auto-pass").length / auto.length) * 100);
}
