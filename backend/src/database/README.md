# Backend Database Layer

Database connection, migration, and seed management for Supabase.

## Key Files

| File | Purpose |
|------|---------|
| `connection.ts` | Supabase client initialization (`getSupabase()`) |
| `migrate.ts` | Migration runner |
| `seed.ts` | Database seeding |
| `reset.ts` | Database reset utility |

## Subdirectories

Contains migration SQL files, seed data, and database utilities.

## Commands

```bash
npm run migrate   # Run pending migrations
npm run seed      # Seed the database  
npm run db:reset  # Reset the database
```
