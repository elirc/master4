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
  // An order may contain more than one line for the same SKU (for example,
  // when a UI appends an item instead of merging it).  Check the aggregate
  // demand so every line competes for the same inventory pool.
  const requestedBySku = new Map<string, number>()
  const invalidLines = lines.filter((line) => {
    const valid = Number.isSafeInteger(line.quantity) && line.quantity > 0
    if (!valid) {
      return true
    }
    requestedBySku.set(line.skuId, (requestedBySku.get(line.skuId) ?? 0) + line.quantity)
    return false
  })

  const failures = [
    ...invalidLines.map((line) => ({
      skuId: line.skuId,
      requested: line.quantity,
      available: 0,
      reason: 'Reservation quantity must be a positive whole number.',
    })),
    ...Array.from(requestedBySku, ([skuId, quantity]) => ({ skuId, quantity })).flatMap((line) => {
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
    }),
  ]

  return { ok: failures.length === 0, failures }
}

export function applyReservation(balance: InventoryBalance, quantity: number): InventoryBalance {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Reservation quantity must be a positive whole number.')
  }

  if (quantity > availableToPromise(balance)) {
    throw new Error('Cannot reserve more units than are currently available.')
  }

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
