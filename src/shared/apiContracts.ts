export interface DashboardMetric {
  label: string
  value: string
  tone: 'neutral' | 'good' | 'warning' | 'danger'
}

export interface InventoryRow {
  id: string
  warehouseCode: string
  warehouseName: string
  skuId: string
  skuCode: string
  skuName: string
  productName: string
  onHand: number
  reserved: number
  available: number
  reorderPoint: number
  safetyStock: number
  health: 'healthy' | 'low' | 'stockout'
}

export interface OrderLineDto {
  skuCode: string
  skuName: string
  quantity: number
}

export interface SalesOrderDto {
  id: string
  orderNumber: string
  customerName: string
  channel: string
  status: string
  paymentStatus: string
  priority: string
  warehouseCode: string
  promisedShipBy: string
  lines: OrderLineDto[]
}

export interface PurchaseOrderDto {
  id: string
  poNumber: string
  supplierName: string
  warehouseCode: string
  status: string
  expectedAt: string
  totalUnits: number
  receivedUnits: number
}

export interface ShipmentDto {
  id: string
  shipmentNumber: string
  orderNumber: string
  carrier: string
  serviceLevel: string
  trackingCode: string
  status: string
}

export interface LowStockAlertDto {
  inventoryItemId: string
  skuCode: string
  skuName: string
  warehouseCode: string
  available: number
  reorderPoint: number
  suggestedPurchaseQty: number
}

export interface DashboardDto {
  metrics: DashboardMetric[]
  inventory: InventoryRow[]
  salesOrders: SalesOrderDto[]
  purchaseOrders: PurchaseOrderDto[]
  shipments: ShipmentDto[]
  lowStockAlerts: LowStockAlertDto[]
}

export interface ReservationResultDto {
  ok: boolean
  orderId: string
  status: string
  failures: Array<{
    skuId: string
    requested: number
    available: number
    reason: string
  }>
}

export interface AuditLogDto {
  id: string
  actorId: string
  action: string
  entityType: string
  entityId: string
  metadata: string
  createdAt: string
}
