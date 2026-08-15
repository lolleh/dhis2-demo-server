import React, { useState, useEffect } from 'react'
import {
    CircularLoader, NoticeBox, Table, TableBody, TableCell,
    TableHead, TableRow, TableCellHead, Button, ButtonStrip,
    SingleSelect, SingleSelectOption,
} from '@dhis2/ui'
import { api } from '../services/api'

const PAGE_SIZE = 10

function formatDuration(startedAt, completedAt) {
    if (!startedAt || !completedAt) return null
    const diff = Math.round((new Date(completedAt + 'Z') - new Date(startedAt + 'Z')) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

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

function statusBadge(status) {
    const cls = status === 'success' ? 'badge badge-success'
        : status === 'failed' ? 'badge badge-error'
        : 'badge badge-warning'
    return <span className={cls}>{status}</span>
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

    if (loading) return <CircularLoader />
    if (error) return <NoticeBox title="Error" error>{error.message}</NoticeBox>

    return (
        <div>
            <div className="page-header">
                <h2>Sync Logs</h2>
                <ButtonStrip>
                    <Button primary small onClick={load}>Refresh</Button>
                </ButtonStrip>
            </div>

            <div className="filters-row">
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
                <div className="table-wrapper">
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
                            {paged.map(log => (
                                <TableRow key={log.id}>
                                    <TableCell style={{ fontWeight: 500 }}>{mappingName(log.mapping_id)}</TableCell>
                                    <TableCell>{statusBadge(log.status)}</TableCell>
                                    <TableCell>{log.records_processed}</TableCell>
                                    <TableCell>{log.records_failed}</TableCell>
                                    <TableCell title={formatDate(log.started_at)}>
                                        {timeAgo(log.started_at)}
                                    </TableCell>
                                    <TableCell>
                                        {formatDuration(log.started_at, log.completed_at)
                                            || (log.status === 'running' ? 'In progress...' : '-')}
                                    </TableCell>
                                    <TableCell className="truncate">
                                        {log.error || '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {pageCount > 1 && (
                <div className="pagination">
                    <Button small disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        Previous
                    </Button>
                    <span style={{ fontSize: 13, color: 'var(--colors-grey600)' }}>
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
