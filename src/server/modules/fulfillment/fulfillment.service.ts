import type { PrismaClient } from '@prisma/client'
import type { ShipmentDto } from '../../../shared/apiContracts'

export async function listShipments(db: PrismaClient): Promise<ShipmentDto[]> {
  const shipments = await db.shipment.findMany({
    include: { salesOrder: true },
    orderBy: [{ shipmentNumber: 'desc' }],
  })

  return shipments.map((shipment) => ({
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    orderNumber: shipment.salesOrder.orderNumber,
    carrier: shipment.carrier,
    serviceLevel: shipment.serviceLevel,
    trackingCode: shipment.trackingCode,
    status: shipment.status,
  }))
}
