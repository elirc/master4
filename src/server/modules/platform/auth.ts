import type { NextFunction, Request, Response } from 'express'
import type { User } from '@prisma/client'
import { defaultTenantId, prisma, systemUserId } from '../../db'

const roleRank: Record<string, number> = {
  viewer: 0,
  buyer: 1,
  warehouse_associate: 1,
  warehouse_manager: 2,
  admin: 3,
}

export interface AuthenticatedRequest extends Request {
  actor?: User
}

export async function authenticateRequest(request: AuthenticatedRequest, _response: Response, next: NextFunction) {
  const requestedUserId = request.header('x-user-id') ?? systemUserId
  const actor = await prisma.user.findFirst({
    where: { id: requestedUserId, tenantId: defaultTenantId },
  })

  if (!actor) {
    next(new Error('Authenticated user was not found.'))
    return
  }

  request.actor = actor
  next()
}

export function requireRole(allowedRoles: string[]) {
  const minimumRank = Math.min(...allowedRoles.map((role) => roleRank[role] ?? 99))

  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const actorRank = roleRank[request.actor?.role ?? 'viewer'] ?? 0

    if (actorRank < minimumRank) {
      response.status(403).json({ error: 'Forbidden', requiredRoles: allowedRoles })
      return
    }

    next()
  }
}
