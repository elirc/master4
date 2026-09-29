import { existsSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const dbPath = fileURLToPath(new URL('./dev.db', import.meta.url))

if (existsSync(dbPath)) {
  unlinkSync(dbPath)
}

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
CREATE TABLE Tenant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE User (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
CREATE UNIQUE INDEX User_tenantId_email_key ON User(tenantId, email);
CREATE INDEX User_tenantId_role_idx ON User(tenantId, role);

CREATE TABLE Warehouse (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  timezone TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
CREATE UNIQUE INDEX Warehouse_tenantId_code_key ON Warehouse(tenantId, code);

CREATE TABLE Supplier (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  contactEmail TEXT NOT NULL,
  reliability INTEGER NOT NULL,
  leadTimeDays INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
CREATE UNIQUE INDEX Supplier_tenantId_name_key ON Supplier(tenantId, name);

CREATE TABLE Product (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
CREATE INDEX Product_tenantId_category_idx ON Product(tenantId, category);

CREATE TABLE Sku (
  id TEXT PRIMARY KEY,
  productId TEXT NOT NULL,
  skuCode TEXT NOT NULL,
  barcode TEXT NOT NULL,
  name TEXT NOT NULL,
  unitCostCents INTEGER NOT NULL,
  priceCents INTEGER NOT NULL,
  weightGrams INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY (productId) REFERENCES Product(id)
);
CREATE UNIQUE INDEX Sku_skuCode_key ON Sku(skuCode);
CREATE UNIQUE INDEX Sku_barcode_key ON Sku(barcode);
CREATE INDEX Sku_productId_idx ON Sku(productId);

CREATE TABLE InventoryItem (
  id TEXT PRIMARY KEY,
  warehouseId TEXT NOT NULL,
  skuId TEXT NOT NULL,
  onHand INTEGER NOT NULL,
  reserved INTEGER NOT NULL,
  reorderPoint INTEGER NOT NULL,
  safetyStock INTEGER NOT NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId) REFERENCES Warehouse(id),
  FOREIGN KEY (skuId) REFERENCES Sku(id)
);
CREATE UNIQUE INDEX InventoryItem_warehouseId_skuId_key ON InventoryItem(warehouseId, skuId);
CREATE INDEX InventoryItem_skuId_idx ON InventoryItem(skuId);

CREATE TABLE SalesOrder (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  warehouseId TEXT NOT NULL,
  orderNumber TEXT NOT NULL,
  customerName TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  paymentStatus TEXT NOT NULL,
  priority TEXT NOT NULL,
  placedAt DATETIME NOT NULL,
  promisedShipBy DATETIME NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id),
  FOREIGN KEY (warehouseId) REFERENCES Warehouse(id)
);
CREATE UNIQUE INDEX SalesOrder_tenantId_orderNumber_key ON SalesOrder(tenantId, orderNumber);
CREATE INDEX SalesOrder_tenantId_status_idx ON SalesOrder(tenantId, status);

CREATE TABLE SalesOrderLine (
  id TEXT PRIMARY KEY,
  salesOrderId TEXT NOT NULL,
  skuId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unitPriceCents INTEGER NOT NULL,
  FOREIGN KEY (salesOrderId) REFERENCES SalesOrder(id),
  FOREIGN KEY (skuId) REFERENCES Sku(id)
);

CREATE TABLE StockReservation (
  id TEXT PRIMARY KEY,
  salesOrderId TEXT NOT NULL,
  skuId TEXT NOT NULL,
  warehouseId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesOrderId) REFERENCES SalesOrder(id)
);
CREATE INDEX StockReservation_warehouseId_skuId_status_idx ON StockReservation(warehouseId, skuId, status);

CREATE TABLE PurchaseOrder (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  supplierId TEXT NOT NULL,
  warehouseId TEXT NOT NULL,
  poNumber TEXT NOT NULL,
  status TEXT NOT NULL,
  expectedAt DATETIME NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplierId) REFERENCES Supplier(id),
  FOREIGN KEY (warehouseId) REFERENCES Warehouse(id)
);
CREATE UNIQUE INDEX PurchaseOrder_tenantId_poNumber_key ON PurchaseOrder(tenantId, poNumber);
CREATE INDEX PurchaseOrder_tenantId_status_idx ON PurchaseOrder(tenantId, status);

CREATE TABLE PurchaseOrderLine (
  id TEXT PRIMARY KEY,
  purchaseOrderId TEXT NOT NULL,
  skuId TEXT NOT NULL,
  orderedQty INTEGER NOT NULL,
  receivedQty INTEGER NOT NULL,
  unitCostCents INTEGER NOT NULL,
  FOREIGN KEY (purchaseOrderId) REFERENCES PurchaseOrder(id),
  FOREIGN KEY (skuId) REFERENCES Sku(id)
);

CREATE TABLE Shipment (
  id TEXT PRIMARY KEY,
  salesOrderId TEXT NOT NULL,
  warehouseId TEXT NOT NULL,
  shipmentNumber TEXT NOT NULL,
  carrier TEXT NOT NULL,
  serviceLevel TEXT NOT NULL,
  trackingCode TEXT NOT NULL,
  status TEXT NOT NULL,
  shippedAt DATETIME,
  FOREIGN KEY (salesOrderId) REFERENCES SalesOrder(id),
  FOREIGN KEY (warehouseId) REFERENCES Warehouse(id)
);

CREATE TABLE Return (
  id TEXT PRIMARY KEY,
  salesOrderId TEXT NOT NULL,
  rmaNumber TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesOrderId) REFERENCES SalesOrder(id)
);
CREATE UNIQUE INDEX Return_rmaNumber_key ON Return(rmaNumber);

CREATE TABLE InventoryAdjustment (
  id TEXT PRIMARY KEY,
  warehouseId TEXT NOT NULL,
  skuId TEXT NOT NULL,
  quantityDelta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  referenceType TEXT NOT NULL,
  referenceId TEXT NOT NULL,
  createdById TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX InventoryAdjustment_warehouseId_skuId_createdAt_idx ON InventoryAdjustment(warehouseId, skuId, createdAt);

CREATE TABLE AuditLog (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  actorId TEXT NOT NULL,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  metadata TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
CREATE INDEX AuditLog_tenantId_entityType_entityId_idx ON AuditLog(tenantId, entityType, entityId);

CREATE TABLE DomainEvent (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  eventType TEXT NOT NULL,
  aggregateType TEXT NOT NULL,
  aggregateId TEXT NOT NULL,
  payload TEXT NOT NULL,
  occurredAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
CREATE INDEX DomainEvent_tenantId_eventType_occurredAt_idx ON DomainEvent(tenantId, eventType, occurredAt);

CREATE TABLE OutboxMessage (
  id TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  availableAt DATETIME NOT NULL,
  processedAt DATETIME,
  FOREIGN KEY (eventId) REFERENCES DomainEvent(id)
);
CREATE UNIQUE INDEX OutboxMessage_eventId_key ON OutboxMessage(eventId);

CREATE TABLE Notification (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX Notification_tenantId_userId_read_idx ON Notification(tenantId, userId, read);
`)

db.close()
console.log(`SQLite schema created at ${dbPath}`)
