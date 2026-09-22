# VoicePrint API

The VoicePrint API is the Node.js/Express backend used by the React safety application.

## Responsibilities

- authenticate requests with Supabase Auth bearer tokens
- keep trusted contacts scoped to the authenticated user
- create and persist SOS events
- snapshot and update live location
- enforce SOS cooldowns
- enforce the 10-second server-side confirmation gate
- protect SOS creation with durable per-user idempotency keys
- throttle server-side location updates
- process optional Twilio trusted-contact SMS delivery
- expose authenticated SOS event details and delivery/location records
- expose health and service-readiness endpoints
- attach request IDs to responses and operational logs
- apply Helmet, CORS and API/SOS rate limiting
- validate phone numbers, coordinates and event state transitions

## Run locally

```bash
cd server
npm install
npm run dev
```

The default API port is `5000`.

## Environment

Copy `.env.example` to `.env` and configure the server:

```env
PORT=5000
CORS_ORIGINS=https://your-vercel-domain.example

ALERT_COOLDOWN_SECONDS=30
LOCATION_UPDATE_MIN_SECONDS=5
CONFIRMATION_WINDOW_SECONDS=10

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

Twilio values are optional and must remain server-side secrets.

## Endpoints

### Public

```http
GET /api/health
GET /api/v1/status
```

### Authenticated

```http
GET    /api/v1/contacts
POST   /api/v1/contacts
DELETE /api/v1/contacts/:id

GET    /api/v1/history
GET    /api/v1/sos/events/:id

POST   /api/v1/sos/events
POST   /api/v1/sos/events/:id/location
POST   /api/v1/sos/events/:id/dispatch
POST   /api/v1/sos/events/:id/cancel
```

## Reliability behavior

### Idempotency

Every SOS creation request requires an `Idempotency-Key` header between 8 and 128 characters.

The key is stored on `sos_events` and protected by a unique index over `(user_id, idempotency_key)`. A repeated request can return the original event instead of creating another SOS.

### Cooldown

The server reads the most recent SOS event from the database before creating another one. This keeps the cooldown behavior consistent across server restarts.

### Location throttling

The browser may send location updates during an active SOS, but the server enforces `LOCATION_UPDATE_MIN_SECONDS` using the persisted event timestamp.

### Confirmation gate

The backend calculates the confirmation window from the stored event creation time. Calling `/dispatch` before the gate expires returns HTTP `409` with `Retry-After`.

### Request tracing

Every response includes `X-Request-ID`. The same identifier is included in JSON responses and structured server error logs.

## SMS delivery

Twilio is used only when all required server variables are configured.

The SMS contains:
- VoicePrint SOS trigger source
- latest known coordinates when available
- a Google Maps link
- a notice that trusted-contact alerting is not public emergency dispatch

Without Twilio credentials, the event is still persisted and the delivery state reports that the provider is not configured.

## Security boundary

The backend filters every protected database query by the authenticated Supabase user ID.

This application-level ownership check is not a substitute for PostgreSQL Row Level Security. RLS should be enabled and tested before real sensitive safety data is used in production.

The backend never requires Twilio secrets in browser code.

## Deployment

The Render service can start the backend with:

```text
node server/index.js
```

An older Render configuration may still reference `server/index-phase4.js`; that entrypoint is intentionally kept aligned with the Phase 6 backend so it cannot silently deploy stale behavior.