import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/server/app'

const app = createApp()

describe('api', () => {
  it('reports health without authentication', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
  })

  it('returns dashboard metrics for the seeded tenant', async () => {
    const response = await request(app).get('/api/dashboard')

    expect(response.status).toBe(200)
    expect(response.body.metrics.length).toBeGreaterThan(0)
    expect(response.body.inventory.length).toBeGreaterThan(0)
  })

  it('exports inventory as CSV', async () => {
    const response = await request(app).get('/api/exports/inventory.csv')

    expect(response.status).toBe(200)
    expect(response.text).toContain('warehouse,sku,name,on_hand')
  })
})
