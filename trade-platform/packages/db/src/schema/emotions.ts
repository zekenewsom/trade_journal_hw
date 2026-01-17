import { pgTable, text, timestamp, uuid, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { transactions } from "./transactions";
import { trades } from "./trades";

export const emotions = pgTable("emotions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tradeEmotions = pgTable(
  "trade_emotions",
  {
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    emotionId: uuid("emotion_id")
      .notNull()
      .references(() => emotions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tradeId, table.emotionId] }),
  })
);

export const transactionEmotions = pgTable(
  "transaction_emotions",
  {
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    emotionId: uuid("emotion_id")
      .notNull()
      .references(() => emotions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.transactionId, table.emotionId] }),
  })
);

export const emotionsRelations = relations(emotions, ({ many }) => ({
  tradeEmotions: many(tradeEmotions),
  transactionEmotions: many(transactionEmotions),
}));

export const tradeEmotionsRelations = relations(tradeEmotions, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeEmotions.tradeId],
    references: [trades.id],
  }),
  emotion: one(emotions, {
    fields: [tradeEmotions.emotionId],
    references: [emotions.id],
  }),
}));

export const transactionEmotionsRelations = relations(
  transactionEmotions,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionEmotions.transactionId],
      references: [transactions.id],
    }),
    emotion: one(emotions, {
      fields: [transactionEmotions.emotionId],
      references: [emotions.id],
    }),
  })
);

export type Emotion = typeof emotions.$inferSelect;
export type NewEmotion = typeof emotions.$inferInsert;
