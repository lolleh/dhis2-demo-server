const express = require('express')

const router = express.Router()

module.exports = function (dhis2Client, openmrsClient, commcareClient, openmrsSqlClient) {
    router.get('/health', async (req, res) => {
        const status = { bridge: 'ok', dhis2: 'unknown', openmrs: 'unknown', openmrs_sql: 'unknown', commcare: 'unknown' }

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

        try {
            status.openmrs_sql = await openmrsSqlClient.ping()
        } catch (e) {
            status.openmrs_sql = { ok: false, error: e.message }
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
            // The demo distro does not support bare /patient / /encounter
            // collection GETs, so surface concepts (which work), a full session
            // (auth + service-user roles) and a patient search instead of an
            // unsupported patient listing.
            const [sessionFull, concepts] = await Promise.all([
                openmrsClient.sessionFull(),
                openmrsClient.concepts({ limit: 10 }),
            ])
            const user = sessionFull && sessionFull.user
            const session = {
                username: (user && (user.username || user.systemId)) || null,
                systemId: user && user.systemId,
                roles: (user && user.roles || []).map(r => r.display),
            }
            let patients = null
            // Return a patient sample via search when a term is supplied.
            if (req.query.q) {
                patients = await openmrsClient.patients({ q: req.query.q })
            }
            res.json({ session, concepts, patients })
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    // Probe which OpenMRS REST operations are actually supported + which the
    // service user may call. Lets an operator confirm (before syncing) that an
    // external server supports the efficient /encounter search path and that
    // the account has the needed read privileges.
    router.get('/openmrs/capabilities', async (req, res) => {
        const probe = async (label, fn) => {
            try {
                await fn()
                return { ok: true }
            } catch (e) {
                return { ok: false, error: e.message }
            }
        }

        const [auth, encounterSearch, patientSearch, forms, concepts, visits, db] = await Promise.all([
            probe('auth', () => openmrsClient.systemInfo()),
            probe('encounterSearch', () => openmrsClient.get('/encounter?form=00000000-0000-0000-0000-000000000000&limit=1&v=full')),
            probe('patientSearch', () => openmrsClient.patients({ q: 'a' })),
            probe('forms', () => openmrsClient.get('/form?limit=1&v=default')),
            probe('concepts', () => openmrsClient.concepts({ limit: 1 })),
            probe('visits', () => openmrsClient.get('/visit?limit=1&v=default')),
            (async () => {
                try {
                    return { ok: true, ...await openmrsSqlClient.ping() }
                } catch (e) {
                    return { ok: false, error: e.message }
                }
            })(),
        ])

        let roles = []
        try {
            const sessionFull = await openmrsClient.sessionFull()
            const user = sessionFull && sessionFull.user
            roles = (user && user.roles || []).map(r => r.display)
        } catch (e) { /* ignore */ }

        res.json({
            server: openmrsClient.baseUrl,
            note: 'encounterSearch=true means fast server-side /encounter?form= search; false means the visit walker fallback will be used',
            user: { authenticated: auth.ok, roles },
            probes: { auth, encounterSearch, patientSearch, forms, concepts, visits, db },
        })
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

    router.get('/db', async (req, res) => {
        try {
            const ping = await openmrsSqlClient.ping()
            res.json({ openmrs_sql: ping, configured: openmrsSqlClient.configured })
        } catch (e) {
            res.status(500).json({ openmrs_sql: { ok: false, error: e.message } })
        }
    })

    return router
}
