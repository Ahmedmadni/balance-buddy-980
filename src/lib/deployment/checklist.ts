// =============================================================
// PART 1 — generateEnvironmentChecklist()
// -------------------------------------------------------------
// Thin composition layer: combines getCurrentEnvironment() with
// validateEnvironment() into one checklist shape for the Production
// Launch Center UI, matching the {items,score,generatedAt} convention
// used by every other audit report this session.
// =============================================================
import { getCurrentEnvironment, ENVIRONMENT_LABEL } from "./environment";
import { validateEnvironment, type EnvironmentCheckItem } from "./validation";

export interface EnvironmentChecklistReport {
  environment: string;
  items: EnvironmentCheckItem[];
  score: number;
  ready: boolean;
  generatedAt: string;
}

export function generateEnvironmentChecklist(): EnvironmentChecklistReport {
  const env = getCurrentEnvironment();
  const validation = validateEnvironment();
  const blockingErrors = validation.items.filter((i) => i.status === "error").length;

  return {
    environment: ENVIRONMENT_LABEL[env],
    items: validation.items,
    score: validation.score,
    ready: blockingErrors === 0,
    generatedAt: new Date().toISOString(),
  };
}
