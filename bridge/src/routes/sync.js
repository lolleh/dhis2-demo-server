const express = require('express')

const router = express.Router()

module.exports = function (store, dhis2Client, openmrsClient, commcareClient) {
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
        if (mapping.direction === 'commcare2dhis2') {
            return executeCommcareSync(mapping)
        }
        if (mapping.mapping_type === 'aggregate') {
            return executeAggregateSync(mapping)
        }
        return executeTrackerSync(mapping)
    }

    async function executeAggregateSync(mapping) {
        const elementMappings = store.getElementMappings(mapping.id)
        const period = getPeriod(mapping.period_type || 'Monthly')
        const sourceOrgUnit = mapping.source_org_unit
        const targetOrgUnit = mapping.target_org_unit || sourceOrgUnit

        const sourceParams = new URLSearchParams({
            dataSet: mapping.source_data_set,
            orgUnit: sourceOrgUnit,
            period,
        })
        const sourceData = await dhis2Client.getDataValueSets(Object.fromEntries(sourceParams))

        const dataValues = sourceData.dataValues || []
        let processed = 0
        let failed = 0
        const targetValues = []

        if (elementMappings.length > 0) {
            for (const dv of dataValues) {
                const tm = elementMappings.find(m => m.source_element === dv.dataElement)
                if (tm) {
                    targetValues.push({
                        dataElement: tm.target_element,
                        orgUnit: targetOrgUnit,
                        period,
                        value: dv.value,
                    })
                    processed++
                }
            }
        } else {
            for (const dv of dataValues) {
                targetValues.push({
                    dataElement: dv.dataElement,
                    orgUnit: targetOrgUnit,
                    period,
                    value: dv.value,
                })
                processed++
            }
        }

        if (targetValues.length > 0) {
            try {
                await dhis2Client.dataValueSets(targetValues, mapping.target_data_set, targetOrgUnit, period)
            } catch (e) {
                failed = targetValues.length
                throw new Error(`Failed to post data values: ${e.message}`)
            }
        }

        return { processed, failed }
    }

    async function executeTrackerSync(mapping) {
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

    async function executeCommcareSync(mapping) {
        const elementMappings = store.getElementMappings(mapping.id)
        const period = getPeriod(mapping.period_type || 'Monthly')
        const targetOrgUnit = mapping.target_org_unit || mapping.source_org_unit
        const formXmlns = mapping.commcare_form_xmlns
        const targetDataSet = mapping.target_data_set

        if (!formXmlns || !targetDataSet || !targetOrgUnit) {
            throw new Error('commcare_form_xmlns, target_data_set, and target_org_unit are required')
        }

        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const startDate = `${y}-${m}-01`
        const endDate = new Date(y, now.getMonth() + 1, 0).toISOString().slice(0, 10)

        const data = await commcareClient.getFormSubmissions(formXmlns, startDate, endDate, 1000)
        const submissions = data.objects || []

        const aggregated = {}
        let processed = 0
        let failed = 0

        for (const sub of submissions) {
            try {
                const detail = await commcareClient.getFormSubmissionDetail(sub.id)
                const flat = commcareClient.parseFormData(detail)

                if (elementMappings.length > 0) {
                    for (const em of elementMappings) {
                        const val = flat[em.source_element]
                        if (val !== undefined && val !== null) {
                            const key = em.target_element
                            aggregated[key] = (aggregated[key] || 0) + Number(val)
                            processed++
                        }
                    }
                } else {
                    for (const [key, val] of Object.entries(flat)) {
                        const k = `${targetDataSet}:${key}`
                        aggregated[k] = (aggregated[k] || 0) + Number(val)
                    }
                    processed += Object.keys(flat).length
                }
            } catch (e) {
                failed++
            }
        }

        const targetValues = []
        for (const [dataElement, value] of Object.entries(aggregated)) {
            targetValues.push({
                dataElement,
                orgUnit: targetOrgUnit,
                period,
                value: String(Math.round(value)),
            })
        }

        if (targetValues.length > 0) {
            try {
                await dhis2Client.dataValueSets(targetValues, targetDataSet, targetOrgUnit, period)
            } catch (e) {
                failed = targetValues.length
                throw new Error(`Failed to post data values: ${e.message}`)
            }
        }

        return { processed, failed }
    }

    return router
}

function getPeriod(periodType) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    switch (periodType) {
        case 'Yearly':
            return String(y)
        case 'Quarterly':
            return `${y}Q${Math.ceil((now.getMonth() + 1) / 3)}`
        case 'Monthly':
        default:
            return `${y}${m}`
    }
}
