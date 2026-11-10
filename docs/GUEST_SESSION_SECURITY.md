# Guest sessions

A guest needs a stable identifier so their cart and wishlist are available after a page refresh. Tidewell keeps that identifier in the `tw_uid` cookie.

Previously, the cookie contained only a UUID. Anyone who could substitute another guest's UUID could potentially request that guest's data. It now contains a signed value in the form `v1.<uuid>.<hmac>`.

The server checks the HMAC using `NEXTAUTH_SECRET` before trusting the identifier. The signature is checked with a constant-time comparison. A missing, altered or old unsigned cookie is rejected; the next guest write creates a new signed cookie. The cookie also uses `HttpOnly`, `SameSite=Lax`, and `Secure` when running in production.

A signature prevents someone from inventing a valid cookie merely by guessing an ID. It does **not** protect a cookie that has already been stolen. HTTPS and ordinary session-security precautions are still necessary on a public site.

## What happens to existing data?

Registered accounts and their carts are unaffected. Old unsigned guest cookies cannot be upgraded safely because the server can't verify who owns them. Guest-only items tied to such a cookie may remain in the database but cannot be recovered using the invalid cookie. Sign in and import guest items before applying this kind of change.

Changing `NEXTAUTH_SECRET` invalidates signed guest cookies and can affect authenticated sessions. Keep the value private and stable.

## Check the behavior

Run `npm test` for the signing and verification tests. To check browser behavior, create a guest cart, refresh, and confirm it remains. Then alter a character in `tw_uid` using developer tools and refresh again: the previous guest data should not load. Signing into an account should still show that account's own cart and wishlist.

Use only accounts and cookies you control when testing.
