CREATE TYPE "public"."import_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_job_type" AS ENUM('csv', 'dex');--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" text NOT NULL,
	"type" "import_job_type" NOT NULL,
	"status" "import_job_status" DEFAULT 'pending' NOT NULL,
	"total_transactions" integer DEFAULT 0,
	"processed_transactions" integer DEFAULT 0,
	"imported_transactions" integer DEFAULT 0,
	"skipped_transactions" integer DEFAULT 0,
	"error_message" text,
	"errors" jsonb,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;