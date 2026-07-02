const express = require('express')
const cors = require('cors')
const Dhis2Client = require('./clients/dhis2')
const OpenmrsClient = require('./clients/openmrs')
const CommcareClient = require('./clients/commcare')
const store = require('./db/store')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

const dhis2 = new Dhis2Client(
    process.env.DHIS2_URL || 'http://localhost:8091',
    process.env.DHIS2_USERNAME || 'admin',
    process.env.DHIS2_PASSWORD || 'district'
)

const openmrs = new OpenmrsClient(
    process.env.OPENMRS_URL || 'http://openmrs:8080/openmrs',
    process.env.OPENMRS_USERNAME || 'admin',
    process.env.OPENMRS_PASSWORD || 'Admin123'
)

const commcare = new CommcareClient(
    process.env.COMMCARE_DOMAIN || '',
    process.env.COMMCARE_API_KEY || '',
    process.env.COMMCARE_USERNAME || '',
    process.env.COMMCARE_APP_ID || ''
)

app.use('/api/status', require('./routes/status')(dhis2, openmrs, commcare))
app.use('/api/mappings', require('./routes/mappings')(store))
app.use('/api/sync', require('./routes/sync')(store, dhis2, openmrs, commcare))
app.use('/api/metadata', require('./routes/metadata')(dhis2))

app.get('/', (req, res) => {
    res.json({
        name: 'Interop Bridge',
        version: '1.0.0',
        author: 'vlolleh',
        description: 'DHIS2-OpenMRS interoperability bridge',
        endpoints: [
            'GET  /api/status/health       - System health check',
            'GET  /api/status/dhis2        - DHIS2 info',
            'GET  /api/status/openmrs      - OpenMRS info',
            'GET  /api/mappings            - List mappings',
            'POST /api/mappings            - Create mapping',
            'GET  /api/mappings/:id        - Get mapping',
            'PUT  /api/mappings/:id        - Update mapping',
            'DELETE /api/mappings/:id      - Delete mapping',
            'POST /api/sync/run/:mappingId - Execute sync',
            'GET  /api/sync/logs           - Sync logs',
            'GET  /api/metadata/dataSets   - List data sets/forms',
            'GET  /api/metadata/dataSets/:id - Data set details',
            'GET  /api/metadata/orgUnits   - List org units',
            'GET  /api/metadata/orgUnits/:id - Org unit details',
            'GET  /api/metadata/dataElements - List data elements',
        ]
    })
})

app.listen(PORT, () => {
    console.log(`Interop Bridge running on port ${PORT}`)
})
