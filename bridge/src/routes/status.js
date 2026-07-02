const express = require('express')

const router = express.Router()

module.exports = function (dhis2Client, openmrsClient, commcareClient) {
    router.get('/health', async (req, res) => {
        const status = { bridge: 'ok', dhis2: 'unknown', openmrs: 'unknown', commcare: 'unknown' }

        try {
            const info = await dhis2Client.systemInfo()
            status.dhis2 = { ok: true, version: info.version, revision: info.revision }
        } catch (e) {
            status.dhis2 = { ok: false, error: e.message }
        }

        try {
            const info = await openmrsClient.systemInfo()
            status.openmrs = { ok: true, info }
        } catch (e) {
            status.openmrs = { ok: false, error: e.message }
        }

        if (commcareClient.domain) {
            try {
                const info = await commcareClient.systemInfo()
                status.commcare = info
            } catch (e) {
                status.commcare = { ok: false, error: e.message }
            }
        } else {
            status.commcare = { ok: false, error: 'Not configured (set COMMCARE_DOMAIN, COMMCARE_API_KEY, COMMCARE_USERNAME)' }
        }

        res.json(status)
    })

    router.get('/dhis2', async (req, res) => {
        try {
            const [system, dataElements, orgUnits, programs] = await Promise.all([
                dhis2Client.systemInfo(),
                dhis2Client.dataElements({ pageSize: 10 }),
                dhis2Client.organisationUnits({ pageSize: 10 }),
                dhis2Client.programs({ pageSize: 10 }),
            ])
            res.json({ system, dataElements, organisationUnits: orgUnits, programs })
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    router.get('/openmrs', async (req, res) => {
        try {
            const [patients, concepts] = await Promise.all([
                openmrsClient.patients({ limit: 5 }),
                openmrsClient.concepts({ limit: 10 }),
            ])
            res.json({ patients, concepts })
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    router.get('/commcare', async (req, res) => {
        if (!commcareClient.domain) {
            return res.status(400).json({ error: 'CommCare not configured' })
        }
        try {
            const info = await commcareClient.systemInfo()
            const forms = await commcareClient.getForms({ limit: '5' })
            res.json({ info, forms })
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    return router
}
