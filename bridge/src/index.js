const express = require('express')
const cors = require('cors')
const Dhis2Client = require('./clients/dhis2')
const OpenmrsClient = require('./clients/openmrs')
const OpenmrsSqlClient = require('./clients/openmrsSql')
const CommcareClient = require('./clients/commcare')
const store = require('./db/store')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// TLS options for external (https) servers. Env vars per client:
//   <PREFIX>_TLS_INSECURE=true   -> accept self-signed certificates
//   <PREFIX>_TLS_CA_FILE=path    -> trust a custom CA bundle
//   <PREFIX>_TLS_CERT_FILE=path  + <PREFIX>_TLS_KEY_FILE=path -> mTLS client cert
// http servers are unaffected.
function tlsFromEnv(prefix) {
    const v = (name, def) => process.env[name] || def
    return {
        insecure: String(v(`${prefix}_TLS_INSECURE`, '')).toLowerCase() === 'true',
        caFile: v(`${prefix}_TLS_CA_FILE`, ''),
        certFile: v(`${prefix}_TLS_CERT_FILE`, ''),
        keyFile: v(`${prefix}_TLS_KEY_FILE`, ''),
    }
}

const dhis2 = new Dhis2Client(
    process.env.DHIS2_URL || 'http://localhost:8091',
    process.env.DHIS2_USERNAME || 'admin',
    process.env.DHIS2_PASSWORD || 'district',
    tlsFromEnv('DHIS2')
)

const openmrs = new OpenmrsClient(
    process.env.OPENMRS_URL || 'http://openmrs:8080/openmrs',
    process.env.OPENMRS_USERNAME || 'admin',
    process.env.OPENMRS_PASSWORD || 'Admin123',
    tlsFromEnv('OPENMRS')
)

// Optional direct-database source for OpenMRS. Configured via OPENMRS_DB_HOST,
// OPENMRS_DB_PORT, OPENMRS_DB_NAME, OPENMRS_DB_USER and OPENMRS_DB_PASSWORD.
// Mappings with source_db = 'mysql' then read encounters straight from the DB.
const openmrsSql = new OpenmrsSqlClient({
    host: process.env.OPENMRS_DB_HOST || '',
    port: process.env.OPENMRS_DB_PORT || 3306,
    database: process.env.OPENMRS_DB_NAME || 'openmrs',
    user: process.env.OPENMRS_DB_USER || '',
    password: process.env.OPENMRS_DB_PASSWORD || '',
})

const commcare = new CommcareClient(
    process.env.COMMCARE_DOMAIN || '',
    process.env.COMMCARE_API_KEY || '',
    process.env.COMMCARE_USERNAME || '',
    process.env.COMMCARE_APP_ID || ''
)

app.use('/api/status', require('./routes/status')(dhis2, openmrs, commcare, openmrsSql))
app.use('/api/mappings', require('./routes/mappings')(store))
app.use('/api/remap', require('./routes/remap')(store, openmrs))
app.use('/api/sync', require('./routes/sync')(store, dhis2, openmrs, commcare, openmrsSql))
app.use('/api/metadata', require('./routes/metadata')(dhis2, openmrs))

app.get('/', (req, res) => {
    res.json({
        name: 'Interop Bridge',
        version: '1.0.0',
        author: 'vlolleh',
        description: 'DHIS2-OpenMRS interoperability bridge',
        endpoints: [
            'GET  /api/status/health       - System health check',
            'GET  /api/status/dhis2        - DHIS2 info',
            'GET  /api/status/openmrs      - OpenMRS info + service-user roles',
            'GET  /api/status/openmrs/capabilities - Probe OpenMRS REST capabilities',
            'GET  /api/mappings            - List mappings',
            'POST /api/mappings            - Create mapping',
            'GET  /api/mappings/:id        - Get mapping',
            'PUT  /api/mappings/:id        - Update mapping',
            'DELETE /api/mappings/:id      - Delete mapping',
            'POST /api/sync/run/:mappingId - Execute sync',
            'GET  /api/sync/logs           - Sync logs',
            'POST /api/remap              - Re-point mappings to an external OpenMRS',
            'GET  /api/status/db          - OpenMRS SQL source status',
            'GET  /api/metadata/dataSets   - List DHIS2 data sets',
            'GET  /api/metadata/dataSets/:id - DHIS2 data set details',
            'GET  /api/metadata/orgUnits   - List DHIS2 org units',
            'GET  /api/metadata/orgUnits/:id - DHIS2 org unit details',
            'GET  /api/metadata/dataElements - List DHIS2 data elements',
            'GET  /api/metadata/openmrs/forms - List OpenMRS forms',
            'GET  /api/metadata/openmrs/locations - List OpenMRS locations',
            'GET  /api/metadata/openmrs/concepts/:uuid - Get OpenMRS concept',
        ]
    })
})

app.listen(PORT, () => {
    console.log(`Interop Bridge running on port ${PORT}`)
})
