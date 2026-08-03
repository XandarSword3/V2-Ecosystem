-- 20260613000000_capacity_windows_timestamptz.sql
-- Upgrade capacity_windows: TIME → TIMESTAMPTZ + personal_duration_minutes
--
-- Changes:
--   start_time TIME  → starts_at TIMESTAMPTZ        enables midnight-spanning sessions
--                                                    (e.g. 24-hour day pass, cinema slot)
--   end_time TIME    → ends_at TIMESTAMPTZ           same
--   + personal_duration_minutes INTEGER NULL         when set: each ticket-holder gets exactly
--                                                    this many minutes from their individual
--                                                    check-in time instead of the session ends_at.
--                                                    NULL = all holders share the session window.
--
-- Safe: capacity_windows has no live data.

ALTER TABLE capacity_windows
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  ADD COLUMN starts_at                 TIMESTAMPTZ,
  ADD COLUMN ends_at                   TIMESTAMPTZ,
  ADD COLUMN personal_duration_minutes INTEGER;
