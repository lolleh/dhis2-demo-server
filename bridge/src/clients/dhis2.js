const fetch = require('node-fetch')

class Dhis2Client {
    constructor(baseUrl, username, password, tlsOptions = {}) {
        this.baseUrl = baseUrl.replace(/\/+$/, '')
        this.auth = Buffer.from(`${username}:${password}`).toString('base64')
        this.agent = this.buildTlsAgent(tlsOptions)
    }

    // Same TLS handling as the OpenMRS client: CA bundle, mTLS client cert, or
    // an explicit self-signed opt-in. Only builds an agent for https URLs.
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
        const url = `${this.baseUrl}/api${path}`
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
        const data = await res.json()
        if (!res.ok) {
            throw new Error(`DHIS2 ${method} ${path}: ${res.status} ${data.message || JSON.stringify(data)}`)
        }
        return data
    }

    get(path) { return this.request('GET', path) }
    post(path, body) { return this.request('POST', path, body) }
    put(path, body) { return this.request('PUT', path, body) }
    del(path) { return this.request('DELETE', path) }

    async systemInfo() {
        return this.get('/system/info')
    }

    async dataElements(query = {}) {
        const params = new URLSearchParams({ fields: 'id,name,code', pageSize: '100', ...query })
        return this.get(`/dataElements?${params}`)
    }

    // Resolve a display value to a valid option code for a data element that
    // uses an optionSet. Returns the input untouched if there is no option
    // set or no matching option.
    async optionCodeForValue(dataElementId, value) {
        const de = await this.get(`/dataElements/${dataElementId}?fields=id,optionSet[id,name,options[code,name]]`)
        if (!de || !de.optionSet) return value
        const opts = de.optionSet.options || []
        const val = String(value)
        const byCode = opts.find(o => o.code && o.code.toLowerCase() === val.toLowerCase())
        if (byCode) return byCode.code
        const byName = opts.find(o => o.name && o.name.toLowerCase() === val.toLowerCase())
        if (byName) return byName.code
        return value
    }

    async dataSets(query = {}) {
        const params = new URLSearchParams({
            fields: 'id,name,code,periodType,dataSetElements[dataElement[id,name,code,formName]]',
            pageSize: '100',
            ...query,
        })
        return this.get(`/dataSets?${params}`)
    }

    async dataSet(id) {
        return this.get(`/dataSets/${id}?fields=id,name,code,periodType,dataSetElements[dataElement[id,name,code,formName,valueType,categoryCombo]]`)
    }

    async organisationUnits(query = {}) {
        const params = new URLSearchParams({
            fields: 'id,name,code,level,parent[id,name],path',
            pageSize: '500',
            ...query,
        })
        return this.get(`/organisationUnits?${params}`)
    }

    async orgUnitTree() {
        return this.get('/organisationUnits?fields=id,name,code,level,children[id,name,level]&pageSize=1&filter=level:eq:1')
    }

    async organisationUnit(id) {
        return this.get(`/organisationUnits/${id}?fields=id,name,code,level,children[id,name,level],parent[id,name]`)
    }

    async dataValueSets(dataValues, dataSet, orgUnit, period) {
        return this.post('/dataValueSets', { dataSet, orgUnit, dataValues, period })
    }

    async getDataValueSets(query = {}) {
        const params = new URLSearchParams({ ...query })
        return this.get(`/dataValueSets?${params}`)
    }

    async trackedEntityInstances(query = {}) {
        const params = new URLSearchParams({ fields: '*', pageSize: '50', ...query })
        return this.get(`/trackedEntityInstances?${params}`)
    }

    async events(query = {}) {
        const params = new URLSearchParams({ fields: '*', pageSize: '50', ...query })
        return this.get(`/events?${params}`)
    }

    async postEvents(events) {
        return this.post('/events', { events })
    }

    postTrackerEvents(events) {
        // DHIS2 2.40+ program events are imported via the Tracker API. Using
        // async=false makes validation failures surface in the HTTP response
        // instead of being sent to a background job that silently ignores rows.
        return this.post('/tracker?importStrategy=CREATE_AND_UPDATE&async=false', { events })
    }

    async getTrackerEvents(query = {}) {
        const params = new URLSearchParams({ fields: '*', pageSize: '50', ...query })
        return this.get(`/tracker/events?${params}`)
    }

    async importMetadata(metadata) {
        return this.post('/metadata', metadata)
    }

    async programs(query = {}) {
        const params = new URLSearchParams({ fields: 'id,name,programType', pageSize: '100', ...query })
        return this.get(`/programs?${params}`)
    }
}

module.exports = Dhis2Client
