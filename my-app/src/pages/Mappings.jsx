import React, { useState, useEffect } from 'react'
import {
    CircularLoader, NoticeBox, Button, Table, TableBody,
    TableCell, TableHead, TableRow, TableCellHead, Modal,
    ModalTitle, ModalContent, ModalActions, Input, Field,
    SingleSelect, SingleSelectOption, ButtonStrip, InputField,
} from '@dhis2/ui'
import { api } from '../services/api'
import { useToast } from '../components/Toast'

const initialForm = {
    name: '', direction: 'omrs2dhis2', source_resource: 'patient',
    target_resource: '', field_mappings: '{}', schedule: ''
}

function statusBadge(enabled) {
    return (
        <span className={enabled ? 'badge badge-enabled' : 'badge badge-disabled'}>
            {enabled ? 'Enabled' : 'Disabled'}
        </span>
    )
}

export default function Mappings() {
    const [mappings, setMappings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(initialForm)
    const [search, setSearch] = useState('')
    const [syncingId, setSyncingId] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [saving, setSaving] = useState(false)
    const showToast = useToast()

    const load = () => {
        setLoading(true)
        api.getMappings().then(setMappings).catch(setError).finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    const filtered = mappings.filter(m =>
        !search || m.name.toLowerCase().includes(search.toLowerCase())
    )

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
        setSaving(true)
        try {
            if (editing) {
                await api.updateMapping(editing.id, form)
                showToast('Mapping updated', 'success')
            } else {
                await api.createMapping(form)
                showToast('Mapping created', 'success')
            }
            setShowModal(false)
            load()
        } catch (e) {
            showToast(e.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (id) => {
        try {
            await api.deleteMapping(id)
            showToast('Mapping deleted', 'success')
            load()
        } catch (e) {
            showToast(e.message, 'error')
        }
        setConfirmDelete(null)
    }

    const runSync = async (id) => {
        setSyncingId(id)
        try {
            const result = await api.runSync(id)
            showToast(`Sync completed: ${result.processed} processed, ${result.failed} failed`, 'success')
            load()
        } catch (e) {
            showToast(e.message, 'error')
        } finally {
            setSyncingId(null)
        }
    }

    if (loading) return <CircularLoader />
    if (error) return <NoticeBox title="Error" error>{error.message}</NoticeBox>

    return (
        <div>
            <div className="page-header">
                <h2>Data Mappings</h2>
                <Button primary onClick={openCreate}>Add Mapping</Button>
            </div>

            {mappings.length > 3 && (
                <div className="search-wrapper">
                    <InputField
                        placeholder="Search mappings..."
                        value={search}
                        onChange={({ value }) => setSearch(value)}
                        dense
                    />
                </div>
            )}

            {filtered.length === 0 ? (
                <NoticeBox title={search ? 'No Matches' : 'No Mappings'}>
                    {search ? 'No mappings match your search.' : 'Create a mapping to start syncing data.'}
                </NoticeBox>
            ) : (
                <div className="table-wrapper">
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
                            {filtered.map(m => (
                                <TableRow key={m.id}>
                                    <TableCell style={{ fontWeight: 500 }}>{m.name}</TableCell>
                                    <TableCell>
                                        <span className="direction-label">
                                            {m.direction === 'omrs2dhis2' ? 'OpenMRS → DHIS2' : 'DHIS2 → OpenMRS'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="direction-label">{m.source_resource}</TableCell>
                                    <TableCell className="direction-label">{m.target_resource}</TableCell>
                                    <TableCell>{statusBadge(m.enabled)}</TableCell>
                                    <TableCell>
                                        <ButtonStrip>
                                            <Button small onClick={() => openEdit(m)}>Edit</Button>
                                            <Button
                                                small
                                                onClick={() => runSync(m.id)}
                                                loading={syncingId === m.id}
                                            >
                                                {syncingId === m.id ? 'Syncing...' : 'Run Sync'}
                                            </Button>
                                            <Button small destructive onClick={() => setConfirmDelete(m)}>Delete</Button>
                                        </ButtonStrip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
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
                            <Button primary onClick={save} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}

            {confirmDelete && (
                <Modal onClose={() => setConfirmDelete(null)}>
                    <ModalTitle>Delete Mapping</ModalTitle>
                    <ModalContent>
                        <p>Are you sure you want to delete mapping <strong>{confirmDelete.name}</strong>? This action cannot be undone.</p>
                    </ModalContent>
                    <ModalActions>
                        <ButtonStrip>
                            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
                            <Button destructive onClick={() => remove(confirmDelete.id)}>Delete</Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </div>
    )
}
