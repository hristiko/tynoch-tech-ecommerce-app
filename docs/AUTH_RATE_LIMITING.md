# Login and registration request limits

The application limits repeated sign-in and registration attempts so a single client cannot submit unlimited requests to the authentication endpoints. Counts are stored in DynamoDB rather than in a JavaScript variable, which lets concurrent Next.js requests share the same limits.

## Current limits

| Request | Counted by | Maximum | Period |
| --- | --- | ---: | --- |
| Sign-in | Email address | 10 attempts | 15 minutes |
| Sign-in | Client | 60 attempts | 15 minutes |
| Registration | Email address | 3 attempts | 60 minutes |
| Registration | Client | 10 attempts | 60 minutes |

Successful attempts count too. A request is blocked when **either** its email counter or client counter has reached the limit. The windows have fixed boundaries, so attempts near the end of one window and the start of another can produce a short burst. Someone repeatedly trying an email address can also temporarily block its legitimate owner.

## How the counters work

Each counter uses a key similar to `RATE#scope#sha256(identifier)` and `WINDOW#number`. An atomic conditional DynamoDB update increments the count only when it is below the limit. Records also contain `expiresAt` for eventual cleanup. Enforcement does **not** depend on DynamoDB deleting expired records: a new period has a different sort key.

When using hosted DynamoDB, TTL cleanup may be enabled for the `expiresAt` attribute. Check the table's existing TTL configuration first. DynamoDB Local may retain expired counter records without affecting the limits.

## Identifying the client

For local development, leave `AUTH_TRUST_PROXY=false`. All visitors then share one client counter. That is restrictive, but it avoids trusting IP addresses that a requester could forge in forwarded headers.

For a public deployment, `AUTH_TRUST_PROXY=true` is suitable **only** when a trusted reverse proxy strips or overwrites incoming `X-Forwarded-For` and `X-Real-IP` headers. Without that protection, a requester could rotate fake IPs and bypass per-client limits.

## Testing

With DynamoDB Local running, execute:

```powershell
npx tsx scripts/check-auth-rate-limit.ts
npm test
```

The integration script sends 12 concurrent attempts to a temporary counter limited to three. The expected result is three accepted, nine blocked, and a new attempt accepted in the next window. It removes the records it created.

Registration can return HTTP `429` with `Retry-After`. NextAuth handles the login callback itself, so a blocked login is not guaranteed to return HTTP `429`; the UI handles the provider's error flow instead.

These limits are useful for this local project but don't replace email verification, monitoring or further anti-abuse controls needed for a public service.
