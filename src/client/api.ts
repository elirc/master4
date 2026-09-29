import type { AuditLogDto, DashboardDto, ReservationResultDto } from '../shared/apiContracts'

export async function fetchDashboard(): Promise<DashboardDto> {
  const response = await fetch('/api/dashboard')

  if (!response.ok) {
    throw new Error('Unable to load operations dashboard.')
  }

  return response.json() as Promise<DashboardDto>
}

export async function reserveOrder(orderId: string): Promise<ReservationResultDto> {
  const response = await fetch(`/api/orders/${orderId}/reserve`, { method: 'POST' })

  if (!response.ok) {
    throw new Error('Unable to reserve order.')
  }

  return response.json() as Promise<ReservationResultDto>
}

export async function runReconciliation() {
  const response = await fetch('/api/worker/reconcile', { method: 'POST' })

  if (!response.ok) {
    throw new Error('Unable to run reconciliation.')
  }

  return response.json() as Promise<{ alerts: number; createdNotifications: number }>
}

export async function fetchAuditLogs(): Promise<AuditLogDto[]> {
  const response = await fetch('/api/audit-logs')

  if (!response.ok) {
    throw new Error('Unable to load audit logs.')
  }

  return response.json() as Promise<AuditLogDto[]>
}
