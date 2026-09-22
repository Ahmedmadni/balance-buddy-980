# A12 — Release hardening

Verified on 2026-09-22 against the current repository state.

## Release gates

- The full repository lint command runs in CI. Legacy `any` and React-hook findings remain visible as warnings; lint has zero errors.
- Unit tests, TypeScript typecheck, production build, and the production dependency audit run in CI.
- Database regressions rebuild a disposable local Supabase instance from migrations and run inside rollback-only transactions.
- The database security regression verifies RLS on every public table, protected RPC grants, derived-transaction immutability, and internal trigger-function grants.
- The known production Supabase project reference is rejected by the database-test runner. Remote test databases additionally require an explicit non-production confirmation.

## Dependency audit

- `npm audit --omit=dev --audit-level=moderate`: zero production vulnerabilities.
- SheetJS was upgraded from the stale npm package to the official `xlsx` 0.20.3 distribution.
- `@capacitor/cli` is a pinned development dependency and is not part of the production dependency set.
- `bun audit` still reports 15 development-only advisories through `@capacitor/assets`/`@capacitor/cli` (`sharp`, `tar`, and `uuid`): 1 critical, 10 high, and 4 moderate. No compatible upgrade currently resolves the set completely. These tools do not ship in the application runtime.

## Supabase safety

- No production database was contacted or modified during A12.
- No RLS policy or database permission was weakened.
- The service-role credential remains a server-only environment value. The tracked client environment contains no service-role variable.
- A12 adds no migration. Nothing from this phase needs to be pasted into the production SQL editor.

## Remaining operational controls

- Run the CI workflow on every pull request and on `main`.
- Configure GitHub branch protection/rulesets for `main` in repository settings if administrative policy permits it; require the application and database jobs before merging.
- Monitor `@capacitor/assets` and `@capacitor/cli` for releases that resolve their development-tool advisories, then rerun both audits and update the static in-app audit date.
