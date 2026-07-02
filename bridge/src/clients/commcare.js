const fetch = require('node-fetch')

class CommcareClient {
    constructor(domain, apiKey, username, appId) {
        this.domain = domain.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/a\/[^/]+\/?$/, '')
        this.baseUrl = `https://${this.domain}`
        this.auth = `ApiKey ${username}:${apiKey}`
        this.appId = appId
    }

    async request(method, path, body) {
        const url = `${this.baseUrl}/a/${this.domain}/api/v0.5${path}`
        const headers = {
            Authorization: this.auth,
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
            throw new Error(`CommCare ${method} ${path}: ${res.status} ${data.detail || data.error || JSON.stringify(data)}`)
        }
        return data
    }

    get(path) { return this.request('GET', path) }

    async systemInfo() {
        try {
            const data = await this.get('/module/')
            return { ok: true, modules: (data.objects || []).length }
        } catch (e) {
            return { ok: false, error: e.message }
        }
    }

    async getModules(query = {}) {
        const params = new URLSearchParams({ limit: '100', ...query })
        return this.get(`/module/?${params}`)
    }

    async getForms(query = {}) {
        const params = new URLSearchParams({ limit: '100', ...query })
        return this.get(`/form/?${params}`)
    }

    async getFormSubmissions(formXmlns, startDate, endDate, limit = 500) {
        const params = new URLSearchParams({
            xmlns: formXmlns,
            received_on_start: startDate,
            received_on_end: endDate,
            limit: String(limit),
            ordering: 'received_on',
        })
        return this.get(`/form/?${params}`)
    }

    async getFormSubmissionDetail(formId) {
        return this.get(`/form/${formId}/`)
    }

    parseFormData(formData) {
        const values = {}
        const form = formData.form || {}
        const questions = form['#'] || form

        const walk = (obj, prefix = '') => {
            if (!obj || typeof obj !== 'object') return
            for (const [key, val] of Object.entries(obj)) {
                if (key === '#') continue
                if (key.startsWith('@')) continue
                const path = prefix ? `${prefix}/${key}` : key
                if (val === null || val === undefined) continue
                if (typeof val === 'object' && !Array.isArray(val)) {
                    walk(val, path)
                } else {
                    values[path] = String(val)
                }
            }
        }

        walk(questions)
        return values
    }
}

module.exports = CommcareClient
