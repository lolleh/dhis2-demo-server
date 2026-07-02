const express = require('express')

const router = express.Router()

module.exports = function (store) {
    router.get('/', (req, res) => {
        const mappings = store.getMappings()
        const result = mappings.map(m => {
            const el = store.getElementMappings(m.id)
            return { ...m, element_mappings: el }
        })
        res.json(result)
    })

    router.get('/:id', (req, res) => {
        const mapping = store.getMapping(Number(req.params.id))
        if (!mapping) return res.status(404).json({ error: 'Mapping not found' })
        const el = store.getElementMappings(mapping.id)
        res.json({ ...mapping, element_mappings: el })
    })

    router.post('/', (req, res) => {
        const {
            name, mapping_type, direction,
            source_resource, target_resource,
            source_data_set, target_data_set,
            source_org_unit, target_org_unit, period_type,
            field_mappings, schedule, element_mappings,
            commcare_form_xmlns, commcare_app_id,
        } = req.body

        if (!name || !direction) {
            return res.status(400).json({ error: 'name and direction are required' })
        }

        if (direction === 'commcare2dhis2') {
            if (!target_data_set || !source_org_unit || !commcare_form_xmlns) {
                return res.status(400).json({
                    error: 'target_data_set, source_org_unit, and commcare_form_xmlns are required for CommCare mappings',
                })
            }
        } else {
            const type = mapping_type || 'tracker'
            if (type === 'aggregate') {
                if (!source_data_set || !target_data_set || !source_org_unit) {
                    return res.status(400).json({
                        error: 'source_data_set, target_data_set, and source_org_unit are required for aggregate mappings',
                    })
                }
            } else {
                if (!source_resource || !target_resource) {
                    return res.status(400).json({ error: 'source_resource and target_resource are required for tracker mappings' })
                }
            }
        }

        const mapping = store.createMapping({
            name, mapping_type: type, direction,
            source_resource, target_resource,
            source_data_set, target_data_set,
            source_org_unit, target_org_unit,
            period_type: period_type || 'Monthly',
            field_mappings, schedule, element_mappings,
            commcare_form_xmlns, commcare_app_id,
        })
        res.status(201).json(mapping)
    })

    router.put('/:id', (req, res) => {
        const mapping = store.updateMapping(Number(req.params.id), req.body)
        if (!mapping) return res.status(404).json({ error: 'Mapping not found' })
        const el = store.getElementMappings(mapping.id)
        res.json({ ...mapping, element_mappings: el })
    })

    router.delete('/:id', (req, res) => {
        store.deleteMapping(Number(req.params.id))
        res.status(204).end()
    })

    return router
}
