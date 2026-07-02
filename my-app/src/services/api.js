const BRIDGE_PORT = '4000'
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const BRIDGE_URL = process.env.REACT_APP_BRIDGE_URL || `http://${hostname}:${BRIDGE_PORT}`

async function request(url, options = {}) {
    const res = await fetch(`${BRIDGE_URL}${url}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed: ${res.status}`)
    }
    if (res.status === 204) return null
    return res.json()
}

export const api = {
    health: () => request('/api/status/health'),
    dhis2Info: () => request('/api/status/dhis2'),
    openmrsInfo: () => request('/api/status/openmrs'),
    commcareInfo: () => request('/api/status/commcare'),

    getMappings: () => request('/api/mappings'),
    getMapping: (id) => request(`/api/mappings/${id}`),
    createMapping: (data) => request('/api/mappings', { method: 'POST', body: JSON.stringify(data) }),
    updateMapping: (id, data) => request(`/api/mappings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMapping: (id) => request(`/api/mappings/${id}`, { method: 'DELETE' }),

    runSync: (mappingId) => request(`/api/sync/run/${mappingId}`, { method: 'POST' }),
    getSyncLogs: (mappingId) => request(`/api/sync/logs${mappingId ? `?mappingId=${mappingId}` : ''}`),

    getDataSets: () => request('/api/metadata/dataSets'),
    getDataSet: (id) => request(`/api/metadata/dataSets/${id}`),
    getOrgUnits: (params) => request(`/api/metadata/orgUnits?${new URLSearchParams(params || {}).toString()}`),
    getOrgUnit: (id) => request(`/api/metadata/orgUnits/${id}`),
    getDataElements: (params) => request(`/api/metadata/dataElements?${new URLSearchParams(params || {}).toString()}`),
}
