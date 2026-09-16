const fetch = require('node-fetch')

class OpenmrsClient {
    constructor(baseUrl, username, password, tlsOptions = {}) {
        this.baseUrl = baseUrl.replace(/\/+$/, '')
        this.auth = Buffer.from(`${username}:${password}`).toString('base64')
        this.agent = this.buildTlsAgent(tlsOptions)
    }

    // Builds an https.Agent that trusts an external server's CA bundle, a
    // client certificate, or (explicitly opted-in) self-signed certificates.
    // Returns null for http URLs so the default fetch behaviour is unchanged.
    buildTlsAgent(opts = {}) {
        if (!/^https:/i.test(this.baseUrl)) return null
        const https = require('https')
        const fs = require('fs')
        const config = {}
        if (opts.insecure) config.rejectUnauthorized = false
        if (opts.caFile) config.ca = fs.readFileSync(opts.caFile)
        if (opts.certFile && opts.keyFile) {
            config.cert = fs.readFileSync(opts.certFile)
            config.key = fs.readFileSync(opts.keyFile)
        }
        if (Object.keys(config).length === 0) return null
        return new https.Agent(config)
    }

    async request(method, path, body) {
        const url = `${this.baseUrl}/ws/rest/v1${path}`
        const headers = {
            Authorization: `Basic ${this.auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        }
        const fetchOptions = {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        }
        if (this.agent) fetchOptions.agent = this.agent
        const res = await fetch(url, fetchOptions)
        if (res.status === 204 || res.status === 201) {
            return { status: res.status }
        }
        const data = await res.json()
        if (!res.ok) {
            throw new Error(`OpenMRS ${method} ${path}: ${res.status} ${data.message || JSON.stringify(data)}`)
        }
        return data
    }

    get(path) { return this.request('GET', path) }
    post(path, body) { return this.request('POST', path, body) }
    put(path, body) { return this.request('PUT', path, body) }
    del(path) { return this.request('DELETE', path) }

    async systemInfo() {
        // The demo distro does not expose /appui/help/about, so authenticate
        // through /session which returns the logged-in user.
        const fetchOptions = {
            headers: { Authorization: `Basic ${this.auth}` },
            timeout: 5000,
        }
        if (this.agent) fetchOptions.agent = this.agent
        const res = await fetch(`${this.baseUrl}/ws/rest/v1/session`, fetchOptions)
        if (!res.ok) {
            throw new Error(`OpenMRS systemInfo: ${res.status}`)
        }
        return await res.json()
    }

    // /session?v=full includes the authenticated user with their roles, letting
    // operators verify the service account actually has the privileges needed
    // for a sync (instead of discovering it mid-sync).
    async sessionFull() {
        return this.get('/session?v=full')
    }

    // The demo distro does not support a bare GET /patient collection. Patients
    // are retrieved via search (?q=) or by identifier / UUID, all of which work.
    async patients(query = {}) {
        // Allow an explicit search term. A wildcard-ish empty search returns no
        // rows, so if none is supplied we fall back to fetching by demo identifiers.
        const searchTerm = query.q || query.s
        if (searchTerm) {
            const params = new URLSearchParams({ v: 'full', limit: '50', q: searchTerm })
            return this.get(`/patient?${params}`)
        }
        if (query.identifier) {
            const params = new URLSearchParams({ v: 'full', limit: '50', identifier: query.identifier })
            return this.get(`/patient?${params}`)
        }
        // Bare GET /patient is unsupported; return an empty (handled) result
        // rather than letting the caller hit a 500.
        return { results: [] }
    }

    async patientByUuid(uuid) {
        return this.get(`/patient/${uuid}?v=full`)
    }

    // Like /patient, the demo distro rejects bare GET /encounter collection.
    // Looking up encounters by patient UUID (or by search term) works.
    async encounters(query = {}) {
        const params = new URLSearchParams({ v: 'full', limit: '50' })
        if (query.patient) params.set('patient', query.patient)
        if (query.q) params.set('q', query.q)
        return this.get(`/encounter?${params}`)
    }

    // /obs collection is also unsupported. Observations are always read from the
    // encounter detail we already fetch (encounter.obs), so this helper is kept
    // only for fetching a single observation by UUID.
    async observations(query = {}) {
        if (query.uuid) {
            return this.get(`/obs/${query.uuid}?v=full`)
        }
        return { results: [] }
    }

    async concepts(query = {}) {
        const params = new URLSearchParams({ v: 'full', limit: '100', ...query })
        return this.get(`/concept?${params}`)
    }

    async createPatient(patient) {
        return this.post('/patient', patient)
    }

    async createEncounter(encounter) {
        return this.post('/encounter', encounter)
    }

    async createObservation(obs) {
        return this.post('/obs', obs)
    }

    async getByUuid(resource, uuid) {
        return this.get(`/${resource}/${uuid}?v=full`)
    }

    // Fetch encounters belonging to a given OpenMRS form (optionally filtered
    // by encounter date). Prefers the efficient server-side /encounter search
    // and falls back to scanning visits (needed by older demo distros whose
    // encounter collection endpoint returns HTTP 500).
    async formEncounters(formUuid, startDate, endDate, limit = 5000) {
        const collected = []
        const seen = new Set()
        if (!limit || limit <= 0) return collected

        if (formUuid) {
            const usedSearch = await this.searchEncounters(collected, seen, formUuid, startDate, endDate, limit)
            if (!usedSearch) {
                await this.walkVisitsForForm(collected, seen, formUuid, startDate, endDate, limit)
            }
        }
        return collected
    }

    // Efficient path: GET /encounter?form=...&fromdate=...&todate=...&v=full
    // Returns true when the search endpoint was usable (the fallback walker
    // should not run then).
    async searchEncounters(all, seen, formUuid, startDate, endDate, limit) {
        let startIndex = 0
        const batchSize = 50

        try {
            while (all.length < limit) {
                const params = { v: 'full', limit: String(batchSize), startIndex: String(startIndex) }
                if (formUuid) params.form = formUuid
                if (startDate) params.fromdate = startDate
                if (endDate) params.todate = endDate
                const data = await this.get(`/encounter?${new URLSearchParams(params)}`)
                const results = data.results || []
                if (results.length === 0) break

                // A non-empty result set whose entries all belong to a
                // different form means the server ignored the form filter
                // (demo distro behaviour) - abort and let the walker handle it.
                const anyMatch = results.some(r => r.form && r.form.uuid === formUuid)
                if (!anyMatch) break

                for (const enc of results) {
                    this.addFormEncounter(all, seen, enc, formUuid, startDate, endDate, limit)
                    if (all.length >= limit) break
                }
                if (results.length < batchSize) break
                startIndex += results.length
            }
            return true
        } catch (e) {
            // The collection endpoint is unsupported (e.g. the demo distro
            // returns HTTP 500) - signal the caller to fall back.
            return false
        }
    }

    // Fallback path: page through /visit, expand each visit, and collect the
    // encounters whose form + date range match. Used by distros where the
    // /encounter search endpoint is not available.
    async walkVisitsForForm(all, seen, formUuid, startDate, endDate, limit) {
        let startIndex = 0
        const batchSize = 50

        while (all.length < limit) {
            const params = new URLSearchParams({
                limit: String(batchSize),
                startIndex: String(startIndex),
                v: 'default',
            })
            let data
            try {
                data = await this.get(`/visit?${params}`)
            } catch (e) {
                break
            }
            const visits = data.results || []
            if (visits.length === 0) break

            for (const visit of visits) {
                if (all.length >= limit) break
                try {
                    const visitDetail = await this.get(`/visit/${visit.uuid}?v=full`)
                    const encounters = visitDetail.encounters || []
                    for (const encSummary of encounters) {
                        if (all.length >= limit) break
                        const encounterDetail = await this.getByUuid('encounter', encSummary.uuid)
                        this.addFormEncounter(all, seen, encounterDetail, formUuid, startDate, endDate, limit)
                    }
                } catch (e) {
                    continue
                }
            }

            startIndex += visits.length
            if (visits.length < batchSize) break
        }
    }

    // Adds an encounter detail to the result set only when it matches the
    // requested form + date range and has not already been collected.
    addFormEncounter(all, seen, enc, formUuid, startDate, endDate, limit) {
        if (!enc || !enc.uuid || seen.has(enc.uuid)) return
        if (all.length >= limit) return
        const encFormUuid = enc.form && enc.form.uuid
        if (formUuid && encFormUuid && encFormUuid !== formUuid) return

        const encDate = enc.encounterDatetime ? enc.encounterDatetime.slice(0, 10) : null
        if (encDate && startDate && encDate < startDate) return
        if (encDate && endDate && encDate > endDate) return

        seen.add(enc.uuid)
        all.push(enc)
    }

    async conceptByUuid(conceptUuid) {
        return this.get(`/concept/${conceptUuid}?v=full`)
    }

    // --- Metadata name helpers (used by the remote-remap feature) ---

    async formName(formUuid) {
        const form = await this.get(`/form/${formUuid}?v=full`)
        return form && form.name ? form.name : null
    }

    // Candidate list (uuid + name) so callers can surface near-misses when an
    // external server's names differ from the local ones.
    async searchFormsByName(name, limit = 50) {
        if (!name) return []
        try {
            const data = await this.get(`/form?q=${encodeURIComponent(name)}&v=default&limit=${limit}`)
            return (data.results || []).map(r => ({ uuid: r.uuid, name: r.name }))
        } catch (e) {
            return []
        }
    }

    async searchFormByName(name) {
        const hits = await this.searchFormsByName(name)
        if (hits.length === 0) return null
        const exact = hits.find(h => h.name && h.name.toLowerCase() === name.toLowerCase())
        return (exact || hits[0]).uuid
    }

    async conceptName(conceptUuid) {
        const concept = await this.get(`/concept/${conceptUuid}?v=full`)
        return concept && concept.display ? concept.display : null
    }

    // Candidate list (uuid + display name) for remote-remap reporting.
    async searchConceptsByName(name, limit = 50) {
        if (!name) return []
        try {
            const data = await this.get(`/concept?q=${encodeURIComponent(name)}&v=default&limit=${limit}`)
            return (data.results || []).map(r => ({ uuid: r.uuid, name: r.display }))
        } catch (e) {
            return []
        }
    }

    async searchConceptByName(name) {
        const hits = await this.searchConceptsByName(name)
        if (hits.length === 0) return null
        const exact = hits.find(h => h.name && h.name.toLowerCase() === name.toLowerCase())
        return (exact || hits[0]).uuid
    }
}

module.exports = OpenmrsClient
