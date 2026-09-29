import { describe, expect, it } from 'vitest'
import {
  applyReservation,
  applyShipment,
  availableToPromise,
  isLowStock,
  planReservation,
} from '../src/shared/inventoryRules'

const balance = {
  skuId: 'sku-pack-green',
  warehouseId: 'wh-west',
  onHand: 42,
  reserved: 20,
  reorderPoint: 50,
  safetyStock: 28,
}

describe('inventory domain rules', () => {
  it('calculates available-to-promise from on-hand minus reserved', () => {
    expect(availableToPromise(balance)).toBe(22)
  })

  it('allows a reservation when requested quantity is available', () => {
    expect(planReservation([{ skuId: 'sku-pack-green', quantity: 18 }], [balance])).toEqual({
      ok: true,
      failures: [],
    })
  })

  it('rejects a reservation that exceeds available inventory', () => {
    const decision = planReservation([{ skuId: 'sku-pack-green', quantity: 30 }], [balance])

    expect(decision.ok).toBe(false)
    expect(decision.failures[0]?.available).toBe(22)
  })

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

  it('rejects zero, negative, fractional, and non-finite quantities', () => {
    const decision = planReservation(
      [
        { skuId: 'zero', quantity: 0 },
        { skuId: 'negative', quantity: -1 },
        { skuId: 'fractional', quantity: 1.5 },
        { skuId: 'infinite', quantity: Number.POSITIVE_INFINITY },
      ],
      [],
    )

    expect(decision.ok).toBe(false)
    expect(decision.failures).toHaveLength(4)
    expect(decision.failures.every((failure) => failure.reason.includes('positive whole number'))).toBe(true)
  })

  it('increments reserved inventory when stock is reserved', () => {
    expect(applyReservation(balance, 5).reserved).toBe(25)
  })

  it('protects the reservation helper from invalid or unavailable quantities', () => {
    expect(() => applyReservation(balance, 0)).toThrow('positive whole number')
    expect(() => applyReservation(balance, 23)).toThrow('currently available')
  })

  it('decrements both on-hand and reserved inventory when reserved stock ships', () => {
    expect(applyShipment(balance, 12)).toMatchObject({ onHand: 30, reserved: 8 })
  })

  it('flags low stock when available quantity is below reorder point', () => {
    expect(isLowStock(balance)).toBe(true)
  })
})
