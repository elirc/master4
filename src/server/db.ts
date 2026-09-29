import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export const defaultTenantId = 'tenant-atlas'
export const systemUserId = 'user-ops-admin'
