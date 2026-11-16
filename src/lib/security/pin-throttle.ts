/** Local UI rate limiting only. This does not replace OS/Keystore-backed authentication. */
export interface PinAttempts {
  failures: number;
  blockedUntil: number;
}

export function calculatePinDelay(failures: number): number {
  if (!Number.isFinite(failures) || failures < 5) return 0;
  return Math.min(5 * 60_000, 30_000 * 2 ** Math.floor((failures - 5) / 3));
}

export function getRetryMs(attempts: PinAttempts, now = Date.now()): number {
  return Math.max(0, attempts.blockedUntil - now);
}
