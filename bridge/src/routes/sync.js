const express = require('express')

const router = express.Router()

module.exports = function (store, dhis2Client, openmrsClient) {
    router.post('/run/:mappingId', async (req, res) => {
        const mapping = store.getMapping(Number(req.params.mappingId))
        if (!mapping) return res.status(404).json({ error: 'Mapping not found' })

        const logId = store.createSyncLog({ mapping_id: mapping.id, status: 'running' })

        try {
            const result = await executeSync(mapping)
            store.updateSyncLog(logId, {
                status: 'success',
                records_processed: result.processed,
                records_failed: result.failed,
            })
            res.json({ logId, ...result })
        } catch (e) {
            store.updateSyncLog(logId, { status: 'failed', error: e.message })
            res.status(500).json({ logId, error: e.message })
        }
    })

    router.get('/logs', (req, res) => {
        const { mappingId, limit } = req.query
        res.json(store.getSyncLogs(mappingId ? Number(mappingId) : null, limit ? Number(limit) : 50))
    })

    router.get('/logs/:id', (req, res) => {
        const logs = store.getSyncLogs(null, 1000)
        const log = logs.find(l => l.id === Number(req.params.id))
        if (!log) return res.status(404).json({ error: 'Log not found' })
        res.json(log)
    })

    async function executeSync(mapping) {
        const fieldMappings = JSON.parse(mapping.field_mappings || '{}')
        let sourceData = []

        if (mapping.direction === 'omrs2dhis2') {
            switch (mapping.source_resource) {
                case 'patient':
                    sourceData = (await openmrsClient.patients()).results || []
                    break
                case 'encounter':
                    sourceData = (await openmrsClient.encounters()).results || []
                    break
                case 'observation':
                    sourceData = (await openmrsClient.observations()).results || []
                    break
                default:
                    throw new Error(`Unknown source resource: ${mapping.source_resource}`)
            }
        } else {
            switch (mapping.source_resource) {
                case 'trackedEntityInstance':
                    sourceData = (await dhis2Client.trackedEntityInstances()).trackedEntityInstances || []
                    break
                case 'event':
                    sourceData = (await dhis2Client.events()).events || []
                    break
                default:
                    throw new Error(`Unknown source resource: ${mapping.source_resource}`)
            }
        }

        return { processed: sourceData.length, failed: 0 }
    }

    return router
}
