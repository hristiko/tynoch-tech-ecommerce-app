# Authentication request limits

This protects local demo registration and credentials sign-in against repeated requests. It uses conditional DynamoDB `UpdateItem` operations instead of in-memory counters, so concurrent requests from several Next.js workers share the limits.

## Limits

| Operation | Counter | Allowance | Window |
| --- | --- | --- | --- |
| Credentials sign-in | Normalized email address | 10 attempts | 15 minutes |
| Credentials sign-in | Client identity | 60 attempts | 15 minutes |
| Account registration | Normalized email address | 3 attempts | 60 minutes |
| Account registration | Client identity | 10 attempts | 60 minutes |

All requests count, including successful requests, rather than tracking failed passwords only. Client and email counters are independent; either can block a request. Limits are fixed windows, so short bursts across a window boundary can exceed the nominal limit. A heavily targeted email account can also be temporarily blocked by someone else attempting its password. These are acceptable trade-offs for the current internship demonstration, not a complete bot-protection strategy for public deployment.

## Client identity and reverse proxies

By default (`AUTH_TRUST_PROXY` unset or `false`), the client-specific counters use one shared key for **all** visitors. This is safe from spoofed `X-Forwarded-For` headers, but deliberately restrictive: after 10 registrations within one hour, all users must wait for the next window. It works well for a small local demo. Email quotas still apply independently.

For a **public server behind a trusted reverse proxy that strips or overwrites incoming forwarding headers**, set `AUTH_TRUST_PROXY=true`. The limiter then uses the first validated IP in `X-Forwarded-For` (or `X-Real-IP`). **Never enable this with an untrusted forwarding chain:** a client could forge IP headers and bypass the per-client quota. This mode depends on correct proxy configuration; it does not independently authenticate the source IP.

## DynamoDB records and TTL

The existing `PK`/`SK` table is reused. Keys have the shape `RATE#<scope>#<sha256(identifier)>` / `WINDOW#<window-number>`. No raw email address or IP appears in keys. Each record stores an `attempts` number and an `expiresAt` Unix timestamp. The conditional update increments at most to the limit, atomically rejecting later requests. A new window uses a new sort key, so **expiration of the limit never relies on TTL deletion**.

For storage cleanup on a hosted AWS DynamoDB table, enable TTL for the `expiresAt` attribute. For example, with an appropriately authenticated AWS CLI:

```sh
aws dynamodb update-time-to-live --table-name tidewell-store --time-to-live-specification 'Enabled=true,AttributeName=expiresAt'
```

Check existing TTL configuration first if the table is shared with other apps. On DynamoDB Local, TTL cleanup may not be automatic; the limiter still enforces the correct windows, but expired counter records may remain stored.

## Verification

1. Keep DynamoDB Local running and load `.env.local` as usual.
2. Run `npx tsx scripts/check-auth-rate-limit.ts`: 12 simultaneous updates must result in exactly 3 successes, 9 `RateLimitError` failures; the next window must permit another request. The script deletes its temporary records.
3. Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`.
4. Manual check: repeatedly submit a wrong password for a test email. When the threshold is reached, sign-in attempts must stop succeeding; a normal successful login should work after the window rolls over. Registration must eventually return `429 RATE_LIMITED` with `Retry-After`. Avoid exercising limits against your primary account during testing.

NextAuth v4's Credentials callback handles its own HTTP response. Login attempts are throttled inside `authorize()`, but **the HTTP status is not guaranteed to be 429**; the UI attempts to show a rate-limit message if NextAuth returns the `RATE_LIMITED` error. Registration uses the app's own route and returns 429 directly.

## Remaining production concerns

Request-rate limits alone do not make authentication production ready. The app still needs email verification, recovery, abuse monitoring, and validated reverse-proxy configuration. Generic credentials errors should not reveal whether an email account exists. The existing unsigned guest cookie also remains a separate security limitation.
