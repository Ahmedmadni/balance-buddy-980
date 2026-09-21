# A11 automated regression suite

## Architecture discovered on `main`

- Application tests use Bun's built-in `bun:test` runner. There is no Vitest/Jest configuration.
- Database tests are transaction-scoped SQL scripts under `supabase/tests`; they use `DO` assertions and always roll back.
- `supabase/config.toml` contains the linked project id, while CI creates a disposable local Supabase stack and rebuilds it exclusively from checked-in migrations.
- There was no GitHub Actions workflow before A11.
- The original A11 inspection found that A03-A05, A06, and A09-A10 existed in production but were absent from the checked-in migration history. The audited production definitions are now captured by the schema-parity migrations dated `20260902` and `20260903`, so a fresh local database can reproduce those objects without querying or modifying production.

## Commands

```bash
bun install --frozen-lockfile
bun run test:unit
bun run typecheck
bun run lint
bun run build
```

Database tests require `psql` and a disposable database with the current schema:

```bash
RASD_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bun run test:db
```

Remote database targets are refused unless `RASD_CONFIRM_NON_PRODUCTION=1` is also set. The known production project ref is always refused. Every SQL test must contain both `BEGIN` and `ROLLBACK`.

The GitHub Actions database job is always enabled. It runs `supabase start`, rebuilds the local schema with `supabase db reset --local`, and then runs every rollback-only SQL suite against `127.0.0.1`. It does not link to or contact the production database.

## Coverage

- A01: all four ledger directions, wallet mirror integrity, atomic updates/deletes, and duplicate prevention.
- A02: wallet and non-wallet transactions, mirror reconciliation, sale state, deletion, and duplicate prevention.
- A03: reciprocal transfer sides, atomic update/delete, same-wallet rejection, and currency rejection.
- A04: read-only derived table privileges and source insert/update/delete synchronization.
- A05/A10: composite ownership boundaries plus representative SET NULL and CASCADE behavior.
- A07/A08: Bun unit regressions for explicit zero valuations and completed-sale semantics.
- A09: duplicate valuation-date and depreciation-profile rejection.
- A06: backup v2 export/restore round-trip, identity stripping, derived-transaction exclusion/rebuild, profile restoration, and unsafe payload rejection on the disposable local database.
