const express = require('express')
const cors = require('cors')
const Dhis2Client = require('./clients/dhis2')
const OpenmrsClient = require('./clients/openmrs')
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

app.use('/api/status', require('./routes/status')(dhis2, openmrs))
app.use('/api/mappings', require('./routes/mappings')(store))
app.use('/api/sync', require('./routes/sync')(store, dhis2, openmrs))

app.get('/', (req, res) => {
    res.json({
        name: 'Interop Bridge',
        version: '1.0.0',
        author: 'vlolleh',
        description: 'DHIS2-OpenMRS interoperability bridge',
        endpoints: [
            'GET  /api/status/health     - System health check',
            'GET  /api/status/dhis2      - DHIS2 info',
            'GET  /api/status/openmrs    - OpenMRS info',
            'GET  /api/mappings          - List mappings',
            'POST /api/mappings          - Create mapping',
            'GET  /api/mappings/:id      - Get mapping',
            'PUT  /api/mappings/:id      - Update mapping',
            'DELETE /api/mappings/:id    - Delete mapping',
            'POST /api/sync/run/:mappingId - Execute sync',
            'GET  /api/sync/logs         - Sync logs',
        ]
    })
})

app.listen(PORT, () => {
    console.log(`Interop Bridge running on port ${PORT}`)
})
