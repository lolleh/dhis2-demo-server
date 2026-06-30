const fetch = require('node-fetch')

class OpenmrsClient {
    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl.replace(/\/+$/, '')
        this.auth = Buffer.from(`${username}:${password}`).toString('base64')
    }

    async request(method, path, body) {
        const url = `${this.baseUrl}/ws/rest/v1${path}`
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
        try {
            const res = await fetch(`${this.baseUrl}/ws/rest/v1/appui/help/about`, {
                headers: { Authorization: `Basic ${this.auth}` },
            })
            const data = await res.json()
            return data
        } catch {
            return { status: 'unknown' }
        }
    }

    async patients(query = {}) {
        const params = new URLSearchParams({ v: 'full', limit: '50', ...query })
        return this.get(`/patient?${params}`)
    }

    async encounters(query = {}) {
        const params = new URLSearchParams({ v: 'full', limit: '50', ...query })
        return this.get(`/encounter?${params}`)
    }

    async observations(query = {}) {
        const params = new URLSearchParams({ v: 'full', limit: '50', ...query })
        return this.get(`/obs?${params}`)
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
}

module.exports = OpenmrsClient
