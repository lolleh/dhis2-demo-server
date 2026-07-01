import React, { useState, useEffect } from 'react'
import {
    CircularLoader, NoticeBox, Table, TableBody, TableCell,
    TableHead, TableRow, TableCellHead, Button, ButtonStrip,
    SingleSelect, SingleSelectOption,
} from '@dhis2/ui'
import { api } from '../services/api'

const PAGE_SIZE = 10

function timeAgo(dateStr) {
    if (!dateStr) return '-'
    const diff = Date.now() - new Date(dateStr + 'Z').getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

function formatDate(dateStr) {
    if (!dateStr) return '-'
    const d = new Date(dateStr + 'Z')
    return d.toLocaleString()
}

export default function SyncLogs() {
    const [logs, setLogs] = useState([])
    const [mappings, setMappings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filterMapping, setFilterMapping] = useState(null)
    const [filterStatus, setFilterStatus] = useState(null)
    const [page, setPage] = useState(0)

    const load = async () => {
        setLoading(true)
        try {
            const [l, m] = await Promise.all([
                api.getSyncLogs(filterMapping),
                api.getMappings()
            ])
            setLogs(l)
            setMappings(m)
        } catch (e) {
            setError(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [filterMapping])

    useEffect(() => { setPage(0) }, [filterMapping, filterStatus])

    const mappingName = (id) => mappings.find(m => m.id === id)?.name || `Mapping #${id}`

    const filtered = filterStatus
        ? logs.filter(l => l.status === filterStatus)
        : logs

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    const statusBadge = (status) => (
        <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 10,
            fontSize: 12, fontWeight: 600,
            backgroundColor: status === 'success' ? '#e0f2f1' :
                status === 'failed' ? '#fce4ec' : '#fff3e0',
            color: status === 'success' ? '#009688' :
                status === 'failed' ? '#f44336' : '#ff9800',
        }}>
            {status}
        </span>
    )

    if (loading) return <CircularLoader />
    if (error) return <NoticeBox title="Error" error>{error.message}</NoticeBox>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2>Sync Logs</h2>
                <ButtonStrip>
                    <Button primary small onClick={load}>Refresh</Button>
                </ButtonStrip>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'end' }}>
                <div style={{ minWidth: 200 }}>
                    <SingleSelect
                        placeholder="Filter by mapping"
                        selected={filterMapping ? String(filterMapping) : undefined}
                        onChange={({ selected }) => setFilterMapping(selected ? Number(selected) : null)}
                        clearable
                    >
                        {mappings.map(m => (
                            <SingleSelectOption key={m.id} value={String(m.id)} label={m.name} />
                        ))}
                    </SingleSelect>
                </div>
                <div style={{ minWidth: 150 }}>
                    <SingleSelect
                        placeholder="Filter by status"
                        selected={filterStatus}
                        onChange={({ selected }) => setFilterStatus(selected || null)}
                        clearable
                    >
                        <SingleSelectOption value="success" label="Success" />
                        <SingleSelectOption value="failed" label="Failed" />
                        <SingleSelectOption value="running" label="Running" />
                    </SingleSelect>
                </div>
                {(filterMapping || filterStatus) && (
                    <Button small onClick={() => { setFilterMapping(null); setFilterStatus(null) }}>
                        Clear Filters
                    </Button>
                )}
            </div>

            {filtered.length === 0 ? (
                <NoticeBox title="No Logs">Run a sync to see logs here.</NoticeBox>
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCellHead>Mapping</TableCellHead>
                            <TableCellHead>Status</TableCellHead>
                            <TableCellHead>Processed</TableCellHead>
                            <TableCellHead>Failed</TableCellHead>
                            <TableCellHead>Started</TableCellHead>
                            <TableCellHead>Duration</TableCellHead>
                            <TableCellHead>Error</TableCellHead>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paged.map(log => {
                            const duration = log.started_at && log.completed_at
                                ? timeAgo(log.started_at + 'Z') + ' (started)'
                                : '-'
                            return (
                                <TableRow key={log.id}>
                                    <TableCell style={{ fontWeight: 500 }}>{mappingName(log.mapping_id)}</TableCell>
                                    <TableCell>{statusBadge(log.status)}</TableCell>
                                    <TableCell>{log.records_processed}</TableCell>
                                    <TableCell>{log.records_failed}</TableCell>
                                    <TableCell title={formatDate(log.started_at)}>
                                        {timeAgo(log.started_at)}
                                    </TableCell>
                                    <TableCell>
                                        {log.started_at && log.completed_at
                                            ? `${Math.round((new Date(log.completed_at + 'Z') - new Date(log.started_at + 'Z')) / 1000)}s`
                                            : log.status === 'running' ? 'In progress...' : '-'}
                                    </TableCell>
                                    <TableCell style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {log.error || '-'}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            )}

            {pageCount > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                    <Button small disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        Previous
                    </Button>
                    <span style={{ fontSize: 13, color: '#666' }}>
                        Page {page + 1} of {pageCount} ({filtered.length} total)
                    </span>
                    <Button small disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>
                        Next
                    </Button>
                </div>
            )}
        </div>
    )
}
