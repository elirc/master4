import type { PrismaClient } from '@prisma/client'
import type { InventoryRow, LowStockAlertDto } from '../../../shared/apiContracts'
import { availableToPromise, isLowStock, stockHealth } from '../../../shared/inventoryRules'

type Db = PrismaClient

export async function listInventory(db: Db): Promise<InventoryRow[]> {
  const items = await db.inventoryItem.findMany({
    include: {
      sku: { include: { product: true } },
      warehouse: true,
    },
    orderBy: [{ warehouseId: 'asc' }, { skuId: 'asc' }],
  })

  return items.map((item) => {
    const available = availableToPromise(item)

    return {
      id: item.id,
      warehouseCode: item.warehouse.code,
      warehouseName: item.warehouse.name,
      skuId: item.skuId,
      skuCode: item.sku.skuCode,
      skuName: item.sku.name,
      productName: item.sku.product.name,
      onHand: item.onHand,
      reserved: item.reserved,
      available,
      reorderPoint: item.reorderPoint,
      safetyStock: item.safetyStock,
      health: stockHealth(item),
    }
  })
}

export async function listLowStockAlerts(db: Db): Promise<LowStockAlertDto[]> {
  const inventory = await listInventory(db)

  return inventory
    .filter((item) =>
      isLowStock({
        skuId: item.skuId,
        warehouseId: item.warehouseCode,
        onHand: item.onHand,
        reserved: item.reserved,
        reorderPoint: item.reorderPoint,
        safetyStock: item.safetyStock,
      }),
    )
    .map((item) => ({
      inventoryItemId: item.id,
      skuCode: item.skuCode,
      skuName: item.skuName,
      warehouseCode: item.warehouseCode,
      available: item.available,
      reorderPoint: item.reorderPoint,
      suggestedPurchaseQty: Math.max(item.reorderPoint * 2 - item.available, item.safetyStock),
    }))
}
