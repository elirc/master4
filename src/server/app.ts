import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { prisma } from './db'
import { getDashboard } from './modules/dashboard/dashboard.service'
import { listShipments } from './modules/fulfillment/fulfillment.service'
import { listInventory, listLowStockAlerts } from './modules/inventory/inventory.service'
import { listSalesOrders, reserveSalesOrder } from './modules/orders/orders.service'
import { authenticateRequest, requireRole } from './modules/platform/auth'
import { listAuditLogs } from './modules/platform/audit.service'
import { inventoryCsv } from './modules/platform/export.service'
import { listPurchaseOrders } from './modules/purchasing/purchasing.service'
import { runReconciliation } from './modules/worker/reconciliation.service'

const orderIdParams = z.object({ orderId: z.string().min(1) })

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'atlas-fulfillment-api' })
  })

  app.use(authenticateRequest)

  app.get('/api/dashboard', async (_request, response, next) => {
    try {
      response.json(await getDashboard(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/inventory', async (_request, response, next) => {
    try {
      response.json(await listInventory(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/orders', async (_request, response, next) => {
    try {
      response.json(await listSalesOrders(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/orders/:orderId/reserve', requireRole(['warehouse_manager', 'admin']), async (request, response, next) => {
    try {
      const params = orderIdParams.parse(request.params)
      response.json(await reserveSalesOrder(prisma, params.orderId))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/purchase-orders', async (_request, response, next) => {
    try {
      response.json(await listPurchaseOrders(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/shipments', async (_request, response, next) => {
    try {
      response.json(await listShipments(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/alerts/low-stock', async (_request, response, next) => {
    try {
      response.json(await listLowStockAlerts(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/audit-logs', requireRole(['admin']), async (_request, response, next) => {
    try {
      response.json(await listAuditLogs(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/exports/inventory.csv', requireRole(['buyer', 'warehouse_manager', 'admin']), async (_request, response, next) => {
    try {
      response.setHeader('content-type', 'text/csv')
      response.setHeader('content-disposition', 'attachment; filename="inventory.csv"')
      response.send(await inventoryCsv(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/worker/reconcile', requireRole(['warehouse_manager', 'admin']), async (_request, response, next) => {
    try {
      response.json(await runReconciliation(prisma))
    } catch (error) {
      next(error)
    }
  })

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: 'Invalid request', details: error.issues })
      return
    }

    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  })

  return app
}
