# Authenticated accounts (local development)

## Workflow

1. Visitors initially use the unsigned `tw_uid` httpOnly UUID cookie and the existing guest cart/wishlist.
2. `POST /api/auth/register` validates the form, hashes the password using scrypt (random 16-byte salt), and atomically creates three DynamoDB items:
   - `PK=USER#acct-<uuid>, SK=PROFILE` stores name, normalized email, timestamps.
   - `PK=USER#acct-<uuid>, SK=CREDENTIALS` stores only the salted password hash.
   - `PK=AUTH_EMAIL#<sha256(normalized-email)>, SK=LOOKUP` stores the account ID and prevents duplicate registrations, via a DynamoDB transactional conditional put.
3. `POST /api/auth/callback/credentials` is owned by NextAuth.js, which checks the email lookup and hash and issues an encrypted JWT cookie. Users cannot self-assign an account ID through the request body or guest cookie.
4. The server checks `getServerSession(authOptions)` on each personalized page and API route. Authenticated IDs start with `acct-`; guest UUID cookies are accepted only for guest data. No route should trust a client-supplied account ID.
5. After successful sign-in, the client calls `POST /api/account/import-guest`. Account cart quantities win if a product exists in both carts; missing products are imported and wishlist entries are deduplicated. Imported guest entries are removed only after writes succeed. Out-of-stock guest items remain guest-only.
6. `signOut()` removes the authenticated session cookie; the browser may still have the anonymous guest cookie.

## Setup

Install `next-auth@4.24.15` (a v4 release matching the existing Next.js 14 App Router). In `.env.local` set:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<use a random 32-byte-or-longer secret>
```

Generate the secret once with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
Keep it private. No new DynamoDB table or index is needed; the three new record types use the existing PK/SK structure. Do not re-seed to create an account.

## Important limitations before public deployment

- This is suitable for a **local demonstration**, not a public production authentication system without further work.
- No email verification, forgotten-password flow, account deletion, session revocation, or multi-factor authentication.
- Add distributed login/registration rate limiting, anti-abuse controls, and audit logs before opening registration publicly.
- Guest cookies are legacy unsigned identifiers; account data is not accessible through them, but access to another guest's random cookie would allow guest data access. Sign guest cookies before production use.
- The guest import operation is not a single database transaction. It is repeat-safe under normal sequential use but still needs concurrency testing.
- Changing a registered email requires an atomic update of the email lookup and account record. It is disabled for now.
