-- VoicePrint Phase 4 security migration
-- Review and apply this migration in Supabase before storing real user safety data.
-- The runtime backend already filters every query by the authenticated user's id.

alter table public.trusted_contacts enable row level security;
alter table public.sos_events enable row level security;
alter table public.sos_event_locations enable row level security;
alter table public.sos_event_deliveries enable row level security;

drop policy if exists contacts_select_own on public.trusted_contacts;
drop policy if exists contacts_insert_own on public.trusted_contacts;
drop policy if exists contacts_update_own on public.trusted_contacts;
drop policy if exists contacts_delete_own on public.trusted_contacts;
create policy contacts_select_own on public.trusted_contacts for select to authenticated using (user_id = auth.uid());
create policy contacts_insert_own on public.trusted_contacts for insert to authenticated with check (user_id = auth.uid());
create policy contacts_update_own on public.trusted_contacts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy contacts_delete_own on public.trusted_contacts for delete to authenticated using (user_id = auth.uid());

drop policy if exists events_select_own on public.sos_events;
drop policy if exists events_insert_own on public.sos_events;
drop policy if exists events_update_own on public.sos_events;
create policy events_select_own on public.sos_events for select to authenticated using (user_id = auth.uid());
create policy events_insert_own on public.sos_events for insert to authenticated with check (user_id = auth.uid());
create policy events_update_own on public.sos_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists locations_select_own on public.sos_event_locations;
drop policy if exists locations_insert_own on public.sos_event_locations;
create policy locations_select_own on public.sos_event_locations for select to authenticated using (user_id = auth.uid());
create policy locations_insert_own on public.sos_event_locations for insert to authenticated with check (user_id = auth.uid());

drop policy if exists deliveries_select_own on public.sos_event_deliveries;
drop policy if exists deliveries_insert_own on public.sos_event_deliveries;
drop policy if exists deliveries_update_own on public.sos_event_deliveries;
create policy deliveries_select_own on public.sos_event_deliveries for select to authenticated using (user_id = auth.uid());
create policy deliveries_insert_own on public.sos_event_deliveries for insert to authenticated with check (user_id = auth.uid());
create policy deliveries_update_own on public.sos_event_deliveries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.trusted_contacts to authenticated;
grant select, insert, update on public.sos_events to authenticated;
grant select, insert on public.sos_event_locations to authenticated;
grant select, insert, update on public.sos_event_deliveries to authenticated;
