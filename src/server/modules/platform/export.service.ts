import type { PrismaClient } from '@prisma/client'
import { listInventory } from '../inventory/inventory.service'

function csvCell(value: string | number) {
  const text = String(value)
  return text.includes(',') || text.includes('"') ? `"${text.replaceAll('"', '""')}"` : text
}

export async function inventoryCsv(db: PrismaClient) {
  const rows = await listInventory(db)
  const header = ['warehouse', 'sku', 'name', 'on_hand', 'reserved', 'available', 'reorder_point', 'health']
  const body = rows.map((row) =>
    [
      row.warehouseCode,
      row.skuCode,
      row.skuName,
      row.onHand,
      row.reserved,
      row.available,
      row.reorderPoint,
      row.health,
    ]
      .map(csvCell)
      .join(','),
  )

  return [header.join(','), ...body].join('\n')
}
