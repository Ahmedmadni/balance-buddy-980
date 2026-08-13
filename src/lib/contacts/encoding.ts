// =============================================================
// Contact name encoding utilities
// -------------------------------------------------------------
// Root cause of the "=D8=A9=20=D8=B2..." names: contacts imported from
// a vCard (.vcf) whose N/FN lines were stored with
// `ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8`. The old parser copied the
// raw line verbatim, so the quoted-printable bytes were persisted as
// plain text (and truncated at the soft line-break, hence the trailing
// "=" on 70-char names).
//
// These helpers decode such values SAFELY:
//  - they never touch a string that is not in the mangled form
//  - they never throw; on failure the original string is returned
// =============================================================

/** Detects a quoted-printable-encoded name such as "=D8=A7=D8=AD=D9=85=D8=AF". */
export function isEncodedContactName(value: string | null | undefined): boolean {
  if (!value) return false;
  // At least two consecutive =XX escapes — enough to rule out a normal
  // name that merely contains an "=" character.
  return /(?:=[0-9A-Fa-f]{2}){2,}/.test(value);
}

/**
 * Decodes a quoted-printable UTF-8 contact name.
 * Returns the input unchanged when it is not encoded or cannot be decoded.
 */
export function decodeImportedContactName(value: string | null | undefined): string {
  const input = (value ?? "").toString();
  if (!input || !isEncodedContactName(input)) return input;

  try {
    // Remove soft line breaks ("=\r\n" / "=\n") and a dangling trailing "="
    const normalized = input.replace(/=\r?\n[ \t]?/g, "").replace(/=$/, "");

    const bytes: number[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(normalized.slice(i + 1, i + 3))) {
        bytes.push(parseInt(normalized.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        // Plain ASCII (or already-decoded) characters pass through as UTF-8
        for (const b of new TextEncoder().encode(ch)) bytes.push(b);
      }
    }

    const decoded = new TextDecoder("utf-8", { fatal: false })
      .decode(new Uint8Array(bytes))
      .replace(/\uFFFD+$/g, "") // drop a partial character left by truncation
      .replace(/\s+/g, " ")
      .trim();

    return decoded || input;
  } catch {
    return input;
  }
}

/** Detects percent-encoded UTF-8 such as "%D8%A3%D8%AD". */
function isPercentEncoded(v: string): boolean {
  return /(?:%[0-9A-Fa-f]{2}){2,}/.test(v);
}

/**
 * Single reusable normalizer for any imported contact name.
 * Handles quoted-printable UTF-8, percent-encoded UTF-8, plain Unicode
 * (Arabic/Latin/mixed), and null/undefined — never double-decodes and
 * never throws.
 */
export function normalizeImportedContactName(value: unknown): string {
  if (value == null) return "";
  let s = typeof value === "string" ? value : String(value);

  // Strip control characters (except tab/newline which collapse to space).
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  if (isEncodedContactName(s)) s = decodeImportedContactName(s);
  else if (isPercentEncoded(s)) {
    try {
      s = decodeURIComponent(s);
    } catch {
      /* leave as-is */
    }
  }

  // vCard structured names use ";" separators — turn into spaces.
  s = s.replace(/;+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Convenience: decode when needed, otherwise return the name as-is. */
export function normalizeContactName(value: string | null | undefined): string {
  return normalizeImportedContactName(value);
}
