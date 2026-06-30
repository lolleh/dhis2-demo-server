const config = {
    type: 'app',
    name: 'interop-bridge',
    title: 'Interoperability Bridge',
    description: 'DHIS2-OpenMRS data synchronization bridge by vlolleh',
    author: 'vlolleh',
    entryPoints: {
        app: './src/App.jsx',
    },
    coreVersion: '2.44',
    baseUrl: 'http://localhost:8091',
}

module.exports = config
