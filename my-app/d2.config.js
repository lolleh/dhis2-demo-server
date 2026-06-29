const config = {
    type: 'app',
    name: 'my-app',
    title: 'My App',
    description: 'A custom DHIS2 app',
    entryPoints: {
        app: './src/App.jsx',
    },
    coreVersion: '2.44',
    baseUrl: 'http://localhost:8091',
}

module.exports = config
