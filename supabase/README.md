# Supabase Setup

## Migrations

- **Migrations must be run manually** in the [Supabase SQL Editor](https://supabase.com/dashboard).
- **Supabase CLI is not used** in this project yet.

### Run migrations in order

1. Open Supabase Dashboard → your project
2. Go to **SQL Editor**
3. Run migrations in order: `20250203000001_create_expenses.sql`, then `20250204000001_create_groups_and_profiles.sql`
4. If you see "infinite recursion" on group_members, run `20250204000002_fix_group_members_rls_recursion.sql`
