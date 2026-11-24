/**
 * Rasd Android offline v1. Monetary amounts use integer halalas to avoid
 * floating point accounting errors. These records never leave the device.
 */
export interface LocalWallet { id: string; name: string; openingMinor: number; createdAt: string; }
export interface LocalEntry {
  id: string; walletId: string; kind: "income" | "expense";
  amountMinor: number; note: string; date: string; createdAt: string;
}
export interface LocalDebt {
  id: string; person: string; direction: "owed_to_me" | "i_owe";
  amountMinor: number; note: string; dueDate: string | null; createdAt: string;
}
export interface LocalLedger {
  schema: "rasd-ledger-v1"; currency: "SAR";
  wallets: LocalWallet[]; entries: LocalEntry[]; debts: LocalDebt[];
}
export const emptyLedger = (): LocalLedger => ({
  schema: "rasd-ledger-v1", currency: "SAR", wallets: [], entries: [], debts: [],
});
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const minor = (v: unknown) => typeof v === "number" &&
  Number.isSafeInteger(v) && v >= 0 && v <= 100_000_000_000_00;
const required = (v: unknown, max = 180) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isoDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function validateLedger(input: unknown): LocalLedger {
  if (!isRecord(input) || input.schema !== "rasd-ledger-v1" ||
      input.currency !== "SAR" || !Array.isArray(input.wallets) ||
      !Array.isArray(input.entries) || !Array.isArray(input.debts) ||
      input.wallets.length > 10000 || input.entries.length > 200000 ||
      input.debts.length > 200000) throw new Error("صيغة بيانات رصد المحلية غير معتمدة.");
  const ids = new Set<string>(), walletIds = new Set<string>();
  for (const w of input.wallets) {
    if (!isRecord(w) || !required(w.id, 80) || !required(w.name) ||
        !minor(w.openingMinor) || !required(w.createdAt, 40) || ids.has(w.id as string))
      throw new Error("بيانات محفظة غير سليمة.");
    ids.add(w.id as string); walletIds.add(w.id as string);
  }
  for (const e of input.entries) {
    if (!isRecord(e) || !required(e.id, 80) || ids.has(e.id as string) ||
        !walletIds.has(e.walletId as string) ||
        !["income", "expense"].includes(e.kind as string) ||
        !minor(e.amountMinor) || e.amountMinor === 0 ||
        typeof e.note !== "string" || e.note.length > 400 ||
        !isoDate(e.date) || !required(e.createdAt, 40))
      throw new Error("عملية مالية غير سليمة أو مرتبطة بمحفظة غير موجودة.");
    ids.add(e.id as string);
  }
  for (const d of input.debts) {
    if (!isRecord(d) || !required(d.id, 80) || ids.has(d.id as string) ||
        !required(d.person) || !["owed_to_me", "i_owe"].includes(d.direction as string) ||
        !minor(d.amountMinor) || d.amountMinor === 0 ||
        typeof d.note !== "string" || d.note.length > 400 ||
        (d.dueDate !== null && !isoDate(d.dueDate)) ||
        !required(d.createdAt, 40))
      throw new Error("سجل دين غير سليم.");
    ids.add(d.id as string);
  }
  return input as unknown as LocalLedger;
}
export const walletBalanceMinor = (w: LocalWallet, entries: LocalEntry[]) =>
  w.openingMinor + entries.filter(e => e.walletId === w.id)
    .reduce((sum, e) => sum + (e.kind === "income" ? e.amountMinor : -e.amountMinor), 0);
export function parseSAR(input: string): number {
  const normalized = input.trim().replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
  if (!/^(?:\d{1,10})(?:\.\d{1,2})?$/.test(normalized))
    throw new Error("أدخل مبلغًا صحيحًا بالريال، وبحد أقصى منزلتين عشريتين.");
  const [riyals, halalas = ""] = normalized.split(".");
  const amount = Number(riyals) * 100 + Number((halalas + "00").slice(0, 2));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000_000_00)
    throw new Error("المبلغ خارج الحدود المسموحة.");
  return amount;
}
