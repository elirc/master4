import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const tenantId = 'tenant-atlas'

async function main() {
  await prisma.outboxMessage.deleteMany()
  await prisma.domainEvent.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.inventoryAdjustment.deleteMany()
  await prisma.return.deleteMany()
  await prisma.shipment.deleteMany()
  await prisma.stockReservation.deleteMany()
  await prisma.salesOrderLine.deleteMany()
  await prisma.salesOrder.deleteMany()
  await prisma.purchaseOrderLine.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.sku.deleteMany()
  await prisma.product.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()

  await prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'Atlas Outfitters',
      plan: 'enterprise',
      users: {
        create: [
          {
            id: 'user-ops-admin',
            name: 'Renee Alvarez',
            email: 'renee@atlas.example',
            role: 'admin',
          },
          {
            id: 'user-warehouse-lead',
            name: 'Marcus Lee',
            email: 'marcus@atlas.example',
            role: 'warehouse_manager',
          },
          {
            id: 'user-buyer',
            name: 'Talia Morgan',
            email: 'talia@atlas.example',
            role: 'buyer',
          },
        ],
      },
      warehouses: {
        create: [
          {
            id: 'wh-west',
            code: 'LAX-1',
            name: 'Los Angeles Fulfillment Center',
            region: 'US West',
            timezone: 'America/Los_Angeles',
          },
          {
            id: 'wh-east',
            code: 'EWR-2',
            name: 'Newark Forward Stocking',
            region: 'US East',
            timezone: 'America/New_York',
          },
        ],
      },
      suppliers: {
        create: [
          {
            id: 'supplier-nova',
            name: 'Nova Packs Co.',
            contactEmail: 'ops@novapacks.example',
            reliability: 92,
            leadTimeDays: 12,
          },
          {
            id: 'supplier-peak',
            name: 'PeakTrail Manufacturing',
            contactEmail: 'orders@peaktrail.example',
            reliability: 84,
            leadTimeDays: 18,
          },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      id: 'product-pack',
      tenantId,
      name: 'Summit Daypack',
      category: 'Bags',
      description: 'Durable 22L daypack sold through DTC and marketplace channels.',
      skus: {
        create: [
          {
            id: 'sku-pack-black',
            skuCode: 'PACK-22-BLK',
            barcode: '850000000101',
            name: 'Summit Daypack / Black',
            unitCostCents: 3200,
            priceCents: 8900,
            weightGrams: 760,
          },
          {
            id: 'sku-pack-green',
            skuCode: 'PACK-22-GRN',
            barcode: '850000000118',
            name: 'Summit Daypack / Forest',
            unitCostCents: 3200,
            priceCents: 8900,
            weightGrams: 760,
          },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      id: 'product-bottle',
      tenantId,
      name: 'Trail Bottle',
      category: 'Hydration',
      description: 'Insulated bottle with replaceable cap and warehouse-friendly carton profile.',
      skus: {
        create: [
          {
            id: 'sku-bottle-steel',
            skuCode: 'BOT-24-STL',
            barcode: '850000000200',
            name: 'Trail Bottle / Steel',
            unitCostCents: 900,
            priceCents: 2800,
            weightGrams: 410,
          },
          {
            id: 'sku-bottle-red',
            skuCode: 'BOT-24-RED',
            barcode: '850000000217',
            name: 'Trail Bottle / Red',
            unitCostCents: 900,
            priceCents: 2800,
            weightGrams: 410,
          },
        ],
      },
    },
  })

  await prisma.inventoryItem.createMany({
    data: [
      {
        id: 'inv-west-pack-black',
        warehouseId: 'wh-west',
        skuId: 'sku-pack-black',
        onHand: 118,
        reserved: 31,
        reorderPoint: 60,
        safetyStock: 35,
      },
      {
        id: 'inv-west-pack-green',
        warehouseId: 'wh-west',
        skuId: 'sku-pack-green',
        onHand: 42,
        reserved: 20,
        reorderPoint: 50,
        safetyStock: 28,
      },
      {
        id: 'inv-west-bottle-steel',
        warehouseId: 'wh-west',
        skuId: 'sku-bottle-steel',
        onHand: 240,
        reserved: 76,
        reorderPoint: 120,
        safetyStock: 80,
      },
      {
        id: 'inv-west-bottle-red',
        warehouseId: 'wh-west',
        skuId: 'sku-bottle-red',
        onHand: 68,
        reserved: 26,
        reorderPoint: 90,
        safetyStock: 60,
      },
      {
        id: 'inv-east-pack-black',
        warehouseId: 'wh-east',
        skuId: 'sku-pack-black',
        onHand: 38,
        reserved: 9,
        reorderPoint: 45,
        safetyStock: 25,
      },
      {
        id: 'inv-east-bottle-steel',
        warehouseId: 'wh-east',
        skuId: 'sku-bottle-steel',
        onHand: 96,
        reserved: 20,
        reorderPoint: 100,
        safetyStock: 70,
      },
    ],
  })

  await prisma.salesOrder.create({
    data: {
      id: 'so-10034',
      tenantId,
      warehouseId: 'wh-west',
      orderNumber: 'SO-10034',
      customerName: 'North Ridge Retail',
      channel: 'Wholesale',
      status: 'allocated',
      paymentStatus: 'authorized',
      priority: 'high',
      placedAt: new Date('2026-05-03T15:00:00Z'),
      promisedShipBy: new Date('2026-05-06T23:00:00Z'),
      lines: {
        create: [
          {
            id: 'sol-10034-1',
            skuId: 'sku-pack-black',
            quantity: 24,
            unitPriceCents: 6500,
          },
          {
            id: 'sol-10034-2',
            skuId: 'sku-bottle-steel',
            quantity: 48,
            unitPriceCents: 2100,
          },
        ],
      },
      reservations: {
        create: [
          {
            id: 'res-10034-1',
            skuId: 'sku-pack-black',
            warehouseId: 'wh-west',
            quantity: 24,
            status: 'active',
            expiresAt: new Date('2026-05-07T00:00:00Z'),
          },
          {
            id: 'res-10034-2',
            skuId: 'sku-bottle-steel',
            warehouseId: 'wh-west',
            quantity: 48,
            status: 'active',
            expiresAt: new Date('2026-05-07T00:00:00Z'),
          },
        ],
      },
    },
  })

  await prisma.salesOrder.create({
    data: {
      id: 'so-10035',
      tenantId,
      warehouseId: 'wh-west',
      orderNumber: 'SO-10035',
      customerName: 'Mira Sanchez',
      channel: 'Shopify',
      status: 'pending_reservation',
      paymentStatus: 'paid',
      priority: 'normal',
      placedAt: new Date('2026-05-04T13:15:00Z'),
      promisedShipBy: new Date('2026-05-06T20:00:00Z'),
      lines: {
        create: [
          {
            id: 'sol-10035-1',
            skuId: 'sku-pack-green',
            quantity: 18,
            unitPriceCents: 8900,
          },
        ],
      },
    },
  })

  await prisma.purchaseOrder.create({
    data: {
      id: 'po-70012',
      tenantId,
      supplierId: 'supplier-nova',
      warehouseId: 'wh-west',
      poNumber: 'PO-70012',
      status: 'in_transit',
      expectedAt: new Date('2026-05-12T18:00:00Z'),
      lines: {
        create: [
          {
            id: 'pol-70012-1',
            skuId: 'sku-pack-green',
            orderedQty: 160,
            receivedQty: 0,
            unitCostCents: 3150,
          },
          {
            id: 'pol-70012-2',
            skuId: 'sku-pack-black',
            orderedQty: 120,
            receivedQty: 40,
            unitCostCents: 3150,
          },
        ],
      },
    },
  })

  await prisma.shipment.create({
    data: {
      id: 'ship-50008',
      salesOrderId: 'so-10034',
      warehouseId: 'wh-west',
      shipmentNumber: 'SHP-50008',
      carrier: 'UPS',
      serviceLevel: 'Ground',
      trackingCode: '1Z999ATLAS50008',
      status: 'label_created',
    },
  })

  await prisma.return.create({
    data: {
      id: 'ret-90004',
      salesOrderId: 'so-10034',
      rmaNumber: 'RMA-90004',
      status: 'awaiting_receipt',
      reason: 'Customer ordered wrong color',
    },
  })

  const event = await prisma.domainEvent.create({
    data: {
      id: 'evt-low-stock-west-pack-green',
      tenantId,
      eventType: 'inventory.low_stock_detected',
      aggregateType: 'inventory_item',
      aggregateId: 'inv-west-pack-green',
      payload: JSON.stringify({ skuId: 'sku-pack-green', warehouseId: 'wh-west', available: 22 }),
    },
  })

  await prisma.outboxMessage.create({
    data: {
      id: 'outbox-low-stock-west-pack-green',
      eventId: event.id,
      destination: 'notifications.low_stock',
      status: 'pending',
      availableAt: new Date('2026-05-05T12:00:00Z'),
    },
  })

  await prisma.notification.create({
    data: {
      id: 'note-low-stock-1',
      tenantId,
      userId: 'user-buyer',
      type: 'low_stock',
      title: 'Low stock: PACK-22-GRN',
      body: 'Forest daypack has 22 available units in LAX-1, below reorder point 50.',
    },
  })

  await prisma.auditLog.create({
    data: {
      id: 'audit-seed-1',
      tenantId,
      actorId: 'user-ops-admin',
      action: 'seed.initialized',
      entityType: 'tenant',
      entityId: tenantId,
      metadata: JSON.stringify({ source: 'prisma/seed.ts' }),
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
