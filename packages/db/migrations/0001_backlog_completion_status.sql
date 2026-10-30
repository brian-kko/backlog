ALTER TABLE "user_backlog"
  ADD COLUMN IF NOT EXISTS "completion_status" text NOT NULL DEFAULT 'backlog';
