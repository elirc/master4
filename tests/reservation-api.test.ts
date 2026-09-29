import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/server/app'
import { defaultTenantId, prisma } from '../src/server/db'
import { availableToPromise } from '../src/shared/inventoryRules'

// Uses the seeded SQLite database like tests/api.test.ts; everything it creates is removed afterwards.
const app = createApp()
const orderId = 'so-test-aggregate'
const skuId = 'sku-pack-black'
const warehouseId = 'wh-west'

describe('POST /api/orders/:orderId/reserve', () => {
  let available = 0
  let reservedBefore = 0
  let reservationsBefore = 0

  beforeAll(async () => {
    const balance = await prisma.inventoryItem.findUniqueOrThrow({ where: { warehouseId_skuId: { warehouseId, skuId } } })
    available = availableToPromise(balance)
    reservedBefore = balance.reserved
    reservationsBefore = await prisma.stockReservation.count()
    await prisma.salesOrder.create({
      data: {
        id: orderId, tenantId: defaultTenantId, warehouseId, orderNumber: 'SO-TEST-AGG', customerName: 'Aggregate Test',
        channel: 'Wholesale', status: 'pending_reservation', paymentStatus: 'authorized', priority: 'high',
        placedAt: new Date(), promisedShipBy: new Date(Date.now() + 86_400_000),
        // Two lines for one SKU: each fits on its own, together they exceed what is available.
        lines: { create: [
          { id: orderId + '-1', skuId, quantity: available, unitPriceCents: 100 },
          { id: orderId + '-2', skuId, quantity: 1, unitPriceCents: 100 },
        ] },
      },
    })
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: orderId } })
    await prisma.stockReservation.deleteMany({ where: { salesOrderId: orderId } })
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: orderId } })
    await prisma.salesOrder.deleteMany({ where: { id: orderId } })
  })

  it('refuses the aggregate demand, changes no inventory, and records exactly one failure audit row', async () => {
    const response = await request(app).post(`/api/orders/${orderId}/reserve`)

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(false)
    expect(response.body.failures).toHaveLength(1)
    expect(response.body.failures[0]).toMatchObject({ skuId, requested: available + 1, available })

    const balance = await prisma.inventoryItem.findUniqueOrThrow({ where: { warehouseId_skuId: { warehouseId, skuId } } })
    expect(balance.reserved).toBe(reservedBefore)
    expect(await prisma.stockReservation.count()).toBe(reservationsBefore)
    expect(await prisma.auditLog.count({ where: { entityId: orderId, action: 'order.reservation_failed' } })).toBe(1)
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('pending_reservation')
  })

  it('reserves once per SKU when the aggregate fits', async () => {
    await prisma.salesOrderLine.update({ where: { id: orderId + '-1' }, data: { quantity: 1 } })
    const response = await request(app).post(`/api/orders/${orderId}/reserve`)

    expect(response.body).toMatchObject({ ok: true, status: 'allocated' })
    const rows = await prisma.stockReservation.findMany({ where: { salesOrderId: orderId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(2)
    const balance = await prisma.inventoryItem.findUniqueOrThrow({ where: { warehouseId_skuId: { warehouseId, skuId } } })
    expect(balance.reserved).toBe(reservedBefore + 2)
    // Undo the reservation so the seeded database is unchanged for the next test file.
    await prisma.inventoryItem.update({ where: { id: balance.id }, data: { reserved: reservedBefore } })
  })
})
