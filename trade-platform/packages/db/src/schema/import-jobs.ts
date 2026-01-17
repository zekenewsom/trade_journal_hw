import { pgTable, text, timestamp, uuid, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";

export const importJobStatusEnum = pgEnum("import_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const importJobTypeEnum = pgEnum("import_job_type", [
  "csv",
  "dex",
]);

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  type: importJobTypeEnum("type").notNull(),
  status: importJobStatusEnum("status").default("pending").notNull(),

  // Job metadata
  totalTransactions: integer("total_transactions").default(0),
  processedTransactions: integer("processed_transactions").default(0),
  importedTransactions: integer("imported_transactions").default(0),
  skippedTransactions: integer("skipped_transactions").default(0),

  // Error tracking
  errorMessage: text("error_message"),
  errors: jsonb("errors").$type<Array<{ index?: number; ticker?: string; error: string }>>(),

  // Additional metadata
  metadata: jsonb("metadata").$type<{
    provider?: string;
    platform?: string;
    walletAddress?: string;
    filename?: string;
  }>(),

  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  organization: one(organizations, {
    fields: [importJobs.orgId],
    references: [organizations.id],
  }),
}));

export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;
