import React, { useState, useEffect } from 'react'
import {
    CircularLoader, NoticeBox, Button, Table, TableBody,
    TableCell, TableHead, TableRow, TableCellHead, Modal,
    ModalTitle, ModalContent, ModalActions, Input, Field,
    SingleSelect, SingleSelectOption, ButtonStrip
} from '@dhis2/ui'
import { api } from '../services/api'

const initialForm = {
    name: '', direction: 'omrs2dhis2', source_resource: 'patient',
    target_resource: '', field_mappings: '{}', schedule: ''
}

export default function Mappings() {
    const [mappings, setMappings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(initialForm)

    const load = () => {
        setLoading(true)
        api.getMappings().then(setMappings).catch(setError).finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    const openCreate = () => {
        setEditing(null)
        setForm(initialForm)
        setShowModal(true)
    }

    const openEdit = (m) => {
        setEditing(m)
        setForm({
            name: m.name, direction: m.direction,
            source_resource: m.source_resource, target_resource: m.target_resource,
            field_mappings: m.field_mappings, schedule: m.schedule || ''
        })
        setShowModal(true)
    }

    const save = async () => {
        if (editing) {
            await api.updateMapping(editing.id, form)
        } else {
            await api.createMapping(form)
        }
        setShowModal(false)
        load()
    }

    const remove = async (id) => {
        await api.deleteMapping(id)
        load()
    }

    if (loading) return <CircularLoader />
    if (error) return <NoticeBox title="Error" error>{error.message}</NoticeBox>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2>Data Mappings</h2>
                <Button primary onClick={openCreate}>Add Mapping</Button>
            </div>

            {mappings.length === 0 ? (
                <NoticeBox title="No Mappings">Create a mapping to start syncing data.</NoticeBox>
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCellHead>Name</TableCellHead>
                            <TableCellHead>Direction</TableCellHead>
                            <TableCellHead>Source</TableCellHead>
                            <TableCellHead>Target</TableCellHead>
                            <TableCellHead>Status</TableCellHead>
                            <TableCellHead>Actions</TableCellHead>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {mappings.map(m => (
                            <TableRow key={m.id}>
                                <TableCell>{m.name}</TableCell>
                                <TableCell>{m.direction === 'omrs2dhis2' ? 'OpenMRS → DHIS2' : 'DHIS2 → OpenMRS'}</TableCell>
                                <TableCell>{m.source_resource}</TableCell>
                                <TableCell>{m.target_resource}</TableCell>
                                <TableCell>{m.enabled ? 'Enabled' : 'Disabled'}</TableCell>
                                <TableCell>
                                    <ButtonStrip>
                                        <Button small onClick={() => openEdit(m)}>Edit</Button>
                                        <Button small destructive onClick={() => remove(m.id)}>Delete</Button>
                                    </ButtonStrip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {showModal && (
                <Modal onClose={() => setShowModal(false)}>
                    <ModalTitle>{editing ? 'Edit Mapping' : 'New Mapping'}</ModalTitle>
                    <ModalContent>
                        <Field label="Name">
                            <Input value={form.name} onChange={({ value }) => setForm(f => ({ ...f, name: value }))} />
                        </Field>
                        <Field label="Direction">
                            <SingleSelect selected={form.direction} onChange={({ selected }) => setForm(f => ({ ...f, direction: selected }))}>
                                <SingleSelectOption value="omrs2dhis2" label="OpenMRS → DHIS2" />
                                <SingleSelectOption value="dhis22omrs" label="DHIS2 → OpenMRS" />
                            </SingleSelect>
                        </Field>
                        <Field label="Source Resource">
                            <SingleSelect selected={form.source_resource} onChange={({ selected }) => setForm(f => ({ ...f, source_resource: selected }))}>
                                <SingleSelectOption value="patient" label="Patient" />
                                <SingleSelectOption value="encounter" label="Encounter" />
                                <SingleSelectOption value="observation" label="Observation" />
                                <SingleSelectOption value="trackedEntityInstance" label="Tracked Entity Instance" />
                                <SingleSelectOption value="event" label="Event" />
                            </SingleSelect>
                        </Field>
                        <Field label="Target Resource">
                            <Input value={form.target_resource} onChange={({ value }) => setForm(f => ({ ...f, target_resource: value }))} />
                        </Field>
                        <Field label="Schedule (cron)">
                            <Input value={form.schedule} onChange={({ value }) => setForm(f => ({ ...f, schedule: value }))} placeholder="0 2 * * * (daily at 2am)" />
                        </Field>
                    </ModalContent>
                    <ModalActions>
                        <ButtonStrip>
                            <Button onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button primary onClick={save}>{editing ? 'Update' : 'Create'}</Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </div>
    )
}
