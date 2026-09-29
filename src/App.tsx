import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  FileDown,
  HeartPulse,
  PackageCheck,
  PackageSearch,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { fallbackDashboard } from './client/fallbackData'
import { fetchAuditLogs, fetchDashboard, reserveOrder, runReconciliation } from './client/api'
import type { AuditLogDto, DashboardDto, InventoryRow, SalesOrderDto } from './shared/apiContracts'
import './styles.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'orders', label: 'Sales orders', icon: ShoppingCart },
  { id: 'purchasing', label: 'Purchasing', icon: ClipboardList },
  { id: 'fulfillment', label: 'Fulfillment', icon: Truck },
  { id: 'admin', label: 'Admin', icon: Settings },
]

export function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [dashboard, setDashboard] = useState<DashboardDto>(fallbackDashboard)
  const [query, setQuery] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [statusMessage, setStatusMessage] = useState('Loading API-backed operations data...')
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      setDashboard(await fetchDashboard())
      setAuditLogs(await fetchAuditLogs())
      setStatusMessage('Connected to API and database.')
    } catch (error) {
      setDashboard(fallbackDashboard)
      setStatusMessage(error instanceof Error ? `${error.message} Showing local fallback data.` : 'Showing fallback data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const warehouses = useMemo(
    () => Array.from(new Set(dashboard.inventory.map((item) => item.warehouseCode))),
    [dashboard.inventory],
  )
  const filteredInventory = dashboard.inventory.filter((item) => {
    const matchesWarehouse = warehouseFilter === 'all' || item.warehouseCode === warehouseFilter
    const haystack = `${item.skuCode} ${item.skuName} ${item.productName} ${item.warehouseCode}`.toLowerCase()
    return matchesWarehouse && haystack.includes(query.toLowerCase())
  })

  async function handleReserve(order: SalesOrderDto) {
    const result = await reserveOrder(order.id)
    setStatusMessage(
      result.ok
        ? `${order.orderNumber} is now ${result.status}.`
        : `${order.orderNumber} could not reserve: ${result.failures[0]?.reason ?? 'unknown failure'}`,
    )
    await refresh()
  }

  async function handleReconcile() {
    const result = await runReconciliation()
    setStatusMessage(`Reconciliation found ${result.alerts} alerts and created ${result.createdNotifications} notifications.`)
    await refresh()
  }

  return (
    <div className="ops-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">AF</div>
          <div>
            <strong>Atlas Fulfillment</strong>
            <span>Enterprise operations</span>
          </div>
        </div>
        <nav aria-label="Operations navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={clsx('nav-item', activeView === item.id && 'selected')}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                <Icon size={17} />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="operator-card">
          <ShieldCheck size={18} />
          <div>
            <strong>Renee Alvarez</strong>
            <span>Admin · tenant-atlas</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">Warehouse and ecommerce operations</span>
            <h1>{navItems.find((item) => item.id === activeView)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={handleReconcile} type="button">
              <Play size={16} />
              Reconcile
            </button>
            <button className="secondary-button" onClick={refresh} type="button">
              <RefreshCw size={16} className={clsx(loading && 'spin')} />
              Refresh
            </button>
          </div>
        </header>

        <div className="status-strip">
          <HeartPulse size={16} />
          <span>{statusMessage}</span>
        </div>

        {activeView === 'dashboard' ? <DashboardView dashboard={dashboard} /> : null}
        {activeView === 'inventory' ? (
          <InventoryView
            inventory={filteredInventory}
            query={query}
            setQuery={setQuery}
            setWarehouseFilter={setWarehouseFilter}
            warehouseFilter={warehouseFilter}
            warehouses={warehouses}
          />
        ) : null}
        {activeView === 'orders' ? <OrdersView orders={dashboard.salesOrders} onReserve={handleReserve} /> : null}
        {activeView === 'purchasing' ? <PurchasingView dashboard={dashboard} /> : null}
        {activeView === 'fulfillment' ? <FulfillmentView dashboard={dashboard} /> : null}
        {activeView === 'admin' ? <AdminView auditLogs={auditLogs} dashboard={dashboard} /> : null}
      </main>
    </div>
  )
}

function DashboardView({ dashboard }: { dashboard: DashboardDto }) {
  return (
    <section className="page-grid">
      <div className="metric-grid">
        {dashboard.metrics.map((metric) => (
          <article className={clsx('metric-card', metric.tone)} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>
      <section className="panel large">
        <PanelTitle icon={AlertTriangle} title="Exception queue" />
        <div className="alert-list">
          {dashboard.lowStockAlerts.map((alert) => (
            <div className="alert-row" key={alert.inventoryItemId}>
              <div>
                <strong>{alert.skuCode}</strong>
                <span>{alert.skuName} · {alert.warehouseCode}</span>
              </div>
              <div>
                <strong>{alert.available}</strong>
                <span>available</span>
              </div>
              <div>
                <strong>{alert.suggestedPurchaseQty}</strong>
                <span>suggested buy</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={PackageCheck} title="Fulfillment pressure" />
        {dashboard.salesOrders.map((order) => (
          <OrderMiniRow key={order.id} order={order} />
        ))}
      </section>
    </section>
  )
}

interface InventoryViewProps {
  inventory: InventoryRow[]
  query: string
  warehouseFilter: string
  warehouses: string[]
  setQuery: (query: string) => void
  setWarehouseFilter: (warehouse: string) => void
}

function InventoryView({ inventory, query, warehouseFilter, warehouses, setQuery, setWarehouseFilter }: InventoryViewProps) {
  return (
    <section className="panel full">
      <div className="table-toolbar">
        <PanelTitle icon={PackageSearch} title="Inventory balances" />
        <div className="filters">
          <label className="search-box">
            <Search size={16} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU, product, warehouse" value={query} />
          </label>
          <select onChange={(event) => setWarehouseFilter(event.target.value)} value={warehouseFilter}>
            <option value="all">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse} value={warehouse}>
                {warehouse}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="data-table inventory-table">
        <div className="table-row table-head">
          <span>SKU</span>
          <span>Warehouse</span>
          <span>On hand</span>
          <span>Reserved</span>
          <span>Available</span>
          <span>Health</span>
        </div>
        {inventory.map((item) => (
          <div className="table-row" key={item.id}>
            <span>
              <strong>{item.skuCode}</strong>
              <em>{item.skuName}</em>
            </span>
            <span>
              <strong>{item.warehouseCode}</strong>
              <em>{item.warehouseName}</em>
            </span>
            <strong>{item.onHand}</strong>
            <strong>{item.reserved}</strong>
            <strong>{item.available}</strong>
            <span className={clsx('status-pill', item.health)}>{item.health}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function OrdersView({ orders, onReserve }: { orders: SalesOrderDto[]; onReserve: (order: SalesOrderDto) => void }) {
  return (
    <section className="panel full">
      <PanelTitle icon={ShoppingCart} title="Sales order queue" />
      <div className="order-grid">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-card-header">
              <div>
                <strong>{order.orderNumber}</strong>
                <span>{order.customerName} · {order.channel}</span>
              </div>
              <span className={clsx('status-pill', order.status)}>{order.status}</span>
            </div>
            <div className="line-list">
              {order.lines.map((line) => (
                <div key={`${order.id}-${line.skuCode}`}>
                  <span>{line.skuCode}</span>
                  <strong>{line.quantity}</strong>
                </div>
              ))}
            </div>
            <div className="order-card-footer">
              <span>{order.warehouseCode} · ship by {formatDate(order.promisedShipBy)}</span>
              <button disabled={order.status !== 'pending_reservation'} onClick={() => onReserve(order)} type="button">
                Reserve
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function PurchasingView({ dashboard }: { dashboard: DashboardDto }) {
  return (
    <section className="two-column">
      <section className="panel">
        <PanelTitle icon={ClipboardList} title="Purchase orders" />
        {dashboard.purchaseOrders.map((purchaseOrder) => (
          <div className="work-row" key={purchaseOrder.id}>
            <div>
              <strong>{purchaseOrder.poNumber}</strong>
              <span>{purchaseOrder.supplierName} · {purchaseOrder.warehouseCode}</span>
            </div>
            <div>
              <strong>{purchaseOrder.receivedUnits}/{purchaseOrder.totalUnits}</strong>
              <span>{purchaseOrder.status}</span>
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <PanelTitle icon={ArrowDownUp} title="Suggested purchasing" />
        {dashboard.lowStockAlerts.map((alert) => (
          <div className="work-row" key={alert.inventoryItemId}>
            <div>
              <strong>{alert.skuCode}</strong>
              <span>{alert.warehouseCode} below reorder point {alert.reorderPoint}</span>
            </div>
            <div>
              <strong>{alert.suggestedPurchaseQty}</strong>
              <span>units</span>
            </div>
          </div>
        ))}
      </section>
    </section>
  )
}

function FulfillmentView({ dashboard }: { dashboard: DashboardDto }) {
  return (
    <section className="two-column">
      <section className="panel">
        <PanelTitle icon={Truck} title="Shipments" />
        {dashboard.shipments.map((shipment) => (
          <div className="work-row" key={shipment.id}>
            <div>
              <strong>{shipment.shipmentNumber}</strong>
              <span>{shipment.orderNumber} · {shipment.carrier} {shipment.serviceLevel}</span>
            </div>
            <div>
              <strong>{shipment.status}</strong>
              <span>{shipment.trackingCode}</span>
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <PanelTitle icon={CheckCircle2} title="Pick readiness" />
        {dashboard.salesOrders.map((order) => (
          <OrderMiniRow key={order.id} order={order} />
        ))}
      </section>
    </section>
  )
}

function AdminView({ auditLogs, dashboard }: { auditLogs: AuditLogDto[]; dashboard: DashboardDto }) {
  return (
    <section className="two-column">
      <section className="panel">
        <PanelTitle icon={Database} title="System records" />
        <div className="admin-grid">
          <AdminStat icon={Building2} label="Warehouses" value={new Set(dashboard.inventory.map((item) => item.warehouseCode)).size.toString()} />
          <AdminStat icon={Boxes} label="Inventory balances" value={dashboard.inventory.length.toString()} />
          <AdminStat icon={ShoppingCart} label="Sales orders" value={dashboard.salesOrders.length.toString()} />
          <AdminStat icon={ClipboardList} label="Purchase orders" value={dashboard.purchaseOrders.length.toString()} />
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={FileDown} title="Operational exports" />
        <a className="wide-action" href="/api/exports/inventory.csv">Export inventory CSV</a>
        <button className="wide-action" type="button">Export order queue CSV</button>
        <button className="wide-action" type="button">Download audit trail</button>
      </section>
      <section className="panel full">
        <PanelTitle icon={ShieldCheck} title="Recent audit records" />
        <div className="audit-list">
          {auditLogs.length === 0 ? <p className="empty-note">No audit records loaded yet.</p> : null}
          {auditLogs.map((log) => (
            <div className="work-row" key={log.id}>
              <div>
                <strong>{log.action}</strong>
                <span>{log.entityType} · {log.entityId}</span>
              </div>
              <div>
                <strong>{log.actorId}</strong>
                <span>{formatDate(log.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Boxes; title: string }) {
  return (
    <div className="panel-title">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  )
}

function OrderMiniRow({ order }: { order: SalesOrderDto }) {
  return (
    <div className="work-row">
      <div>
        <strong>{order.orderNumber}</strong>
        <span>{order.customerName} · {order.lines.length} line(s)</span>
      </div>
      <span className={clsx('status-pill', order.status)}>{order.status}</span>
    </div>
  )
}

function AdminStat({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return (
    <div className="admin-stat">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}
