import React, { useState, useEffect } from 'react'
import { CircularLoader, NoticeBox, Table, TableBody, TableCell, TableHead, TableRow, TableHeadCell, Button, ButtonStrip } from '@dhis2/ui'
import { api } from '../services/api'

export default function SyncLogs() {
    const [logs, setLogs] = useState([])
    const [mappings, setMappings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filter, setFilter] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const [l, m] = await Promise.all([
                api.getSyncLogs(filter),
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

    useEffect(() => { load() }, [filter])

    const mappingName = (id) => mappings.find(m => m.id === id)?.name || `Mapping #${id}`

    if (loading) return <CircularLoader />
    if (error) return <NoticeBox title="Error" error>{error.message}</NoticeBox>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2>Sync Logs</h2>
                <ButtonStrip>
                    {filter && <Button small onClick={() => setFilter(null)}>Clear Filter</Button>}
                    <Button primary small onClick={load}>Refresh</Button>
                </ButtonStrip>
            </div>

            {logs.length === 0 ? (
                <NoticeBox title="No Logs">Run a sync to see logs here.</NoticeBox>
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Mapping</TableHeadCell>
                            <TableHeadCell>Status</TableHeadCell>
                            <TableHeadCell>Processed</TableHeadCell>
                            <TableHeadCell>Failed</TableHeadCell>
                            <TableHeadCell>Started</TableHeadCell>
                            <TableHeadCell>Error</TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {logs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{mappingName(log.mapping_id)}</TableCell>
                                <TableCell>
                                    <span style={{
                                        color: log.status === 'success' ? '#009688' :
                                               log.status === 'failed' ? '#f44336' : '#ff9800'
                                    }}>
                                        {log.status}
                                    </span>
                                </TableCell>
                                <TableCell>{log.records_processed}</TableCell>
                                <TableCell>{log.records_failed}</TableCell>
                                <TableCell>{log.started_at}</TableCell>
                                <TableCell style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {log.error || '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}
