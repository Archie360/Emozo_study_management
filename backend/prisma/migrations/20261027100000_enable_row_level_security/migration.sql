-- Closes a real gap: Supabase auto-generates a REST API (PostgREST) over
-- every table in the public schema regardless of application code. With RLS
-- off, anyone holding the project's anon key could read/write these tables
-- directly, bypassing this app's JWT auth entirely.
--
-- No FORCE, no policies needed: Prisma connects as the `postgres` role,
-- which owns every table here (it ran these migrations), and Postgres
-- exempts a table's owner from RLS by default. So this is transparent to
-- the app — only non-owner roles (PostgREST's anon/authenticated) are
-- affected, and with zero policies defined they're denied by default.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_type_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_date_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

-- Prisma's own migration-history table — same exposure, same fix.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
