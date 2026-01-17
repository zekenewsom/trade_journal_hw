import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public"],
  tablesFilter: [
    "users",
    "organizations",
    "org_members",
    "trades",
    "transactions",
    "emotions",
    "trade_emotions",
    "strategies",
    "import_sources",
    "audit_logs",
  ],
});
