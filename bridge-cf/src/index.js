import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Dhis2Client } from './clients/dhis2.js'
import { OpenmrsClient } from './clients/openmrs.js'
import { createStore } from './db.js'

const app = new Hono()

app.use('/*', cors())

app.get('/', (c) => {
    return c.json({
        name: 'Interop Bridge',
        version: '1.0.0',
        author: 'vlolleh',
        description: 'DHIS2-OpenMRS interoperability bridge',
        endpoints: [
            'GET  /api/status/health     - System health check',
            'GET  /api/status/dhis2      - DHIS2 info',
            'GET  /api/status/openmrs    - OpenMRS info',
            'GET  /api/mappings          - List mappings',
            'POST /api/mappings          - Create mapping',
            'GET  /api/mappings/:id      - Get mapping',
            'PUT  /api/mappings/:id      - Update mapping',
            'DELETE /api/mappings/:id    - Delete mapping',
            'POST /api/sync/run/:mappingId - Execute sync',
            'GET  /api/sync/logs         - Sync logs',
        ]
    })
})

// Status routes
app.get('/api/status/health', async (c) => {
    const { dhis2: d2, openmrs: omrs } = getClients(c)
    const status = { bridge: 'ok', dhis2: 'unknown', openmrs: 'unknown' }

    try {
        const info = await d2.systemInfo()
        status.dhis2 = { ok: true, version: info.version, revision: info.revision }
    } catch (e) {
        status.dhis2 = { ok: false, error: e.message }
    }

    try {
        const info = await omrs.systemInfo()
        status.openmrs = { ok: true, info }
    } catch (e) {
        status.openmrs = { ok: false, error: e.message }
    }

    return c.json(status)
})

app.get('/api/status/dhis2', async (c) => {
    const { dhis2 } = getClients(c)
    try {
        const [system, dataElements, orgUnits, programs] = await Promise.all([
            dhis2.systemInfo(),
            dhis2.dataElements({ pageSize: 10 }),
            dhis2.organisationUnits({ pageSize: 10 }),
            dhis2.programs({ pageSize: 10 }),
        ])
        return c.json({ system, dataElements, organisationUnits: orgUnits, programs })
    } catch (e) {
        return c.json({ error: e.message }, 500)
    }
})

app.get('/api/status/openmrs', async (c) => {
    const { openmrs } = getClients(c)
    try {
        const [patients, concepts] = await Promise.all([
            openmrs.patients({ limit: 5 }),
            openmrs.concepts({ limit: 10 }),
        ])
        return c.json({ patients, concepts })
    } catch (e) {
        return c.json({ error: e.message }, 500)
    }
})

// Mappings routes
app.get('/api/mappings', (c) => {
    const store = createStore(c.env.DB)
    return c.json(store.getMappings())
})

app.get('/api/mappings/:id', (c) => {
    const store = createStore(c.env.DB)
    const mapping = store.getMapping(Number(c.req.param('id')))
    if (!mapping) return c.json({ error: 'Mapping not found' }, 404)
    return c.json(mapping)
})

app.post('/api/mappings', async (c) => {
    const store = createStore(c.env.DB)
    const body = await c.req.json()
    const { name, direction, source_resource, target_resource, field_mappings, schedule } = body
    if (!name || !direction || !source_resource || !target_resource) {
        return c.json({ error: 'name, direction, source_resource, and target_resource are required' }, 400)
    }
    const mapping = store.createMapping({ name, direction, source_resource, target_resource, field_mappings, schedule })
    return c.json(mapping, 201)
})

app.put('/api/mappings/:id', async (c) => {
    const store = createStore(c.env.DB)
    const body = await c.req.json()
    const mapping = store.updateMapping(Number(c.req.param('id')), body)
    if (!mapping) return c.json({ error: 'Mapping not found' }, 404)
    return c.json(mapping)
})

app.delete('/api/mappings/:id', (c) => {
    const store = createStore(c.env.DB)
    store.deleteMapping(Number(c.req.param('id')))
    return c.body(null, 204)
})

// Sync routes
app.post('/api/sync/run/:mappingId', async (c) => {
    const store = createStore(c.env.DB)
    const { dhis2, openmrs } = getClients(c)
    const mapping = store.getMapping(Number(c.req.param('mappingId')))
    if (!mapping) return c.json({ error: 'Mapping not found' }, 404)

    const logId = store.createSyncLog({ mapping_id: mapping.id, status: 'running' })

    try {
        const result = await executeSync(mapping, dhis2, openmrs)
        store.updateSyncLog(logId, {
            status: 'success',
            records_processed: result.processed,
            records_failed: result.failed,
        })
        return c.json({ logId, ...result })
    } catch (e) {
        store.updateSyncLog(logId, { status: 'failed', error: e.message })
        return c.json({ logId, error: e.message }, 500)
    }
})

app.get('/api/sync/logs', (c) => {
    const store = createStore(c.env.DB)
    const mappingId = c.req.query('mappingId')
    const limit = c.req.query('limit')
    return c.json(store.getSyncLogs(mappingId ? Number(mappingId) : null, limit ? Number(limit) : 50))
})

app.get('/api/sync/logs/:id', (c) => {
    const store = createStore(c.env.DB)
    const logs = store.getSyncLogs(null, 1000)
    const log = logs.find(l => l.id === Number(c.req.param('id')))
    if (!log) return c.json({ error: 'Log not found' }, 404)
    return c.json(log)
})

async function executeSync(mapping, dhis2, openmrs) {
    const fieldMappings = JSON.parse(mapping.field_mappings || '{}')
    let sourceData = []

    if (mapping.direction === 'omrs2dhis2') {
        switch (mapping.source_resource) {
            case 'patient':
                sourceData = (await openmrs.patients()).results || []
                break
            case 'encounter':
                sourceData = (await openmrs.encounters()).results || []
                break
            case 'observation':
                sourceData = (await openmrs.observations()).results || []
                break
            default:
                throw new Error(`Unknown source resource: ${mapping.source_resource}`)
        }
    } else {
        switch (mapping.source_resource) {
            case 'trackedEntityInstance':
                sourceData = (await dhis2.trackedEntityInstances()).trackedEntityInstances || []
                break
            case 'event':
                sourceData = (await dhis2.events()).events || []
                break
            default:
                throw new Error(`Unknown source resource: ${mapping.source_resource}`)
        }
    }

    return { processed: sourceData.length, failed: 0 }
}

function getClients(c) {
    const dhis2 = new Dhis2Client(
        c.env.DHIS2_URL || 'http://localhost:8091',
        c.env.DHIS2_USERNAME || 'admin',
        c.env.DHIS2_PASSWORD || 'district'
    )
    const openmrs = new OpenmrsClient(
        c.env.OPENMRS_URL || 'http://openmrs:8080/openmrs',
        c.env.OPENMRS_USERNAME || 'admin',
        c.env.OPENMRS_PASSWORD || 'Admin123'
    )
    return { dhis2, openmrs }
}

export default app
