CREATE TABLE IF NOT EXISTS "price_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "steam_app_id" integer NOT NULL,
  "store_id" text NOT NULL,
  "price" numeric(10, 2) NOT NULL,
  "regular_price" numeric(10, 2) NOT NULL,
  "source" text NOT NULL,
  "observed_on" date NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "price_snapshots_source_check" CHECK ("source" IN ('cheapshark', 'steam'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "price_snapshots_app_store_day_idx"
  ON "price_snapshots" ("steam_app_id", "store_id", "observed_on");
