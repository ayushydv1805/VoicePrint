-- VoicePrint Phase 5 database hardening
-- Applied to Supabase as migration: phase_5_hardening

create unique index if not exists trusted_contacts_user_phone_unique
on public.trusted_contacts (user_id, phone_e164);

create index if not exists sos_events_user_created_idx
on public.sos_events (user_id, created_at desc);

create index if not exists sos_event_locations_event_captured_idx
on public.sos_event_locations (event_id, captured_at desc);

create index if not exists sos_event_deliveries_event_idx
on public.sos_event_deliveries (event_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trusted_contacts_phone_e164_format'
  ) then
    alter table public.trusted_contacts
      add constraint trusted_contacts_phone_e164_format
      check (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sos_events_source_allowed'
  ) then
    alter table public.sos_events
      add constraint sos_events_source_allowed
      check (source in ('manual','three-clap'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sos_events_status_allowed'
  ) then
    alter table public.sos_events
      add constraint sos_events_status_allowed
      check (status in ('pending','dispatched','cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sos_events_latitude_range'
  ) then
    alter table public.sos_events
      add constraint sos_events_latitude_range
      check (latitude is null or latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sos_events_longitude_range'
  ) then
    alter table public.sos_events
      add constraint sos_events_longitude_range
      check (longitude is null or longitude between -180 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sos_event_locations_latitude_range'
  ) then
    alter table public.sos_event_locations
      add constraint sos_event_locations_latitude_range
      check (latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sos_event_locations_longitude_range'
  ) then
    alter table public.sos_event_locations
      add constraint sos_event_locations_longitude_range
      check (longitude between -180 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sos_event_deliveries_status_allowed'
  ) then
    alter table public.sos_event_deliveries
      add constraint sos_event_deliveries_status_allowed
      check (status in ('pending','sent','failed'));
  end if;
end $$;

create or replace function public.set_voiceprint_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trusted_contacts_updated_at on public.trusted_contacts;
create trigger trusted_contacts_updated_at
before update on public.trusted_contacts
for each row execute function public.set_voiceprint_updated_at();

drop trigger if exists sos_events_updated_at on public.sos_events;
create trigger sos_events_updated_at
before update on public.sos_events
for each row execute function public.set_voiceprint_updated_at();
