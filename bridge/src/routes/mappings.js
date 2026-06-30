const express = require('express')

const router = express.Router()

module.exports = function (store) {
    router.get('/', (req, res) => {
        res.json(store.getMappings())
    })

    router.get('/:id', (req, res) => {
        const mapping = store.getMapping(Number(req.params.id))
        if (!mapping) return res.status(404).json({ error: 'Mapping not found' })
        res.json(mapping)
    })

    router.post('/', (req, res) => {
        const { name, direction, source_resource, target_resource, field_mappings, schedule } = req.body
        if (!name || !direction || !source_resource || !target_resource) {
            return res.status(400).json({ error: 'name, direction, source_resource, and target_resource are required' })
        }
        const mapping = store.createMapping({ name, direction, source_resource, target_resource, field_mappings, schedule })
        res.status(201).json(mapping)
    })

    router.put('/:id', (req, res) => {
        const mapping = store.updateMapping(Number(req.params.id), req.body)
        if (!mapping) return res.status(404).json({ error: 'Mapping not found' })
        res.json(mapping)
    })

    router.delete('/:id', (req, res) => {
        store.deleteMapping(Number(req.params.id))
        res.status(204).end()
    })

    return router
}
