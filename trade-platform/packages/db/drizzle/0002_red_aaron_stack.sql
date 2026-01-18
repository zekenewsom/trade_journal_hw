CREATE TYPE "public"."plan_adherence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."thesis_validation" AS ENUM('correct', 'partial', 'incorrect');--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "thesis_validation" "thesis_validation";--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "plan_adherence" "plan_adherence";--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "plan_adherence_notes" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "unforeseen_events" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "overall_rating" integer;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "outcome_override" "trade_outcome";--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "key_lesson_1" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "key_lesson_2" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "key_lesson_3" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "return_on_allocated_capital" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "max_capital_used" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "decision_price" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "implementation_shortfall" numeric(20, 8);