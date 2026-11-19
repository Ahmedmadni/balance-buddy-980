/**
 * Report dates are calendar dates, not timestamps. Use a half-open interval:
 * [from, dayAfter(to)). This includes all records on the user's selected
 * final date even if happened_at has hours, minutes or fractional seconds.
 *
 * Boundaries remain DB calendar dates, matching existing report query
 * semantics. Do not silently shift them using the device timezone.
 */
export interface ReportDateRange {
  fromInclusive: string;
  toExclusive: string;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function buildReportDateRange(from: string, to: string): ReportDateRange | null {
  if (!validDate(from) || !validDate(to) || from > to) return null;
  const end = new Date(to + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const next = end.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return null;
  return { fromInclusive: from, toExclusive: next };
}

export function isInReportDateRange(
  value: string | null | undefined,
  range: ReportDateRange,
): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  const day = value.slice(0, 10);
  return day >= range.fromInclusive && day < range.toExclusive;
}
