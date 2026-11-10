# Accounts and sign-in

Tidewell supports both guests and registered users. Guests can browse and save items without giving an email address. Registering makes it possible to return to the same cart and wishlist from a different browser.

## Registration

`POST /api/auth/register` checks the submitted name, email and password with Zod. Passwords must be at least 12 characters. The server normalizes the email, hashes the password with `scrypt` and a new random salt, and creates three records in one DynamoDB transaction:

| Record | Key | Contents |
| --- | --- | --- |
| Profile | `USER#acct-<uuid>` / `PROFILE` | Name, normalized email, timestamps |
| Credentials | `USER#acct-<uuid>` / `CREDENTIALS` | Salted password hash |
| Email lookup | `AUTH_EMAIL#<sha256(email)>` / `LOOKUP` | Account ID |

The email lookup has a conditional write, so registering the same email twice is rejected even if the requests arrive together. Passwords are never stored as readable text.

## Login and session ownership

NextAuth.js v4 handles credentials sign-in and sign-out. Its Credentials provider looks up the email, checks the password hash and creates a session. When a personalized API route runs, the server reads the session and selects that account's records. A supplied `userId` query parameter or modified guest cookie cannot replace the account ID from the session.

Without an authenticated session, the application can use a verified, signed guest cookie. These identities are deliberately separate: registered account IDs start with `acct-`, while guest IDs are UUIDs.

## Importing guest items

After sign-in, the browser can call `POST /api/account/import-guest`. Guest-only cart items and wishlist entries are moved into the account. If a product is already in the account cart, the account quantity is kept. The import skips unavailable products and removes guest entries only after the relevant destination operation completes.

This import is made of several database operations, not one all-or-nothing transaction. Individual cart operations use conditional writes, but a failure in the middle of a multi-item import can leave some guest items for another attempt.

## Local configuration

Set `NEXTAUTH_URL=http://localhost:3000` and a private `NEXTAUTH_SECRET` in `.env.local`. Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Don't commit the secret. The account records use the existing DynamoDB table and indexes; no new table or reseeding is required.

## What isn't implemented

There is no email verification, password-reset email, account deletion, multi-factor authentication or general session revocation flow. A registered email cannot be changed from the normal profile form because its lookup record would also need an atomic update. For request-rate limits, see [Authentication request limits](AUTH_RATE_LIMITING.md). For the guest cookie format and limitations, see [Guest sessions](GUEST_SESSION_SECURITY.md).
