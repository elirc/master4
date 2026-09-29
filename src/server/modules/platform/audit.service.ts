import type { PrismaClient } from '@prisma/client'
import { defaultTenantId } from '../../db'

export async function listAuditLogs(db: PrismaClient) {
  return db.auditLog.findMany({
    where: { tenantId: defaultTenantId },
    orderBy: [{ createdAt: 'desc' }],
    take: 25,
  })
}
