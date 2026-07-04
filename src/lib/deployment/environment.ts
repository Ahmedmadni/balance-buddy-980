// =============================================================
// PART 1 — Production Environment Profiles: environment tracking
// -------------------------------------------------------------
// Distinct from release/channels.ts's ReleaseChannel (which tracks
// audience rollout stage — who gets a build). Environment tracks the
// deployment/infrastructure target — which Supabase project and URLs
// this running instance is actually pointed at. The default is derived
// from a real signal (Vite's import.meta.env.DEV), not guessed.
// =============================================================

export type Environment = "development" | "staging" | "beta" | "production";

const KEY = "rasd.environment.v1";

const VALID_ENVIRONMENTS: Environment[] = ["development", "staging", "beta", "production"];

export const ENVIRONMENT_LABEL: Record<Environment, string> = {
  development: "Development",
  staging: "Staging",
  beta: "Beta",
  production: "Production",
};

function defaultEnvironment(): Environment {
  return import.meta.env?.DEV ? "development" : "production";
}

export function getCurrentEnvironment(): Environment {
  if (typeof localStorage === "undefined") return defaultEnvironment();
  try {
    const raw = localStorage.getItem(KEY);
    return raw && VALID_ENVIRONMENTS.includes(raw as Environment)
      ? (raw as Environment)
      : defaultEnvironment();
  } catch {
    return defaultEnvironment();
  }
}

export function setCurrentEnvironment(env: Environment): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, env);
  } catch {
    /* quota — best effort */
  }
}
