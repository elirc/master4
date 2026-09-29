import type { Prisma, PrismaClient } from '@prisma/client'
import type { ReservationResultDto, SalesOrderDto } from '../../../shared/apiContracts'
import { randomUUID } from 'node:crypto'
import { applyReservation, planReservation } from '../../../shared/inventoryRules'
import { defaultTenantId, systemUserId } from '../../db'

type Db = PrismaClient | Prisma.TransactionClient

export async function listSalesOrders(db: Db): Promise<SalesOrderDto[]> {
  const orders = await db.salesOrder.findMany({
    include: {
      warehouse: true,
      lines: { include: { sku: true } },
    },
    orderBy: [{ promisedShipBy: 'asc' }],
  })

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    channel: order.channel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    priority: order.priority,
    warehouseCode: order.warehouse.code,
    promisedShipBy: order.promisedShipBy.toISOString(),
    lines: order.lines.map((line) => ({
      skuCode: line.sku.skuCode,
      skuName: line.sku.name,
      quantity: line.quantity,
    })),
  }))
}

export async function reserveSalesOrder(db: PrismaClient, orderId: string): Promise<ReservationResultDto> {
  return db.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    })

    if (!order) {
      return { ok: false, orderId, status: 'not_found', failures: [] }
    }

    if (order.status !== 'pending_reservation') {
      return { ok: true, orderId, status: order.status, failures: [] }
    }

    const balances = await tx.inventoryItem.findMany({
      where: {
        warehouseId: order.warehouseId,
        skuId: { in: order.lines.map((line) => line.skuId) },
      },
    })
    const decision = planReservation(order.lines, balances)

    if (!decision.ok) {
      await tx.auditLog.create({
        data: {
          id: `audit-reservation-failed-${randomUUID()}`,
          tenantId: defaultTenantId,
          actorId: systemUserId,
          action: 'order.reservation_failed',
          entityType: 'sales_order',
          entityId: order.id,
          metadata: JSON.stringify({ failures: decision.failures }),
        },
      })

      return { ok: false, orderId, status: order.status, failures: decision.failures }
    }

    // Write per SKU, not per line: two lines for one SKU are one demand on one balance,
    // exactly as planReservation counted them. One reservation row per SKU.
    const requestedBySku = new Map<string, number>()
    for (const line of order.lines) {
      requestedBySku.set(line.skuId, (requestedBySku.get(line.skuId) ?? 0) + line.quantity)
    }

    for (const [skuId, quantity] of requestedBySku) {
      const balance = balances.find((item) => item.skuId === skuId)

      if (!balance) {
        // planReservation already reported a missing balance as a failure, so this is unreachable
        // on the success path; keep the guard so a future change cannot write against nothing.
        continue
      }

      // The pure rule is the guard at the write, not only at the plan: it throws (and the
      // transaction rolls back) if the aggregate would exceed available-to-promise.
      applyReservation(balance, quantity)

      await tx.inventoryItem.update({
        where: { id: balance.id },
        data: { reserved: { increment: quantity } },
      })
      await tx.stockReservation.create({
        data: {
          id: `res-${randomUUID()}`,
          salesOrderId: order.id,
          skuId,
          warehouseId: order.warehouseId,
          quantity,
          status: 'active',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })
    }

    await tx.salesOrder.update({
      where: { id: order.id },
      data: { status: 'allocated' },
    })
    const event = await tx.domainEvent.create({
      data: {
        id: `evt-order-reserved-${randomUUID()}`,
        tenantId: defaultTenantId,
        eventType: 'order.reserved',
        aggregateType: 'sales_order',
        aggregateId: order.id,
        payload: JSON.stringify({ orderId: order.id, warehouseId: order.warehouseId }),
      },
    })
    await tx.outboxMessage.create({
      data: {
        id: `outbox-order-reserved-${randomUUID()}`,
        eventId: event.id,
        destination: 'notifications.order_updates',
        status: 'pending',
        availableAt: new Date(),
      },
    })
    await tx.auditLog.create({
      data: {
        id: `audit-order-reserved-${randomUUID()}`,
        tenantId: defaultTenantId,
        actorId: systemUserId,
        action: 'order.reserved',
        entityType: 'sales_order',
        entityId: order.id,
        metadata: JSON.stringify({ lineCount: order.lines.length }),
      },
    })

    return { ok: true, orderId, status: 'allocated', failures: [] }
  })
}
