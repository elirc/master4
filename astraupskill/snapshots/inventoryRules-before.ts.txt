export interface InventoryBalance {
  skuId: string
  warehouseId: string
  onHand: number
  reserved: number
  reorderPoint: number
  safetyStock: number
}

export interface ReservationLine {
  skuId: string
  quantity: number
}

export interface ReservationDecision {
  ok: boolean
  failures: Array<{
    skuId: string
    requested: number
    available: number
    reason: string
  }>
}

export function availableToPromise(balance: Pick<InventoryBalance, 'onHand' | 'reserved'>) {
  return Math.max(0, balance.onHand - balance.reserved)
}

export function planReservation(lines: ReservationLine[], balances: InventoryBalance[]): ReservationDecision {
  const failures = lines.flatMap((line) => {
    const balance = balances.find((candidate) => candidate.skuId === line.skuId)
    const available = balance ? availableToPromise(balance) : 0

    if (!balance) {
      return [
        {
          skuId: line.skuId,
          requested: line.quantity,
          available,
          reason: 'No inventory balance exists for this SKU in the selected warehouse.',
        },
      ]
    }

    if (line.quantity > available) {
      return [
        {
          skuId: line.skuId,
          requested: line.quantity,
          available,
          reason: 'Requested quantity exceeds available-to-promise inventory.',
        },
      ]
    }

    return []
  })

  return { ok: failures.length === 0, failures }
}

export function applyReservation(balance: InventoryBalance, quantity: number): InventoryBalance {
  return {
    ...balance,
    reserved: balance.reserved + quantity,
  }
}

export function applyShipment(balance: InventoryBalance, quantity: number): InventoryBalance {
  if (quantity > balance.reserved) {
    throw new Error('Cannot ship more units than are currently reserved.')
  }

  return {
    ...balance,
    onHand: balance.onHand - quantity,
    reserved: balance.reserved - quantity,
  }
}

export function isLowStock(balance: InventoryBalance) {
  return availableToPromise(balance) <= balance.reorderPoint || balance.onHand <= balance.safetyStock
}

export function stockHealth(balance: InventoryBalance) {
  const available = availableToPromise(balance)

  if (available <= 0) {
    return 'stockout'
  }

  if (isLowStock(balance)) {
    return 'low'
  }

  return 'healthy'
}
