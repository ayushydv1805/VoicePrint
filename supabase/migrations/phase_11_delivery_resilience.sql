-- VoicePrint Phase 11 delivery resilience
-- Adds bounded retry audit metadata to trusted-contact delivery rows.

alter table public.sos_event_deliveries
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz;

alter table public.sos_event_deliveries
  drop constraint if exists sos_event_deliveries_attempt_count_check;

alter table public.sos_event_deliveries
  add constraint sos_event_deliveries_attempt_count_check
  check (attempt_count >= 0 and attempt_count <= 3);

create index if not exists sos_event_deliveries_event_status_idx
  on public.sos_event_deliveries(event_id, status);

create index if not exists sos_event_deliveries_retry_idx
  on public.sos_event_deliveries(user_id, status, next_retry_at);
