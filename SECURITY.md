# VoicePrint Security Notes

VoicePrint stores safety-sensitive information such as trusted contact details and location history.

## Required production controls

1. Enable PostgreSQL Row Level Security (RLS) on every public safety table.
2. Verify policies restrict rows to the authenticated user's `auth.uid()`.
3. Keep Twilio credentials exclusively on the backend.
4. Use a publishable/client-safe Supabase key in the browser.
5. Review authentication/session storage and consider an HttpOnly-cookie architecture for a hardened deployment.
6. Configure monitoring, secret rotation and a clear data retention/deletion policy.

## RLS migration

The repository contains:

`supabase/migrations/phase_4_rls.sql`

The current Supabase project has the four core safety tables with RLS **disabled**. This is a known security blocker for real-world sensitive-data use.

The RLS migration is intentionally kept as a reviewed migration rather than silently enabling policies during application deployment. Apply and verify it in the Supabase dashboard/SQL environment before production use.

## Emergency-service boundary

VoicePrint does not directly dispatch police, ambulance or another public emergency responder.

The `tel:112` control only attempts to open the device dialer. Trusted-contact SMS, when configured, is a separate notification path.

## Reporting

Do not include secrets, access tokens, private contact data or precise personal location in public issues.

For security-sensitive problems, report them privately through the repository owner's preferred private channel.