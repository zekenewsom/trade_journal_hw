-- Reset schema by dropping all existing types and tables
-- Run this in Supabase SQL Editor before applying migrations

-- Drop tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "import_sources" CASCADE;
DROP TABLE IF EXISTS "transaction_emotions" CASCADE;
DROP TABLE IF EXISTS "trade_emotions" CASCADE;
DROP TABLE IF EXISTS "emotions" CASCADE;
DROP TABLE IF EXISTS "transactions" CASCADE;
DROP TABLE IF EXISTS "trades" CASCADE;
DROP TABLE IF EXISTS "strategies" CASCADE;
DROP TABLE IF EXISTS "org_members" CASCADE;
DROP TABLE IF EXISTS "organizations" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop drizzle migration tracking table
DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE;

-- Drop types
DROP TYPE IF EXISTS "org_role" CASCADE;
DROP TYPE IF EXISTS "plan" CASCADE;
DROP TYPE IF EXISTS "asset_class" CASCADE;
DROP TYPE IF EXISTS "trade_direction" CASCADE;
DROP TYPE IF EXISTS "trade_outcome" CASCADE;
DROP TYPE IF EXISTS "trade_status" CASCADE;
DROP TYPE IF EXISTS "transaction_action" CASCADE;
DROP TYPE IF EXISTS "import_source_type" CASCADE;
DROP TYPE IF EXISTS "sync_status" CASCADE;
DROP TYPE IF EXISTS "audit_action" CASCADE;
DROP TYPE IF EXISTS "entity_type" CASCADE;
