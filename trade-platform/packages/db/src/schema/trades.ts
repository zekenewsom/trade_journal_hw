import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { strategies } from "./strategies";
import { importSources } from "./import-sources";

export const assetClassEnum = pgEnum("asset_class", [
  "stock",
  "cryptocurrency",
  "forex",
  "futures",
  "options",
  "prediction_market",
]);

export const tradeDirectionEnum = pgEnum("trade_direction", ["long", "short"]);
export const tradeStatusEnum = pgEnum("trade_status", ["open", "closed"]);
export const tradeOutcomeEnum = pgEnum("trade_outcome", ["win", "loss", "break_even"]);

// New enums for institutional-grade trade review
export const thesisValidationEnum = pgEnum("thesis_validation", ["correct", "partial", "incorrect"]);
export const planAdherenceEnum = pgEnum("plan_adherence", ["high", "medium", "low"]);

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Instrument details
    instrumentTicker: text("instrument_ticker").notNull(),
    assetClass: assetClassEnum("asset_class").notNull(),
    exchange: text("exchange"),

    // Trade state
    tradeDirection: tradeDirectionEnum("trade_direction").notNull(),
    status: tradeStatusEnum("status").default("open").notNull(),
    outcome: tradeOutcomeEnum("outcome"),

    // Timestamps
    openDatetime: timestamp("open_datetime"),
    closeDatetime: timestamp("close_datetime"),

    // Calculated values (stored for performance)
    feesTotal: numeric("fees_total", { precision: 20, scale: 8 }).default("0"),
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 }),
    unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 8 }),
    currentOpenQuantity: numeric("current_open_quantity", {
      precision: 20,
      scale: 8,
    }),
    averageOpenPrice: numeric("average_open_price", { precision: 20, scale: 8 }),
    currentMarketPrice: numeric("current_market_price", {
      precision: 20,
      scale: 8,
    }),

    // Strategy and metadata
    strategyId: uuid("strategy_id").references(() => strategies.id),
    marketConditions: text("market_conditions"),
    setupDescription: text("setup_description"),
    reasoning: text("reasoning"),
    lessonsLearned: text("lessons_learned"),
    rMultipleInitialRisk: numeric("r_multiple_initial_risk", {
      precision: 20,
      scale: 8,
    }),
    rMultipleActual: numeric("r_multiple_actual", { precision: 20, scale: 8 }),
    durationMs: integer("duration_ms"),

    // Institutional-grade trade review fields
    thesisValidation: thesisValidationEnum("thesis_validation"),
    planAdherence: planAdherenceEnum("plan_adherence"),
    planAdherenceNotes: text("plan_adherence_notes"),
    unforeseenEvents: text("unforeseen_events"),
    overallRating: integer("overall_rating"), // 1-5 scale
    outcomeOverride: tradeOutcomeEnum("outcome_override"), // allows trader to override system outcome
    keyLesson1: text("key_lesson_1"),
    keyLesson2: text("key_lesson_2"),
    keyLesson3: text("key_lesson_3"),

    // Quantitative metrics (system-calculated)
    returnOnAllocatedCapital: numeric("return_on_allocated_capital", { precision: 20, scale: 8 }),
    maxCapitalUsed: numeric("max_capital_used", { precision: 20, scale: 8 }),
    decisionPrice: numeric("decision_price", { precision: 20, scale: 8 }), // user input for slippage calc
    implementationShortfall: numeric("implementation_shortfall", { precision: 20, scale: 8 }),

    // Import tracking
    importSourceId: uuid("import_source_id").references(() => importSources.id),
    externalId: text("external_id"),

    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("trades_org_id_idx").on(table.orgId),
    tickerIdx: index("trades_ticker_idx").on(table.instrumentTicker),
    statusIdx: index("trades_status_idx").on(table.status),
    openDatetimeIdx: index("trades_open_datetime_idx").on(table.openDatetime),
    assetClassIdx: index("trades_asset_class_idx").on(table.assetClass),
  })
);

export const tradesRelations = relations(trades, ({ one }) => ({
  organization: one(organizations, {
    fields: [trades.orgId],
    references: [organizations.id],
  }),
  strategy: one(strategies, {
    fields: [trades.strategyId],
    references: [strategies.id],
  }),
  importSource: one(importSources, {
    fields: [trades.importSourceId],
    references: [importSources.id],
  }),
}));

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
