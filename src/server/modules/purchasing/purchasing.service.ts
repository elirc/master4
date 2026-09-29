import type { PrismaClient } from '@prisma/client'
import type { PurchaseOrderDto } from '../../../shared/apiContracts'

export async function listPurchaseOrders(db: PrismaClient): Promise<PurchaseOrderDto[]> {
  const purchaseOrders = await db.purchaseOrder.findMany({
    include: {
      supplier: true,
      warehouse: true,
      lines: true,
    },
    orderBy: [{ expectedAt: 'asc' }],
  })

  return purchaseOrders.map((purchaseOrder) => ({
    id: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    supplierName: purchaseOrder.supplier.name,
    warehouseCode: purchaseOrder.warehouse.code,
    status: purchaseOrder.status,
    expectedAt: purchaseOrder.expectedAt.toISOString(),
    totalUnits: purchaseOrder.lines.reduce((sum, line) => sum + line.orderedQty, 0),
    receivedUnits: purchaseOrder.lines.reduce((sum, line) => sum + line.receivedQty, 0),
  }))
}
