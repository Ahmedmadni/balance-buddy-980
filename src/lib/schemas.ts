import { z } from "zod";

// Shared atoms
export const amountSchema = z
  .number({ message: "أدخل مبلغًا صحيحًا" })
  .finite()
  .min(0, "المبلغ يجب أن يكون أكبر من صفر")
  .max(1_000_000_000, "المبلغ كبير جدًا");

export const positiveAmountSchema = amountSchema.refine((v) => v > 0, "المبلغ يجب أن يكون أكبر من صفر");

export const currencySchema = z.string().trim().length(3, "رمز العملة 3 أحرف (مثل SAR)").toUpperCase();

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ غير صحيحة");

export const shortText = (max = 120) =>
  z.string().trim().min(1, "هذا الحقل مطلوب").max(max, `الحد الأقصى ${max} حرف`);

export const longText = (max = 1000) =>
  z.string().trim().max(max, `الحد الأقصى ${max} حرف`).optional().or(z.literal(""));

// Wallet transaction
export const walletTxSchema = z.object({
  wallet_id: z.string().uuid("المحفظة مطلوبة"),
  kind: z.enum(["deposit", "withdraw", "transfer", "adjustment", "send", "receive"]),
  amount: positiveAmountSchema,
  currency: currencySchema,
  happened_at: isoDateSchema,
  note: longText(500),
  category_id: z.string().uuid().optional().nullable(),
  counterparty_wallet_id: z.string().uuid().optional().nullable(),
});

// Expense
export const expenseSchema = z.object({
  wallet_id: z.string().uuid("المحفظة مطلوبة"),
  category_id: z.string().uuid("الفئة مطلوبة"),
  amount: positiveAmountSchema,
  currency: currencySchema,
  spent_at: isoDateSchema,
  note: longText(500),
  vendor: z.string().trim().max(120).optional().or(z.literal("")),
});

// Person ledger
export const personLedgerSchema = z.object({
  contact_id: z.string().uuid("اختر جهة الاتصال").optional().nullable(),
  contact_name: shortText(120),
  kind: z.enum(["lend", "borrow", "collect", "pay"]),
  amount: positiveAmountSchema,
  currency: currencySchema,
  happened_at: isoDateSchema,
  due_date: isoDateSchema.optional().nullable(),
  note: longText(500),
  wallet_id: z.string().uuid().optional().nullable(),
});

// Contact
export const contactSchema = z.object({
  display_name: shortText(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("بريد غير صالح").max(255).optional().or(z.literal("")),
  note: longText(500),
});

// Wallet
export const walletSchema = z.object({
  name: shortText(80),
  type: shortText(40),
  currency: currencySchema,
  opening_balance: amountSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "اللون غير صالح").optional().nullable(),
});

// Investment
export const investmentSchema = z.object({
  name: shortText(120),
  kind: shortText(40),
  currency: currencySchema,
  initial_amount: amountSchema,
  note: longText(500),
});

// Zakat
export const zakatSchema = z.object({
  due_date: isoDateSchema,
  base_amount: positiveAmountSchema,
  paid_amount: amountSchema.optional().nullable(),
  currency: currencySchema,
  note: longText(500),
});

export type WalletTxInput = z.infer<typeof walletTxSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type PersonLedgerInput = z.infer<typeof personLedgerSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type WalletInput = z.infer<typeof walletSchema>;
