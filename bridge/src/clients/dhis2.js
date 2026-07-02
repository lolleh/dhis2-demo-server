const fetch = require('node-fetch')

class Dhis2Client {
    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl.replace(/\/+$/, '')
        this.auth = Buffer.from(`${username}:${password}`).toString('base64')
    }

    async request(method, path, body) {
        const url = `${this.baseUrl}/api${path}`
        const headers = {
            Authorization: `Basic ${this.auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        }
        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        })
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

    async importMetadata(metadata) {
        return this.post('/metadata', metadata)
    }

    async programs(query = {}) {
        const params = new URLSearchParams({ fields: 'id,name,programType', pageSize: '100', ...query })
        return this.get(`/programs?${params}`)
    }
}

module.exports = Dhis2Client
