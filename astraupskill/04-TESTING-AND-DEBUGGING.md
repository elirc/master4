# 04: testing and debugging the invariant

The regression tests belong in `tests/inventoryRules.test.ts` because the failure is in a pure function. The first test supplies two lines for `sku-pack-green`, quantities 14 and 9, and expects one failure for 23 against 22 available. This test would fail against the snapshot implementation: both independent comparisons would pass and `decision.ok` would be true. That is a strong regression test because it describes the production failure mode, rather than asserting an internal `Map` or loop.

The second test passes four invalid quantities: zero, negative one, `1.5`, and `Number.POSITIVE_INFINITY`. It checks that all four are failures and that every reason names a positive whole number. The third test exercises `applyReservation` directly. It verifies that zero throws a validation error and that 23 throws an availability error. Existing tests remain valuable: available-to-promise calculation, single-line success, ordinary insufficient stock, ordinary increment, shipment and low-stock cases check the existing behavior. The delivered suite does not contain a dedicated valid-quantity/missing-balance regression; that would be a useful additional exercise.

Run the focused command from the staged project directory with `npm test -- --run tests/inventoryRules.test.ts`. Then run `npm test` and `npm run typecheck`. If the focused test fails, inspect the actual failure object with a temporary `console.log` or use Vitest's verbose reporter; do not change expected values just to make the suite green. If TypeScript reports a type error around `Array.from(requestedBySku, ...)`, check that the callback returns the grouped shape `{ skuId, quantity }` and that the flattening callback returns arrays consistently.

A useful debugging table is: input lines, grouped demand, matching balance, available stock, decision, and allocation writes. For `[14, 9]`, grouped demand is 23, balance is 42/20, available is 22, and the decision fails. Inventory and order-status updates must not run, but the service intentionally writes a failure audit. For `[18]`, grouped demand is 18, available is 22, and the order service may proceed with allocation. This table helps distinguish a planner bug from a transaction bug. The existing API suite requires a generated Prisma client and a disposable database URL, but it covers health, dashboard reads and CSV export only. Its passing result does not prove reservation persistence, rollback or concurrent allocation. See the verification record for the successful database setup and actual check results.

## The first regression test, as written

This is the aggregate-demand case described above, `tests/inventoryRules.test.ts:38`. The assertion is on the *grouped* request of 23 against 22 available — which is the production failure mode, not an internal `Map`.

```ts
  it('aggregates duplicate SKU lines before checking availability', () => {
    const decision = planReservation(
      [
        { skuId: 'sku-pack-green', quantity: 14 },
        { skuId: 'sku-pack-green', quantity: 9 },
      ],
      [balance],
    )

    expect(decision.ok).toBe(false)
    expect(decision.failures).toEqual([
      expect.objectContaining({
        skuId: 'sku-pack-green',
        requested: 23,
        available: 22,
      }),
    ])
  })
```

