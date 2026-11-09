# Cart consistency (DynamoDB)

The cart previously read an item, calculated a new quantity, then performed an unconditional `PutItem`. Two simultaneous additions could read the same old quantity and overwrite each other.

## Change

- `cartRepo.compareAndPut(item, previous)` performs a conditional DynamoDB `PutItem`. New items require `attribute_not_exists(PK)`. Updated items require the version that the request read.
- A conflict returns `false`, and the service reads the latest item and recalculates (up to eight attempts). Too much contention produces HTTP 409 rather than silently losing an update.
- Strongly consistent cart reads (`GetItem` and the base-table `Query`) prevent a retry or response from relying on a stale cart record.
- Cart records gain a numeric `version` field. **Existing rows do not need migration**: for rows without `version`, the first update checks both their old quantity and absence of a version before setting `version: 1`.
- Guest import conditionally inserts guest-only cart items and conditionally deletes their original records, so it does not overwrite existing account cart items or discard a guest item updated mid-import.

## Validate against Docker DynamoDB Local

Keep DynamoDB Local running with port 8000 exposed. Check `.env.local` points to that local endpoint, then run:

```bash
npm run typecheck
npm test
npm run lint
npm run db:test-cart
npm run build
```

`db:test-cart` exercises concurrent additions, stock caps, legacy cart rows, and guest import against **DynamoDB Local**, then deletes only its own temporary records. It refuses nonlocal DynamoDB endpoints. It does not modify existing real users' carts.

## Scope and limitations

- This prevents lost updates to **individual cart records** within one DynamoDB region. It does not reserve inventory or make a checkout transaction. Product stock is read separately and may change independently.
- Concurrent explicit quantity settings follow whichever conditional write succeeds last; a later remove may delete a recently added item. That is the intended ordering for these user commands, not inventory reservation.
- This is not a multi-region DynamoDB global-table conflict solution.
- Data can change again immediately after a successful read if a different request is in progress. The UI may need a refresh when another browser tab changes the cart.
- The guest import operation is not a full all-or-nothing cross-record transaction, but individual cart insertions/deletions now have conditional protections.
