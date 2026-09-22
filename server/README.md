# VoicePrint Phase 3 API

Phase 3 adds a small Node/Express backend for:

- creating an SOS event with source + location
- a visible 10-second confirmation window before remote dispatch
- live location updates while the SOS flow is open
- trusted-contact SMS delivery through Twilio when server credentials are configured
- cancellation before dispatch
- rate limiting, Helmet security headers, strict CORS, payload validation, idempotency, and server-side event ownership checks

## Run locally

```bash
cd server
npm install
npm run dev
```

The frontend defaults to `https://voiceprint-api.onrender.com`. Set `VITE_API_URL` in the frontend environment when using a different API URL.

## SMS setup

Do not put Twilio credentials in React/Vite code.

Set these variables only on the backend host:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Contacts must be supplied in E.164 format, for example `+919876543210`.

Without those secrets, the API stays in safe dry mode and reports that no SMS was sent.

## Important prototype boundary

This backend is not an emergency-service dispatch system. It does not contact police, ambulance, 112, or any public-safety agency. Production deployment needs stronger device authentication, durable storage, audit logging, secret rotation, monitoring, provider delivery webhooks, and an approved responder integration.
