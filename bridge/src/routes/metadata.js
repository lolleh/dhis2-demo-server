const express = require('express')

const router = express.Router()

module.exports = function (dhis2Client) {
    router.get('/dataSets', async (req, res) => {
        try {
            const result = await dhis2Client.dataSets()
            res.json(result)
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    router.get('/dataSets/:id', async (req, res) => {
        try {
            const result = await dhis2Client.dataSet(req.params.id)
            res.json(result)
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    router.get('/orgUnits', async (req, res) => {
        try {
            const { page, pageSize, filter } = req.query
            const query = {}
            if (page) query.page = page
            if (pageSize) query.pageSize = pageSize
            if (filter) query.filter = filter
            const result = await dhis2Client.organisationUnits(query)
            res.json(result)
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    router.get('/orgUnits/:id', async (req, res) => {
        try {
            const result = await dhis2Client.organisationUnit(req.params.id)
            res.json(result)
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    router.get('/dataElements', async (req, res) => {
        try {
            const result = await dhis2Client.dataElements(req.query)
            res.json(result)
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    return router
}
