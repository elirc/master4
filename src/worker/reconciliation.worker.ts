import { prisma } from '../server/db'
import { runReconciliation } from '../server/modules/worker/reconciliation.service'

const result = await runReconciliation(prisma)
console.log(`Inventory reconciliation complete: ${result.alerts} alerts, ${result.createdNotifications} notifications created.`)
await prisma.$disconnect()
