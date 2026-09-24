-- VoicePrint Phase 12 diagnostics
-- No new tables or privileged database operations are required for the safety drill.
-- This migration exists as a release checkpoint for the Phase 12 database contract.

comment on table public.sos_events is 'VoicePrint SOS events. Phase 12 verified via read-only safety drill.';
