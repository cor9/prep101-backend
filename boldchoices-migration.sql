-- ============================================================
-- BoldChoices Supabase Migration
-- Run this in the Supabase SQL editor:
--   https://app.supabase.com/project/eokqyijxubrmompozguh/sql/new
-- ============================================================

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Daily usage tracking (replaces in-memory freeUserLimits) ──────────────
CREATE TABLE IF NOT EXISTS boldchoices_usage (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    text NOT NULL,
  date       text NOT NULL,   -- YYYY-MM-DD
  count      int  NOT NULL DEFAULT 1,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_boldchoices_usage_user_date
  ON boldchoices_usage(user_id, date);

-- ── 2. Generation store (audit trail + spin-aware context) ───────────────────
CREATE TABLE IF NOT EXISTS boldchoices_generations (
  id              uuid PRIMARY KEY,
  user_id         text NOT NULL,
  character_name  text,
  show            text,
  modifier        text,         -- null | 'wilder' | 'take2' | 'spin'
  is_preview      boolean DEFAULT false,
  output_json     text,         -- stringified JSON
  prompt_summary  text,         -- stringified JSON
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boldchoices_generations_user
  ON boldchoices_generations(user_id, created_at DESC);

-- ── 3. Saved choices (durable playbook) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS boldchoices_saved (
  id              uuid PRIMARY KEY,
  user_id         text NOT NULL,
  choice_text     text NOT NULL,
  character_name  text,
  show            text,
  generation_id   uuid REFERENCES boldchoices_generations(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boldchoices_saved_user
  ON boldchoices_saved(user_id, created_at DESC);

-- ── 4. Analytics events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boldchoices_events (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  event      text NOT NULL,    -- 'generated' | 'spin_clicked' | 'wilder_clicked' | 'take2_clicked' | 'upgrade_clicked' | 'upgrade_completed' | 'choice_saved'
  user_id    text,
  meta       text,             -- stringified JSON
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boldchoices_events_event
  ON boldchoices_events(event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_boldchoices_events_user
  ON boldchoices_events(user_id, created_at DESC);

-- ── Row Level Security (optional — service role bypasses RLS) ─────────────────
-- ALTER TABLE boldchoices_usage ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE boldchoices_generations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE boldchoices_saved ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE boldchoices_events ENABLE ROW LEVEL SECURITY;

-- ── Done ──────────────────────────────────────────────────────────────────────
SELECT 'BoldChoices migration complete ✅' AS status;
