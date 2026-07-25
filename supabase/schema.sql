-- Gravity: Supabase Schema (No Auth Required)
-- Paste this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qzbgnchfgiaacbyjvnat/sql/new

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS orbits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now(),
  entry_count INTEGER DEFAULT 0,
  parent_orbit_id UUID REFERENCES orbits(id) ON DELETE SET NULL,
  is_user_created BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'classified', 'unclassified')),
  orbit_id UUID REFERENCES orbits(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  entry_count INTEGER DEFAULT 0,
  total_words INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('date', 'deadline', 'commitment', 'intention', 'resurface')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_date TIMESTAMPTZ,
  detected_date TEXT,
  orbit_id UUID REFERENCES orbits(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'shown', 'dismissed', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orbits_user ON orbits(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_orbit ON entries(orbit_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_status ON entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_status ON reminders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reminders_entry ON reminders(entry_id);

-- Disable RLS (anonymous access via anon key)
ALTER TABLE orbits DISABLE ROW LEVEL SECURITY;
ALTER TABLE entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;
