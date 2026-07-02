import React, { useState, useEffect } from 'react'
import {
    CircularLoader, NoticeBox, Button, Table, TableBody,
    TableCell, TableHead, TableRow, TableCellHead, Modal,
    ModalTitle, ModalContent, ModalActions, Input, Field,
    SingleSelect, SingleSelectOption, ButtonStrip, InputField,
    Tag,
} from '@dhis2/ui'
import { api } from '../services/api'
import { useToast } from '../components/Toast'

const initialForm = {
    name: '',
    mapping_type: 'tracker',
    direction: 'omrs2dhis2',
    source_resource: 'patient',
    target_resource: '',
    source_data_set: '',
    target_data_set: '',
    source_org_unit: '',
    target_org_unit: '',
    period_type: 'Monthly',
    schedule: '',
    element_mappings: [],
    commcare_form_xmlns: '',
    commcare_app_id: '',
}

function statusBadge(enabled) {
    return (
        <span className={enabled ? 'badge badge-enabled' : 'badge badge-disabled'}>
            {enabled ? 'Enabled' : 'Disabled'}
        </span>
    )
}

function typeBadge(type) {
    const cls = type === 'aggregate' ? 'badge badge-success' : 'badge badge-warning'
    return <span className={cls}>{type === 'aggregate' ? 'Aggregate' : 'Tracker'}</span>
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

    const [dataSets, setDataSets] = useState([])
    const [sourceDataSetDetails, setSourceDataSetDetails] = useState(null)
    const [targetDataSetDetails, setTargetDataSetDetails] = useState(null)
    const [orgUnits, setOrgUnits] = useState([])
    const [orgUnitLevel, setOrgUnitLevel] = useState('2')

    const showToast = useToast()

    const load = () => {
        setLoading(true)
        Promise.all([
            api.getMappings(),
            api.getDataSets(),
            api.getOrgUnits({ filter: `level:eq:${orgUnitLevel}`, pageSize: '500' }),
        ]).then(([m, ds, ou]) => {
            setMappings(m)
            setDataSets(ds.dataSets || [])
            setOrgUnits(ou.organisationUnits || [])
        }).catch(setError).finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    useEffect(() => {
        if (orgUnitLevel && showModal) {
            api.getOrgUnits({ filter: `level:eq:${orgUnitLevel}`, pageSize: '500' })
                .then(ou => setOrgUnits(ou.organisationUnits || []))
                .catch(() => {})
        }
    }, [orgUnitLevel, showModal])

    useEffect(() => {
        if (form.source_data_set) {
            api.getDataSet(form.source_data_set)
                .then(setSourceDataSetDetails)
                .catch(() => setSourceDataSetDetails(null))
        } else {
            setSourceDataSetDetails(null)
        }
    }, [form.source_data_set])

    useEffect(() => {
        if (form.target_data_set) {
            api.getDataSet(form.target_data_set)
                .then(setTargetDataSetDetails)
                .catch(() => setTargetDataSetDetails(null))
        } else {
            setTargetDataSetDetails(null)
        }
    }, [form.target_data_set])

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
            name: m.name,
            mapping_type: m.mapping_type || 'tracker',
            direction: m.direction,
            source_resource: m.source_resource || 'patient',
            target_resource: m.target_resource || '',
            source_data_set: m.source_data_set || '',
            target_data_set: m.target_data_set || '',
            source_org_unit: m.source_org_unit || '',
            target_org_unit: m.target_org_unit || '',
            period_type: m.period_type || 'Monthly',
            schedule: m.schedule || '',
            element_mappings: m.element_mappings || [],
            commcare_form_xmlns: m.commcare_form_xmlns || '',
            commcare_app_id: m.commcare_app_id || '',
        })
        setShowModal(true)
    }

    const save = async () => {
        setSaving(true)
        try {
            const payload = {
                name: form.name,
                mapping_type: form.mapping_type,
                direction: form.direction,
                schedule: form.schedule || null,
                element_mappings: form.element_mappings,
            }
            if (form.direction === 'commcare2dhis2') {
                payload.commcare_form_xmlns = form.commcare_form_xmlns
                payload.commcare_app_id = form.commcare_app_id || null
                payload.target_data_set = form.target_data_set
                payload.source_org_unit = form.source_org_unit
                payload.target_org_unit = null
                payload.period_type = form.period_type
                payload.source_resource = null
                payload.target_resource = null
                payload.source_data_set = null
                payload.mapping_type = 'aggregate'
            } else if (form.mapping_type === 'aggregate') {
                payload.source_data_set = form.source_data_set
                payload.target_data_set = form.target_data_set
                payload.source_org_unit = form.source_org_unit
                payload.target_org_unit = form.target_org_unit || null
                payload.period_type = form.period_type
                payload.source_resource = null
                payload.target_resource = null
            } else {
                payload.source_resource = form.source_resource
                payload.target_resource = form.target_resource
                payload.source_data_set = null
                payload.target_data_set = null
                payload.source_org_unit = null
                payload.target_org_unit = null
                payload.period_type = 'Monthly'
            }
            if (editing) {
                await api.updateMapping(editing.id, payload)
                showToast('Mapping updated', 'success')
            } else {
                await api.createMapping(payload)
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

    const sourceElements = sourceDataSetDetails?.dataSetElements?.map(de => de.dataElement) || []
    const targetElements = targetDataSetDetails?.dataSetElements?.map(de => de.dataElement) || []

    const addElementMapping = () => {
        const sourceEl = sourceElements[0]
        if (!sourceEl) return
        setForm(f => ({
            ...f,
            element_mappings: [
                ...f.element_mappings,
                { source_element: sourceEl.id, target_element: '', transformation: 'direct' },
            ],
        }))
    }

    const updateElementMapping = (index, field, value) => {
        setForm(f => {
            const em = [...f.element_mappings]
            em[index] = { ...em[index], [field]: value }
            return { ...f, element_mappings: em }
        })
    }

    const removeElementMapping = (index) => {
        setForm(f => ({
            ...f,
            element_mappings: f.element_mappings.filter((_, i) => i !== index),
        }))
    }

    const autoMapElements = () => {
        if (sourceElements.length === 0) return
        const mappings = sourceElements.map(se => {
            const match = targetElements.find(te =>
                te.name === se.name || te.code === se.code || te.id === se.id
            )
            return {
                source_element: se.id,
                target_element: match ? match.id : '',
                transformation: 'direct',
            }
        })
        setForm(f => ({ ...f, element_mappings: mappings }))
    }

    const orgUnitOptions = orgUnits.map(ou => ({
        value: ou.id,
        label: `${ou.name} (${ou.code || ou.id})`,
    }))

    const dataSetOptions = dataSets.map(ds => ({
        value: ds.id,
        label: ds.name,
    }))

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
                                <TableCellHead>Type</TableCellHead>
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
                                    <TableCell>{typeBadge(m.mapping_type || 'tracker')}</TableCell>
                                    <TableCell>
                                        <span className="direction-label">
                                            {m.direction === 'omrs2dhis2' ? 'OpenMRS → DHIS2' : m.direction === 'commcare2dhis2' ? 'CommCare → DHIS2' : 'DHIS2 → OpenMRS'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="direction-label">
                                        {m.mapping_type === 'aggregate'
                                            ? (m.source_data_set || '-')
                                            : (m.source_resource || '-')}
                                    </TableCell>
                                    <TableCell className="direction-label">
                                        {m.mapping_type === 'aggregate'
                                            ? (m.target_data_set || '-')
                                            : (m.target_resource || '-')}
                                    </TableCell>
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
                <Modal onClose={() => setShowModal(false)} large>
                    <ModalTitle>{editing ? 'Edit Mapping' : 'New Mapping'}</ModalTitle>
                    <ModalContent>
                        <Field label="Name">
                            <Input
                                value={form.name}
                                onChange={({ value }) => setForm(f => ({ ...f, name: value }))}
                                placeholder="e.g. HF Form 1 → DHIS2 Aggregate"
                            />
                        </Field>

                        <Field label="Mapping Type">
                            <SingleSelect
                                selected={form.mapping_type}
                                onChange={({ selected }) => setForm(f => ({ ...f, mapping_type: selected, element_mappings: [] }))}
                            >
                                <SingleSelectOption value="tracker" label="Tracker (patients, events)" />
                                <SingleSelectOption value="aggregate" label="Aggregate (forms, data sets)" />
                            </SingleSelect>
                        </Field>

                        <Field label="Direction">
                            <SingleSelect
                                selected={form.direction}
                                onChange={({ selected }) => setForm(f => ({ ...f, direction: selected, element_mappings: [] }))}
                            >
                                <SingleSelectOption value="omrs2dhis2" label="OpenMRS → DHIS2" />
                                <SingleSelectOption value="dhis22omrs" label="DHIS2 → OpenMRS" />
                                <SingleSelectOption value="commcare2dhis2" label="CommCare → DHIS2" />
                            </SingleSelect>
                        </Field>

                        {form.direction === 'commcare2dhis2' ? (
                            <>
                                <Field label="CommCare Form XMLNS">
                                    <Input
                                        value={form.commcare_form_xmlns}
                                        onChange={({ value }) => setForm(f => ({ ...f, commcare_form_xmlns: value }))}
                                        placeholder="http://..." 
                                    />
                                </Field>

                                <Field label="CommCare App ID (optional)">
                                    <Input
                                        value={form.commcare_app_id}
                                        onChange={({ value }) => setForm(f => ({ ...f, commcare_app_id: value }))}
                                    />
                                </Field>

                                {dataSetOptions.length > 0 && (
                                    <Field label="Target DHIS2 Form / Data Set">
                                        <SingleSelect
                                            selected={form.target_data_set || undefined}
                                            onChange={({ selected }) => setForm(f => ({ ...f, target_data_set: selected }))}
                                            clearable
                                        >
                                            {dataSetOptions.map(ds => (
                                                <SingleSelectOption key={ds.value} value={ds.value} label={ds.label} />
                                            ))}
                                        </SingleSelect>
                                    </Field>
                                )}

                                {targetDataSetDetails && (
                                    <div style={{ marginBottom: 8 }}>
                                        <Tag>{targetElements.length} data elements</Tag>
                                    </div>
                                )}

                                <Field label="Org Unit Level">
                                    <SingleSelect
                                        selected={orgUnitLevel}
                                        onChange={({ selected }) => setOrgUnitLevel(selected)}
                                    >
                                        <SingleSelectOption value="2" label="District" />
                                        <SingleSelectOption value="3" label="Facility" />
                                        <SingleSelectOption value="4" label="Sub-facility" />
                                    </SingleSelect>
                                </Field>

                                <Field label="Target Health Facility">
                                    <SingleSelect
                                        selected={form.source_org_unit || undefined}
                                        onChange={({ selected }) => setForm(f => ({ ...f, source_org_unit: selected }))}
                                        clearable
                                    >
                                        {orgUnitOptions.map(ou => (
                                            <SingleSelectOption key={ou.value} value={ou.value} label={ou.label} />
                                        ))}
                                    </SingleSelect>
                                </Field>

                                <Field label="Period Type">
                                    <SingleSelect
                                        selected={form.period_type}
                                        onChange={({ selected }) => setForm(f => ({ ...f, period_type: selected }))}
                                    >
                                        <SingleSelectOption value="Monthly" label="Monthly" />
                                        <SingleSelectOption value="Quarterly" label="Quarterly" />
                                        <SingleSelectOption value="Yearly" label="Yearly" />
                                    </SingleSelect>
                                </Field>

                                {targetElements.length > 0 && (
                                    <div style={{ marginTop: 16 }}>
                                        <div className="page-header">
                                            <h3>Field Mappings (CommCare question → DHIS2 data element)</h3>
                                            <ButtonStrip>
                                                <Button small onClick={addElementMapping}>
                                                    Add mapping
                                                </Button>
                                            </ButtonStrip>
                                        </div>

                                        {form.element_mappings.length === 0 ? (
                                            <NoticeBox title="No mappings">
                                                Add field mappings to define how CommCare question IDs map to DHIS2 data elements.
                                            </NoticeBox>
                                        ) : (
                                            <div className="table-wrapper">
                                                <Table>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCellHead>CommCare Question ID</TableCellHead>
                                                            <TableCellHead>DHIS2 Data Element</TableCellHead>
                                                            <TableCellHead />
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {form.element_mappings.map((em, i) => (
                                                            <TableRow key={i}>
                                                                <TableCell>
                                                                    <Input
                                                                        value={em.source_element}
                                                                        onChange={({ value }) => updateElementMapping(i, 'source_element', value)}
                                                                        placeholder="e.g. p1_q1"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <SingleSelect
                                                                    selected={em.target_element || undefined}
                                                                    onChange={({ selected }) => updateElementMapping(i, 'target_element', selected)}
                                                                    >
                                                                        {targetElements.map(el => (
                                                                            <SingleSelectOption key={el.id} value={el.id} label={`${el.name} (${el.code || el.id})`} />
                                                                        ))}
                                                                    </SingleSelect>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button small destructive onClick={() => removeElementMapping(i)}>Remove</Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : form.mapping_type === 'tracker' ? (
                            <>
                                <Field label="Source Resource">
                                    <SingleSelect
                                        selected={form.source_resource}
                                        onChange={({ selected }) => setForm(f => ({ ...f, source_resource: selected }))}
                                    >
                                        <SingleSelectOption value="patient" label="Patient" />
                                        <SingleSelectOption value="encounter" label="Encounter" />
                                        <SingleSelectOption value="observation" label="Observation" />
                                        <SingleSelectOption value="trackedEntityInstance" label="Tracked Entity Instance" />
                                        <SingleSelectOption value="event" label="Event" />
                                    </SingleSelect>
                                </Field>
                                <Field label="Target Resource">
                                    <Input
                                        value={form.target_resource}
                                        onChange={({ value }) => setForm(f => ({ ...f, target_resource: value }))}
                                    />
                                </Field>
                            </>
                        ) : (
                            <>
                                {dataSetOptions.length > 0 && (
                                    <Field label="Source Form / Data Set">
                                        <SingleSelect
                                            selected={form.source_data_set || undefined}
                                            onChange={({ selected }) => setForm(f => ({ ...f, source_data_set: selected }))}
                                            clearable
                                        >
                                            {dataSetOptions.map(ds => (
                                                <SingleSelectOption key={ds.value} value={ds.value} label={ds.label} />
                                            ))}
                                        </SingleSelect>
                                    </Field>
                                )}

                                {sourceDataSetDetails && (
                                    <div style={{ marginBottom: 8 }}>
                                        <Tag>{sourceElements.length} data elements</Tag>
                                    </div>
                                )}

                                {dataSetOptions.length > 0 && (
                                    <Field label="Target Form / Data Set">
                                        <SingleSelect
                                            selected={form.target_data_set || undefined}
                                            onChange={({ selected }) => setForm(f => ({ ...f, target_data_set: selected }))}
                                            clearable
                                        >
                                            {dataSetOptions.map(ds => (
                                                <SingleSelectOption key={ds.value} value={ds.value} label={ds.label} />
                                            ))}
                                        </SingleSelect>
                                    </Field>
                                )}

                                {targetDataSetDetails && (
                                    <div style={{ marginBottom: 8 }}>
                                        <Tag>{targetElements.length} data elements</Tag>
                                    </div>
                                )}

                                <Field label="Org Unit Level">
                                    <SingleSelect
                                        selected={orgUnitLevel}
                                        onChange={({ selected }) => setOrgUnitLevel(selected)}
                                    >
                                        <SingleSelectOption value="2" label="District" />
                                        <SingleSelectOption value="3" label="Facility" />
                                        <SingleSelectOption value="4" label="Sub-facility" />
                                    </SingleSelect>
                                </Field>

                                <Field label="Source Health Facility">
                                    <SingleSelect
                                        selected={form.source_org_unit || undefined}
                                        onChange={({ selected }) => setForm(f => ({ ...f, source_org_unit: selected }))}
                                        clearable
                                    >
                                        {orgUnitOptions.map(ou => (
                                            <SingleSelectOption key={ou.value} value={ou.value} label={ou.label} />
                                        ))}
                                    </SingleSelect>
                                </Field>

                                <Field label="Target Health Facility (optional)">
                                    <SingleSelect
                                        selected={form.target_org_unit || undefined}
                                        onChange={({ selected }) => setForm(f => ({ ...f, target_org_unit: selected }))}
                                        clearable
                                    >
                                        {orgUnitOptions.map(ou => (
                                            <SingleSelectOption key={ou.value} value={ou.value} label={ou.label} />
                                        ))}
                                    </SingleSelect>
                                </Field>

                                <Field label="Period Type">
                                    <SingleSelect
                                        selected={form.period_type}
                                        onChange={({ selected }) => setForm(f => ({ ...f, period_type: selected }))}
                                    >
                                        <SingleSelectOption value="Monthly" label="Monthly" />
                                        <SingleSelectOption value="Quarterly" label="Quarterly" />
                                        <SingleSelectOption value="Yearly" label="Yearly" />
                                    </SingleSelect>
                                </Field>

                                {sourceElements.length > 0 && (
                                    <div style={{ marginTop: 16 }}>
                                        <div className="page-header">
                                            <h3>Element Mappings</h3>
                                            <ButtonStrip>
                                                <Button small onClick={autoMapElements} disabled={targetElements.length === 0}>
                                                    Auto-map by name
                                                </Button>
                                                <Button small onClick={addElementMapping}>
                                                    Add mapping
                                                </Button>
                                            </ButtonStrip>
                                        </div>

                                        {form.element_mappings.length === 0 ? (
                                            <NoticeBox title="No mappings">
                                                Select source and target forms, then add element mappings to define how data fields are transformed.
                                            </NoticeBox>
                                        ) : (
                                            <div className="table-wrapper">
                                                <Table>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCellHead>Source Element</TableCellHead>
                                                            <TableCellHead>Target Element</TableCellHead>
                                                            <TableCellHead />
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {form.element_mappings.map((em, i) => (
                                                            <TableRow key={i}>
                                                                <TableCell>
                                                                    <SingleSelect
                                                                    selected={em.source_element || undefined}
                                                                    onChange={({ selected }) => updateElementMapping(i, 'source_element', selected)}
                                                                    >
                                                                        {sourceElements.map(el => (
                                                                            <SingleSelectOption key={el.id} value={el.id} label={`${el.name} (${el.code || el.id})`} />
                                                                        ))}
                                                                    </SingleSelect>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <SingleSelect
                                                                    selected={em.target_element || undefined}
                                                                    onChange={({ selected }) => updateElementMapping(i, 'target_element', selected)}
                                                                    >
                                                                        {targetElements.map(el => (
                                                                            <SingleSelectOption key={el.id} value={el.id} label={`${el.name} (${el.code || el.id})`} />
                                                                        ))}
                                                                    </SingleSelect>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button small destructive onClick={() => removeElementMapping(i)}>Remove</Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        <Field label="Schedule (cron)">
                            <Input
                                value={form.schedule}
                                onChange={({ value }) => setForm(f => ({ ...f, schedule: value }))}
                                placeholder="0 2 * * * (daily at 2am)"
                            />
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
