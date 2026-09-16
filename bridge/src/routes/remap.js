const express = require('express')
const OpenmrsClient = require('../clients/openmrs')

const router = express.Router()

// Re-points mapping metadata (form UUID + concept UUIDs) from the local
// OpenMRS instance to an external one. Source UUIDs are resolved to their
// human-readable names locally, then matched by name on the remote server.
module.exports = function (store, localOpenmrs) {
    router.post('/', async (req, res) => {
        const {
            remoteUrl,
            username,
            password,
            mappings,
            remapForms = true,
            remapConcepts = true,
            dryRun = false,
            tls = {},
            overrides = {},
        } = req.body || {}

        if (!remoteUrl) {
            return res.status(400).json({ error: 'remoteUrl is required (e.g. https://openmrs.example.org/openmrs)' })
        }

        let remote
        try {
            remote = new OpenmrsClient(remoteUrl, username || '', password || '', tls)
            await remote.systemInfo()
        } catch (e) {
            return res.status(502).json({ error: `Cannot reach remote OpenMRS: ${e.message}` })
        }

        const selected = Array.isArray(mappings) && mappings.length > 0
            ? store.getMappings().filter(m => mappings.map(Number).includes(m.id))
            : store.getMappings()

        const report = []
        for (const mapping of selected) {
            report.push(await remapMapping(mapping, remote, dryRun, remapForms, remapConcepts, overrides))
        }

        const summary = report.reduce((acc, r) => {
            for (const e of r.elements) acc[e.status] = (acc[e.status] || 0) + 1
            if (r.form) acc[r.form.status] = (acc[r.form.status] || 0) + 1
            return acc
        }, {})

        res.json({ remoteUrl, dryRun, summary, mappings: report })
    })

    async function remapMapping(mapping, remote, dryRun, remapForms, remapConcepts, overrides) {
        const entry = {
            mapping_id: mapping.id,
            name: mapping.name,
            form: null,
            elements: [],
        }

        const elementMappings = store.getElementMappings(mapping.id)
        const updated = {}

        if (remapForms && mapping.source_data_set) {
            entry.form = await remapForm(mapping.source_data_set, remote, overrides.formUuid)
            if (entry.form.status === 'remapped') updated.source_data_set = entry.form.now
        }

        const remappedElements = []
        let elementsChanged = false
        for (const em of elementMappings) {
            if (em.source_element && em.source_element.startsWith('patient:')) {
                entry.elements.push({ source: em.source_element, status: 'kept' })
                remappedElements.push(em)
                continue
            }

            if (!remapConcepts) {
                entry.elements.push({ source: em.source_element, status: 'kept' })
                remappedElements.push(em)
                continue
            }

            const result = await remapConcept(em.source_element, remote, overrides.concepts)
            entry.elements.push(result)
            if (result.status === 'remapped') {
                elementsChanged = true
                remappedElements.push({ ...em, source_element: result.now })
            } else {
                remappedElements.push(em)
            }
        }

        if (!dryRun && Object.keys(updated).length > 0) {
            store.updateMapping(mapping.id, updated)
        }
        if (!dryRun && elementsChanged) {
            store.setElementMappings(mapping.id, remappedElements)
        }

        return entry
    }

    async function remapForm(localUuid, remote, overrideUuid) {
        if (overrideUuid) {
            return {
                was: localUuid,
                now: overrideUuid,
                name: '(explicit override)',
                status: overrideUuid === localUuid ? 'unchanged' : 'overridden',
            }
        }
        try {
            const name = await localOpenmrs.formName(localUuid)
            if (!name) return { was: localUuid, status: 'unresolved', reason: 'no local form with that UUID' }
            const remoteUuid = await remote.searchFormByName(name)
            if (!remoteUuid) {
                const matches = (await remote.searchFormsByName(name)).slice(0, 5)
                return { was: localUuid, name, status: 'not-found', matches }
            }
            return { was: localUuid, now: remoteUuid, name, status: remoteUuid === localUuid ? 'unchanged' : 'remapped' }
        } catch (e) {
            return { was: localUuid, status: 'error', reason: e.message }
        }
    }

    async function remapConcept(localUuid, remote, overrides = {}) {
        if (overrides[localUuid]) {
            const now = overrides[localUuid]
            return {
                was: localUuid,
                now,
                name: '(explicit override)',
                status: now === localUuid ? 'unchanged' : 'overridden',
            }
        }
        try {
            const name = await localOpenmrs.conceptName(localUuid)
            if (!name) return { was: localUuid, status: 'unresolved', reason: 'no local concept with that UUID' }
            const remoteUuid = await remote.searchConceptByName(name)
            if (!remoteUuid) {
                const matches = (await remote.searchConceptsByName(name)).slice(0, 5)
                return { was: localUuid, name, status: 'not-found', matches }
            }
            return { was: localUuid, now: remoteUuid, name, status: remoteUuid === localUuid ? 'unchanged' : 'remapped' }
        } catch (e) {
            return { was: localUuid, status: 'error', reason: e.message }
        }
    }

    return router
}
