import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { trades } from "./trades";
import { strategies } from "./strategies";

export const transactionActionEnum = pgEnum("transaction_action", ["buy", "sell"]);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),

    // Core transaction data
    action: transactionActionEnum("action").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    price: numeric("price", { precision: 20, scale: 8 }).notNull(),
    datetime: timestamp("datetime").notNull(),
    fees: numeric("fees", { precision: 20, scale: 8 }).default("0"),
    notes: text("notes"),

    // Per-transaction metadata (optional, can override trade-level)
    strategyId: uuid("strategy_id").references(() => strategies.id),
    marketConditions: text("market_conditions"),
    setupDescription: text("setup_description"),
    reasoning: text("reasoning"),
    lessonsLearned: text("lessons_learned"),
    rMultipleInitialRisk: numeric("r_multiple_initial_risk", {
      precision: 20,
      scale: 8,
    }),

    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tradeIdIdx: index("transactions_trade_id_idx").on(table.tradeId),
    datetimeIdx: index("transactions_datetime_idx").on(table.datetime),
  })
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  trade: one(trades, {
    fields: [transactions.tradeId],
    references: [trades.id],
  }),
  strategy: one(strategies, {
    fields: [transactions.strategyId],
    references: [strategies.id],
  }),
}));

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
