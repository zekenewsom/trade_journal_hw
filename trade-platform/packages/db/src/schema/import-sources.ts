import { pgTable, text, timestamp, uuid, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";

export const importSourceTypeEnum = pgEnum("import_source_type", [
  "manual",
  "csv",
  "excel",
  "hyperliquid",
  "polymarket",
  "kalshi",
  "binance",
  "coinbase",
  "etrade",
  "schwab",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "idle",
  "syncing",
  "success",
  "error",
]);

export const importSources = pgTable("import_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  type: importSourceTypeEnum("type").notNull(),
  name: text("name").notNull(),
  // Encrypted credentials stored as JSON
  credentials: jsonb("credentials"),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: syncStatusEnum("sync_status").default("idle"),
  syncErrorMessage: text("sync_error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const importSourcesRelations = relations(importSources, ({ one }) => ({
  organization: one(organizations, {
    fields: [importSources.orgId],
    references: [organizations.id],
  }),
}));

export type ImportSource = typeof importSources.$inferSelect;
export type NewImportSource = typeof importSources.$inferInsert;
