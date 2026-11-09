ALTER TABLE "user_backlog"
  ADD COLUMN IF NOT EXISTS "purchase_store" text,
  ADD COLUMN IF NOT EXISTS "platform" text;
