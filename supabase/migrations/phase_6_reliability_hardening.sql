-- VoicePrint Phase 6 reliability hardening
-- Applied to Supabase as migration: phase_6_reliability_hardening

alter table public.sos_events
  add column if not exists idempotency_key text;

create unique index if not exists sos_events_user_idempotency_unique
  on public.sos_events (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists sos_events_user_status_created_idx
  on public.sos_events (user_id, status, created_at desc);

create index if not exists sos_event_deliveries_user_event_status_idx
  on public.sos_event_deliveries (user_id, event_id, status);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sos_events_idempotency_key_length'
  ) then
    alter table public.sos_events
      add constraint sos_events_idempotency_key_length
      check (idempotency_key is null or char_length(idempotency_key) between 8 and 128);
  end if;
end $$;
