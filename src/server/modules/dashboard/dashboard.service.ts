import type { PrismaClient } from '@prisma/client'
import type { DashboardDto, DashboardMetric } from '../../../shared/apiContracts'
import { listShipments } from '../fulfillment/fulfillment.service'
import { listInventory, listLowStockAlerts } from '../inventory/inventory.service'
import { listSalesOrders } from '../orders/orders.service'
import { listPurchaseOrders } from '../purchasing/purchasing.service'

export async function getDashboard(db: PrismaClient): Promise<DashboardDto> {
  const [inventory, salesOrders, purchaseOrders, shipments, lowStockAlerts] = await Promise.all([
    listInventory(db),
    listSalesOrders(db),
    listPurchaseOrders(db),
    listShipments(db),
    listLowStockAlerts(db),
  ])
  const openOrders = salesOrders.filter((order) => order.status !== 'shipped' && order.status !== 'cancelled')
  const availableUnits = inventory.reduce((sum, item) => sum + item.available, 0)
  const reservedUnits = inventory.reduce((sum, item) => sum + item.reserved, 0)
  const metrics: DashboardMetric[] = [
    { label: 'Available units', value: availableUnits.toLocaleString(), tone: 'good' },
    { label: 'Reserved units', value: reservedUnits.toLocaleString(), tone: 'neutral' },
    { label: 'Open sales orders', value: openOrders.length.toString(), tone: 'warning' },
    { label: 'Low-stock alerts', value: lowStockAlerts.length.toString(), tone: lowStockAlerts.length ? 'danger' : 'good' },
  ]

  return {
    metrics,
    inventory,
    salesOrders,
    purchaseOrders,
    shipments,
    lowStockAlerts,
  }
}
