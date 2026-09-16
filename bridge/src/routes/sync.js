const express = require('express')

const router = express.Router()

module.exports = function (store, dhis2Client, openmrsClient, commcareClient, openmrsSqlClient) {
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
        if (mapping.direction === 'omrs2dhis2' && mapping.mapping_type === 'aggregate') {
            return executeOpenmrsAggregateSync(mapping)
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

    async function executeOpenmrsAggregateSync(mapping) {
        const elementMappings = store.getElementMappings(mapping.id)
        const period = getPeriod(mapping.period_type || 'Monthly')
        const formUuid = mapping.source_data_set
        const targetOrgUnit = mapping.target_org_unit || mapping.source_org_unit
        const targetDataSet = mapping.target_data_set

        if (!formUuid) {
            throw new Error('source_data_set (OpenMRS form UUID) is required')
        }
        if (!targetDataSet) {
            throw new Error('target_data_set (DHIS2 data set ID) is required')
        }

        const { startDate, endDate } = getDateRange(mapping.period_type || 'Monthly')

        const encounters = await encounterSource(mapping).formEncounters(formUuid, startDate, endDate, 5000)

        const aggregated = {}
        let processed = 0
        let failed = 0

        for (const encounter of encounters) {
            const obsList = encounter.obs || []
            for (const obs of obsList) {
                const conceptUuid = obs.concept && obs.concept.uuid
                if (!conceptUuid) continue

                const value = extractObsValue(obs)
                if (value === null || value === undefined) continue

                if (elementMappings.length > 0) {
                    const em = elementMappings.find(m => m.source_element === conceptUuid)
                    if (em) {
                        aggregateValue(aggregated, em.target_element, value, em.transformation || 'direct')
                        processed++
                    }
                } else {
                    const key = `${targetDataSet}:${conceptUuid}`
                    aggregateValue(aggregated, key, value, 'count')
                    processed++
                }
            }
        }

        const targetValues = []
        for (const [dataElement, agg] of Object.entries(aggregated)) {
            let finalValue
            if (agg && typeof agg === 'object' && 'sum' in agg) {
                finalValue = agg.count > 0 ? Math.round(agg.sum / agg.count * 100) / 100 : 0
            } else {
                finalValue = agg
            }
            targetValues.push({
                dataElement,
                orgUnit: targetOrgUnit,
                period,
                value: String(finalValue),
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

        return { processed, failed, encounters: encounters.length }
    }

    async function executeTrackerSync(mapping) {
        const fieldMappings = JSON.parse(mapping.field_mappings || '{}')
        const elementMappings = store.getElementMappings(mapping.id)
        let sourceData = []

        if (mapping.direction === 'omrs2dhis2') {
            switch (mapping.source_resource) {
                case 'patient': {
                    // Requires a search term (or a patient/identifier query)
                    // because patient collection GETs are unsupported in the demo image.
                    const q = mapping.search_term || mapping.identifier
                    if (!q) {
                        throw new Error(
                            'For omrs2dhis2 patient sync, set mapping.search_term (OpenMRS patient search) '
                            + 'or mapping.identifier so the list can be fetched.'
                        )
                    }
                    sourceData = (await openmrsClient.patients({ q })).results || []
                    break
                }
                case 'encounter':
                    if (mapping.source_data_set) {
                        // Prefer a form-based fetch: source_data_set holds the
                        // OpenMRS form UUID (same convention as the omrs2dhis2
                        // aggregate path). Collects every encounter of that
                        // form across patients. May be served from the REST API
                        // or, when mapping.source_db = 'mysql', direct from the
                        // OpenMRS database.
                        sourceData = await encounterSource(mapping).formEncounters(mapping.source_data_set, null, null, 5000)
                    } else if (mapping.patient_uuid) {
                        sourceData = (await openmrsClient.encounters({ patient: mapping.patient_uuid })).results || []
                    } else if (mapping.search_term) {
                        sourceData = (await openmrsClient.encounters({ q: mapping.search_term })).results || []
                    } else {
                        throw new Error(
                            'For omrs2dhis2 encounter sync, set mapping.source_data_set (OpenMRS form UUID), '
                            + 'mapping.patient_uuid (an OpenMRS patient UUID) '
                            + 'or mapping.search_term so the list can be fetched.'
                        )
                    }
                    break
                case 'observation': {
                    if (!mapping.observation_uuid) {
                        throw new Error(
                            'For omrs2dhis2 observation sync, set mapping.observation_uuid '
                            + '(an OpenMRS observation UUID) to fetch a single observation.'
                        )
                    }
                    const obs = await openmrsClient.observations({ uuid: mapping.observation_uuid })
                    sourceData = obs.uuid ? [obs] : (obs.results || [])
                    break
                }
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

        // For omrs2dhis2, write the OpenMRS data back into a DHIS2 program as
        // tracker events (the demo DHIS2 data sets have no usable
        // data-element associations, so the aggregate path cannot post).
        if (mapping.direction === 'omrs2dhis2' && mapping.target_program) {
            return storeOpenmrsAsTrackerEvents(mapping, elementMappings, sourceData)
        }

        return { processed: sourceData.length, failed: 0 }
    }

    async function storeOpenmrsAsTrackerEvents(mapping, elementMappings, sourceData) {
        const program = mapping.target_program
        const programStage = mapping.target_program_stage || program
        const orgUnit = mapping.target_org_unit || mapping.source_org_unit
        if (!orgUnit) {
            throw new Error('target_org_unit (a DHIS2 org unit) is required to post tracker events')
        }

        const conceptToElement = new Map()
        const conceptToTransformation = new Map()
        for (const em of elementMappings) {
            conceptToElement.set(em.source_element, em.target_element)
            conceptToTransformation.set(em.source_element, em.transformation || 'direct')
        }

        // Mappings may carry default values for DHIS2 data elements (e.g.
        // mandatory program-stage fields) that have no OpenMRS equivalent.
        const defaultValues = []
        if (mapping.field_mappings) {
            try {
                const fm = JSON.parse(mapping.field_mappings || '{}')
                if (fm.default_values && typeof fm.default_values === 'object') {
                    for (const [de, val] of Object.entries(fm.default_values)) {
                        defaultValues.push({ dataElement: de, value: String(val) })
                    }
                }
            } catch (e) { /* ignore malformed field_mappings */ }
        }

        let processed = 0
        let failed = 0
        const events = []

        if (mapping.source_resource === 'encounter') {
            for (const enc of sourceData) {
                const obs = enc.obs || []
                const dataValues = []
                for (const o of obs) {
                    const conceptUuid = o.concept && o.concept.uuid
                    if (!conceptUuid) continue
                    if (conceptToElement.size > 0 && !conceptToElement.has(conceptUuid)) continue
                    const value = extractObsValue(o)
                    if (value === null || value === undefined) continue
                    const targetElement = conceptToElement.get(conceptUuid) || conceptUuid
                    const transformation = conceptToTransformation.get(conceptUuid) || 'direct'
                    let transformed
                    if (transformation === 'months_to_years') {
                        const months = Number(value)
                        transformed = isNaN(months) ? value : Math.max(0, Math.round(months / 12))
                    } else {
                        transformed = value
                    }
                    dataValues.push({ dataElement: targetElement, value: String(transformed) })
                }
                // Patient-derived pseudo sources (no obs dependency). Use these
                // when a compulsory program-stage data element maps to patient
                // facts (age at encounter, gender) rather than an obs concept.
                for (const [srcEl, targetElement] of conceptToElement) {
                    if (dataValues.some(d => d.dataElement === targetElement)) continue
                    if (!srcEl.startsWith('patient:')) continue
                    let person = enc.patient && enc.patient.person
                    if (!(person && person.birthdate)) {
                        // Encounter v=full only carries a patient ref, so pull
                        // the person record (birthdate/gender) when a
                        // patient-derived source needs it.
                        const puuid = enc.patient && enc.patient.uuid
                        if (!puuid) continue
                        try {
                            const p = await openmrsClient.patientByUuid(puuid)
                            person = (p && p.person) || null
                        } catch (e) {
                            continue
                        }
                    }
                    if (!person) continue
                    let val = null
                    if (srcEl === 'patient:ageYears') {
                        if (person.birthdate) {
                            const encDate = new Date(enc.encounterDatetime || new Date())
                            const bd = new Date(person.birthdate)
                            let years = encDate.getFullYear() - bd.getFullYear()
                            const m = encDate.getMonth() - bd.getMonth()
                            if (m < 0 || (m === 0 && encDate.getDate() < bd.getDate())) years--
                            val = Math.max(0, years)
                        }
                    } else if (srcEl === 'patient:gender') {
                        const g = person.gender
                        if (g === 'M') val = 'Male'
                        else if (g === 'F') val = 'Female'
                        else if (g === 'U') val = 'Unknown'
                        else if (g === 'O') val = 'Other'
                    }
                    if (val !== null && val !== undefined) {
                        dataValues.push({ dataElement: targetElement, value: String(val) })
                    }
                }
                if (dataValues.length === 0 && defaultValues.length === 0) continue
                for (const dv of defaultValues) {
                    if (!dataValues.some(d => d.dataElement === dv.dataElement)) {
                        dataValues.push(dv)
                    }
                }
                if (dataValues.length === 0) continue

                events.push({
                    program,
                    programStage,
                    orgUnit,
                    occurredAt: (enc.encounterDatetime || new Date().toISOString()).slice(0, 19),
                    status: 'COMPLETED',
                    dataValues,
                })
                processed++
            }
        }

        if (events.length > 0) {
            try {
                // Resolve option-set data elements to valid option codes so the
                // DHIS2 tracker import does not reject display-name values.
                const optionResolved = []
                for (const ev of events) {
                    const dataValues = []
                    for (const dv of ev.dataValues) {
                        const resolved = await dhis2Client.optionCodeForValue(dv.dataElement, dv.value)
                        dataValues.push({ dataElement: dv.dataElement, value: resolved })
                    }
                    optionResolved.push({ ...ev, dataValues })
                }
                await dhis2Client.postTrackerEvents(optionResolved)
            } catch (e) {
                failed = events.length
                throw new Error(`Failed to post tracker events: ${e.message}`)
            }
        }

        return { processed, failed, events: events.length }
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

    // Selects the OpenMRS data source for form-based encounter loads. Mappings
    // with source_db = 'mysql' read directly from the database when the SQL
    // connector is configured; everything else uses the REST API.
    function encounterSource(mapping) {
        if (mapping.source_db === 'mysql' && openmrsSqlClient && openmrsSqlClient.configured) {
            return openmrsSqlClient
        }
        return openmrsClient
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
        case 'Weekly': {
            const iso = isoWeek(now)
            return `${iso.year}W${iso.week}`
        }
        case 'WeeklyWednesday': {
            const iso = isoWeek(now)
            return `${iso.year}WedW${iso.week}`
        }
        case 'Monthly':
        default:
            return `${y}${m}`
    }
}

function getDateRange(periodType) {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    let startDate, endDate

    switch (periodType) {
        case 'Yearly':
            startDate = `${y}-01-01`
            endDate = `${y}-12-31`
            break
        case 'Weekly': {
            const iso = isoWeek(now)
            const { start, end } = iso.dateRange
            startDate = start
            endDate = end
            break
        }
        case 'WeeklyWednesday': {
            const { start, end } = wednesdayWeekRange(now)
            startDate = start
            endDate = end
            break
        }
        case 'Quarterly': {
            const qStart = Math.floor(m / 3) * 3
            startDate = `${y}-${String(qStart + 1).padStart(2, '0')}-01`
            const qEnd = new Date(y, qStart + 3, 0)
            endDate = qEnd.toISOString().slice(0, 10)
            break
        }
        case 'Monthly':
        default:
            startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`
            endDate = new Date(y, m + 2, 0).toISOString().slice(0, 10)
            break
    }

    // Ensure range includes at least 90 days backward for initial data loads
    const rangeStart = new Date(startDate)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 90)
    if (rangeStart > cutoff) {
        startDate = cutoff.toISOString().slice(0, 10)
    }

    return { startDate, endDate }
}

function extractObsValue(obs) {
    if (obs.value && typeof obs.value === 'object') {
        // Prefer the human-readable display so values like coded options land
        // as their name (e.g. "New", "Public") rather than a raw concept UUID.
        if (obs.value.display) return obs.value.display
        if (obs.value.uuid) return obs.value.uuid
        return null
    }
    return obs.value
}

function aggregateValue(aggregated, key, value, transformation) {
    const num = Number(value)
    switch (transformation) {
        case 'sum':
            aggregated[key] = (aggregated[key] || 0) + (isNaN(num) ? 0 : num)
            break
        case 'avg': {
            const prev = aggregated[key]
            if (!prev) {
                aggregated[key] = { sum: isNaN(num) ? 0 : num, count: 1 }
            } else {
                prev.sum += isNaN(num) ? 0 : num
                prev.count++
            }
            break
        }
        case 'count':
        case 'direct':
        default:
            aggregated[key] = (aggregated[key] || 0) + 1
            break
    }
}

// ISO 8601 week number (Monday-based) and its Monday-Sunday date range.
function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = (d.getUTCDay() + 6) % 7 // Monday = 0
    d.setUTCDate(d.getUTCDate() - dayNum + 3) // Thursday of current week
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
    const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000))
    const isoYear = d.getUTCFullYear()
    const start = new Date(d)
    start.setUTCDate(start.getUTCDate() - 3) // Monday
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6) // Sunday
    const fmt = x => x.toISOString().slice(0, 10)
    return { year: isoYear, week, dateRange: { start: fmt(start), end: fmt(end) } }
}

// DHIS2 WeeklyWednesday period: Wednesday-starting week (Wed of the ISO week
// containing `date` through the following Tuesday).
function wednesdayWeekRange(date) {
    const iso = isoWeek(date)
    const start = new Date(`${iso.dateRange.start}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() + 2) // move Monday -> Wednesday
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6) // through following Tuesday
    const fmt = x => x.toISOString().slice(0, 10)
    return { start: fmt(start), end: fmt(end) }
}
