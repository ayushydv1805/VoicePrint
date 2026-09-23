# VoicePrint API

The VoicePrint API is the Node.js/Express backend used by the React safety application.

## Phase 8 production hardening responsibilities

- authenticate requests with Supabase Auth bearer tokens
- keep trusted contacts and SOS records scoped to the authenticated user
- create and persist SOS events
- enforce SOS cooldowns and the 10-second confirmation gate
- protect SOS creation with durable idempotency keys
- throttle server-side location updates
- process optional Twilio trusted-contact SMS delivery
- expose authenticated SOS event details, deliveries and location snapshots
- expose request IDs for troubleshooting
- validate safety-sensitive input at the API and database layers
- expose a configurable RLS posture flag for the client readiness panel

## Run locally

```bash
cd server
npm install
npm run dev
```

Run the regression tests:

```bash
npm test
```

## Environment

Copy `.env.example` to `.env` and configure the server:

```env
PORT=5000
CORS_ORIGINS=https://your-vercel-domain.example

ALERT_COOLDOWN_SECONDS=30
LOCATION_UPDATE_MIN_SECONDS=5
CONFIRMATION_WINDOW_SECONDS=10
SUPABASE_RLS_ENFORCED=false

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

`SUPABASE_RLS_ENFORCED` is an application status flag. It does not enable PostgreSQL RLS by itself.

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

## Phase 8 behavior

### Race-safe lifecycle
The web client tracks each SOS request as an independent asynchronous flow. If the user closes an SOS flow before event creation completes, the resulting event is cancelled as soon as it is created. A later SOS flow cannot accidentally clear the previous flow's cancellation state.

### Durable idempotency
Every SOS creation request requires an `Idempotency-Key` between 8 and 128 characters. The key is stored on `sos_events` and protected by a per-user unique index.

### Cooldown
The server reads the latest persisted SOS event before creating another event. Cooldown behavior therefore survives process restarts.

### Location throttling
The browser can send live coordinates during an active pending event, while the server also enforces the configured minimum interval.

### Confirmation gate
The dispatch endpoint calculates remaining confirmation time from the stored event creation time. Early dispatch attempts return HTTP `409` and `Retry-After`.

### Request tracing
Every response exposes `X-Request-ID`; the same value is included in JSON and structured error logs.

### Security posture
The server reports `securityRlsEnforced` from the `SUPABASE_RLS_ENFORCED` environment flag. This is a reporting mechanism only. PostgreSQL RLS must still be enabled and verified separately.

## SMS delivery

Twilio is used only when all required server variables are configured.

Without Twilio credentials, VoicePrint records that the provider is not configured instead of pretending an SMS was sent.

## Security boundary

The backend filters protected database queries by the authenticated Supabase user ID. Application-level ownership checks are not a substitute for PostgreSQL Row Level Security.

Twilio secrets remain server-side.

## Deployment

Preferred Render start command:

```text
node server/index.js
```

The older `server/index-phase4.js` entrypoint is kept synchronized with the same Phase 7 implementation for compatibility with an existing Render service configuration.