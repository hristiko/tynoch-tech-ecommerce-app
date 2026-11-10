# Guest-session integrity

Guest carts, wishlists and profiles are keyed by a randomly generated UUID. Previously, the raw UUID was stored in `tw_uid`. A user able to replace that unsigned cookie with another guest UUID could request that guest's data.

The server now stores `tw_uid=v1.<uuid>.<hmac>` using HMAC-SHA256 and the already-configured `NEXTAUTH_SECRET`. On every request the server verifies the signature in constant time before using the guest UUID. Modified, malformed, and unsigned cookies are rejected, and a new guest cookie is issued on the next guest write. This **does not** protect against theft of a complete valid cookie; HTTPS, `HttpOnly`, `SameSite=Lax`, `Secure` in production and a private signing secret remain necessary.

## Migration behavior

Existing **registered accounts**, their profiles, carts, and wishlists are unchanged. Existing unsigned guest cookies cannot be securely upgraded without accepting a spoofable identifier. They are intentionally rejected. Before deploying this change, sign in and import any guest-only products you want to preserve. Anonymous data associated with old unsigned cookies may remain in DynamoDB but is no longer accessible through those cookies.

Rotating `NEXTAUTH_SECRET` also invalidates existing signed guest cookies (and affects authenticated sessions). Keep the secret stable and private. A dedicated guest signing key or key rotation scheme could be added for a production service.

## Authorization testing

1. Register two test accounts (A and B). Add different cart and wishlist items to each.
2. Confirm signing into A never displays B's items, even after refreshing or opening a second browser.
3. Confirm signing out and signing into B shows only B's items.
4. In the browser's developer tools, replace `tw_uid` with a made-up UUID or modify any byte of its HMAC. Guest data must not load; the next guest cart write must issue a new signed cookie.
5. As a guest, add an item, refresh, and verify it persists; then sign in and import it to your account.

Do not use real customer accounts or other people's cookies to perform these checks.
