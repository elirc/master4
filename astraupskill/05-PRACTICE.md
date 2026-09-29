# 05: progressive practice

Work through these exercises in order. Keep your edits local to `src/shared/inventoryRules.ts` and `tests/inventoryRules.test.ts`, and run the focused Vitest file after each exercise. The goal is to practice the same reasoning used in the completed patch.

## Exercise 5: a valid quantity against a missing balance row

Seed an order whose SKU has no `InventoryItem` row in the order's warehouse (a real case: the SKU exists, it has simply never been stocked there). Predict the response before running: `planReservation` treats a missing balance as `available = 0`, so the plan fails and the write loop is never reached. Write the test in `tests/reservation-api.test.ts` style: assert `ok: false`, one failure with `available: 0`, no `InventoryItem` created as a side effect, exactly one `order.reservation_failed` audit row, and the order still `pending_reservation`. Then remove the `if (!balance) continue` guard in the write loop and confirm the test still passes (the plan protects it); put the guard back and explain in one sentence why it stays.

## Exercise 1: reproduce the oversell

Using the existing `balance` fixture, write a test with two `sku-pack-green` lines whose quantities individually fit but whose sum does not. Start with 14 and 9. Assert `decision.ok` is false, there is exactly one failure, and the failure reports total requested quantity 23. Before changing source, run the test and observe it fail against the original `flatMap` implementation. Explain in a comment why two successful per-line comparisons are misleading.

## Exercise 2: add invalid-input cases

Add a table-driven or explicit test for zero, negative, fractional, and non-finite values. The public result should remain a `ReservationDecision`, so do not make `planReservation` throw for these inputs. Each failure should identify the original SKU and quantity. Decide whether invalid quantities should affect the grouped map; they should not, because invalid demand cannot become a second availability check.

## Exercise 3: protect the pure mutation

Update `applyReservation` so it rejects invalid quantities and quantities greater than available-to-promise. Add tests for a quantity of 0 and a quantity of 23 against the fixture. Keep the successful quantity 5 test. Ask yourself why this function throws while `planReservation` returns failures: one is a decision report, and the other would otherwise return corrupted state.

## Exercise 4: review the patch boundary

Read `orders.service.ts` and list every record written after a successful decision. Confirm that the patch does not alter those writes. Then write a short review note describing what a database transaction guarantees and what this helper cannot guarantee by itself. A strong answer mentions that the service still owns atomic persistence, while the helper now catches duplicate-line and invalid-quantity errors before the mutation loop.
