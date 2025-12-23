# Archived Migration Scripts

These scripts were used during the SQLite to Supabase migration (completed December 2025).

They are kept for historical reference only and should NOT be used in production.

## Archived Scripts

- `migrate-to-supabase.js` - Main migration orchestrator
- `verify-migration.js` - Migration verification (SQLite vs Supabase comparison)
- `verify-data-consistency.js` - Data consistency checker

## Why Archived?

The migration from SQLite to Supabase is 100% complete:
- All services use `SupabaseService` directly
- The `server/database.js` compatibility layer was removed
- SQLite is no longer used in the project

These scripts require SQLite which is no longer a dependency.
