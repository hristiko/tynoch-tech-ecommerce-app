# Keeping cart updates consistent

The cart must handle two requests arriving at almost the same time. Without concurrency control, both requests could read a quantity of one, add one, and each write two. One addition would be lost.

## How Tidewell handles this

Each cart item has a version number. When a service updates an item, its DynamoDB write is accepted only if the version still matches the value that was read. If someone else changed the item first, the service retrieves the current value and tries the calculation again, up to eight attempts.

New records use an `attribute_not_exists` condition. Older cart records without a `version` field still work: their next update checks the existing quantity and adds the first version. No database migration is required.

Reads of cart records use DynamoDB's strongly consistent mode. Guest-cart imports also use conditional writes, so importing an item cannot overwrite an existing account cart line.

If the same record keeps changing and the retry limit is reached, the API reports a conflict instead of silently discarding an update.

## Verify it locally

Start DynamoDB Local, then run:

```powershell
npm run typecheck
npm test
npm run db:test-cart
```

The integration script tests simultaneous additions, stock and per-item limits, old unversioned records, and guest-to-account import. It only creates and removes its own temporary DynamoDB records.

To test in the browser, start with one item and open its **product detail page** in two tabs. Click **Add to cart** in both tabs, then refresh the cart. If both additions succeeded and stock permits it, the total should be three.

The `+` control on the cart page behaves differently: it submits an absolute quantity. Two stale tabs both changing quantity one to two can correctly leave a total of two, not three.

## Limits

This protection applies to cart records, not inventory reservations. Stock can change separately, and the application has no transactional checkout. Explicit quantity changes and removals also have their own ordering: the last successful action can determine the final value. The solution does not address DynamoDB multi-region global-table conflicts.
