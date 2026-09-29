import type { PrismaClient } from '@prisma/client'
import { listLowStockAlerts } from '../inventory/inventory.service'
import { defaultTenantId, systemUserId } from '../../db'

export async function runReconciliation(db: PrismaClient) {
  const alerts = await listLowStockAlerts(db)
  let createdNotifications = 0

  for (const alert of alerts) {
    const existing = await db.notification.findFirst({
      where: {
        tenantId: defaultTenantId,
        type: 'low_stock',
        title: `Low stock: ${alert.skuCode}`,
        read: false,
      },
    })

    if (existing) {
      continue
    }

    await db.notification.create({
      data: {
        id: `note-low-stock-${alert.inventoryItemId}-${Date.now()}`,
        tenantId: defaultTenantId,
        userId: 'user-buyer',
        type: 'low_stock',
        title: `Low stock: ${alert.skuCode}`,
        body: `${alert.skuName} has ${alert.available} available units in ${alert.warehouseCode}. Suggested purchase quantity: ${alert.suggestedPurchaseQty}.`,
      },
    })
    createdNotifications += 1
  }

  await db.auditLog.create({
    data: {
      id: `audit-reconciliation-${Date.now()}`,
      tenantId: defaultTenantId,
      actorId: systemUserId,
      action: 'worker.reconciliation_completed',
      entityType: 'worker_job',
      entityId: 'inventory-reconciliation',
      metadata: JSON.stringify({ alerts: alerts.length, createdNotifications }),
    },
  })

  return { alerts: alerts.length, createdNotifications }
}
