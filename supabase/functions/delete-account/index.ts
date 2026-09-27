import { createClient } from "npm:@supabase/supabase-js@2.108.1";

const CONFIRMATION_TEXT = "حذف حسابي";
const STORAGE_BUCKET = "attachments";
const DELETE_BATCH_SIZE = 100;
const RECENT_SIGN_IN_WINDOW_MS = 5 * 60 * 1000;

// Leaf tables first. Repeating any of these deletes is safe, which makes a
// partially completed request retryable while the Auth user still exists.
const USER_TABLES = [
  "debt_payments",
  "asset_market_values",
  "depreciation_profiles",
  "expense_allocations",
  "recurring_expenses",
  "investment_transactions",
  "person_ledger",
  "expenses",
  "wallet_transactions",
  "attachments",
  "system_events",
  "debts",
  "investments",
  "zakat_records",
  "zakat_settings",
  "exchange_rates",
  "projects",
  "wallet_tx_categories",
  "categories",
  "contacts",
  "wallets",
] as const;

type DeleteRequest = {
  confirmation?: unknown;
  password?: unknown;
  requestId?: unknown;
};

type JsonBody = Record<string, unknown>;

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("ACCOUNT_DELETION_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const configured = allowedOrigins();
  const allowOrigin =
    origin && configured.has(origin) ? origin : configured.size === 0 ? "*" : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(request: Request, status: number, body: JsonBody): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

function requestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configured = allowedOrigins();
  return !origin || configured.size === 0 || configured.has(origin);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
}

async function auditSubject(userId: string): Promise<string> {
  const salt = Deno.env.get("ACCOUNT_DELETION_AUDIT_SALT") ?? "rasd-account-deletion";
  const input = new TextEncoder().encode(`${salt}:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 20);
}

async function listStorageFiles(
  admin: ReturnType<typeof createClient>,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) files.push(path);
      else files.push(...(await listStorageFiles(admin, path)));
    }

    if (!data || data.length < 1000) break;
    offset += data.length;
  }

  return files;
}

async function deleteStorageFiles(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  const { data: attachmentRows, error: attachmentError } = await admin
    .from("attachments")
    .select("file_path")
    .eq("user_id", userId);
  if (attachmentError) throw attachmentError;

  const metadataPaths = (attachmentRows ?? [])
    .map((row) => row.file_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);
  const discoveredPaths = await listStorageFiles(admin, userId);
  const paths = [...new Set([...metadataPaths, ...discoveredPaths])];

  for (let index = 0; index < paths.length; index += DELETE_BATCH_SIZE) {
    const { error } = await admin.storage
      .from(STORAGE_BUCKET)
      .remove(paths.slice(index, index + DELETE_BATCH_SIZE));
    if (error) throw error;
  }

  return paths.length;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, 405, { error: "method_not_allowed" });
  }
  if (!requestOriginAllowed(request)) {
    return json(request, 403, { error: "origin_not_allowed" });
  }

  const token = bearerToken(request);
  if (!token) return json(request, 401, { error: "missing_authorization" });

  let body: DeleteRequest;
  try {
    body = await request.json();
  } catch {
    return json(request, 400, { error: "invalid_json" });
  }

  if (body.confirmation !== CONFIRMATION_TEXT) {
    return json(request, 400, { error: "confirmation_mismatch" });
  }
  if (!validRequestId(body.requestId)) {
    return json(request, 400, { error: "invalid_request_id" });
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userResult, error: userError } = await authClient.auth.getUser(token);
    const user = userResult.user;
    if (userError || !user) return json(request, 401, { error: "invalid_session" });
    const provider =
      typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "";
    if (provider === "email") {
      if (!user.email || typeof body.password !== "string" || body.password.length < 8) {
        return json(request, 400, { error: "password_required" });
      }

      // Password accounts must prove the password again; possessing a
      // long-lived session token alone is intentionally insufficient.
      const { error: reauthError } = await authClient.auth.signInWithPassword({
        email: user.email,
        password: body.password,
      });
      if (reauthError) return json(request, 403, { error: "reauthentication_failed" });
    } else {
      // OAuth accounts must return from an explicit provider login immediately
      // before deletion. Refreshing an access token does not update this
      // server-maintained Auth timestamp.
      const lastSignInAt = Date.parse(user.last_sign_in_at ?? "");
      const isRecent =
        Number.isFinite(lastSignInAt) &&
        Date.now() - lastSignInAt >= 0 &&
        Date.now() - lastSignInAt <= RECENT_SIGN_IN_WINDOW_MS;
      if (!isRecent) return json(request, 403, { error: "recent_oauth_sign_in_required" });
    }

    const subject = await auditSubject(user.id);
    console.info("account_deletion_started", { requestId: body.requestId, subject });

    const storageFilesDeleted = await deleteStorageFiles(admin, user.id);
    const deletedTables: string[] = [];
    for (const table of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", user.id);
      if (error) throw new Error(`${table}: ${error.message}`);
      deletedTables.push(table);
    }

    const { error: profileError } = await admin.from("profiles").delete().eq("id", user.id);
    if (profileError) throw new Error(`profiles: ${profileError.message}`);

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
    if (authDeleteError) throw new Error(`auth.users: ${authDeleteError.message}`);

    console.info("account_deletion_completed", {
      requestId: body.requestId,
      subject,
      storageFilesDeleted,
      tablesProcessed: deletedTables.length + 1,
    });

    return json(request, 200, {
      deleted: true,
      requestId: body.requestId,
      storageFilesDeleted,
      tablesProcessed: deletedTables.length + 1,
    });
  } catch (error) {
    console.error("account_deletion_failed", {
      requestId: validRequestId(body.requestId) ? body.requestId : "invalid",
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return json(request, 500, { error: "deletion_failed", requestId: body.requestId });
  }
});
