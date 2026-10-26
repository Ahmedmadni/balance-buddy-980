type AuthSession = { access_token: string } | null;

// OAuth must return to a public same-origin page before entering the guarded app.
export function authReturnUrl(origin: string): string {
  return new URL("/auth", origin).href;
}

export function canEnterApp(session: AuthSession): boolean {
  return Boolean(session?.access_token);
}