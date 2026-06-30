import React, { useState, useEffect } from 'react'
import { CircularLoader, Card, NoticeBox, Button, Table, TableBody, TableCell, TableHead, TableRow, TableCellHead } from '@dhis2/ui'
import { api } from '../services/api'
import { useToast } from '../components/Toast'

function StatusBadge({ ok, label }) {
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 12,
            fontSize: 12, fontWeight: 600,
            backgroundColor: ok ? '#e0f2f1' : '#fce4ec',
            color: ok ? '#009688' : '#f44336',
        }}>
            {label || (ok ? 'Connected' : 'Disconnected')}
        </span>
    )
}

function StatCard({ label, value, color }) {
    return (
        <Card>
            <div style={{ padding: '16px 24px', minWidth: 160, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: color || '#1976d2' }}>{value}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{label}</div>
            </div>
        </Card>
    )
}

function timeAgo(dateStr) {
    if (!dateStr) return 'N/A'
    const diff = Date.now() - new Date(dateStr + 'Z').getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

export default function Dashboard() {
    const [health, setHealth] = useState(null)
    const [mappings, setMappings] = useState([])
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [syncing, setSyncing] = useState(false)
    const showToast = useToast()

    const load = async () => {
        setLoading(true)
        try {
            const [h, m, l] = await Promise.all([
                api.health(),
                api.getMappings().catch(() => []),
                api.getSyncLogs().catch(() => []),
            ])
            setHealth(h)
            setMappings(m)
            setLogs(l)
        } catch (e) {
            setError(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const totalRuns = logs.length
    const successfulRuns = logs.filter(l => l.status === 'success').length
    const failedRuns = logs.filter(l => l.status === 'failed').length
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0
    const lastSync = logs[0]?.started_at || null

    const runAllMappings = async () => {
        setSyncing(true)
        let count = 0
        for (const m of mappings) {
            try {
                await api.runSync(m.id)
                count++
            } catch (e) {
                // continue despite errors
            }
        }
        setSyncing(false)
        showToast(`Sync triggered for ${count} of ${mappings.length} mappings`, 'success')
        load()
    }

    if (loading) return <CircularLoader />
    if (error) return <NoticeBox title="Connection Error" error>{error.message}</NoticeBox>

    return (
        <div>
            <h2>Dashboard</h2>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <StatCard label="Data Mappings" value={mappings.length} color="#1976d2" />
                <StatCard label="Sync Runs" value={totalRuns} color="#009688" />
                <StatCard label="Success Rate" value={totalRuns > 0 ? `${successRate}%` : '-'} color={successRate >= 80 ? '#009688' : '#ff9800'} />
                <StatCard label="Last Sync" value={timeAgo(lastSync)} color="#666" />
            </div>

            <Card>
                <div style={{ padding: 16 }}>
                    <h3>System Health</h3>
                    <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                        <div>
                            <StatusBadge ok={health?.dhis2?.ok} />
                            <span style={{ marginLeft: 8, fontSize: 14 }}>DHIS2</span>
                            {health?.dhis2?.version && (
                                <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
                                    v{health.dhis2.version}
                                </span>
                            )}
                        </div>
                        <div>
                            <StatusBadge ok={health?.openmrs?.ok} />
                            <span style={{ marginLeft: 8, fontSize: 14 }}>OpenMRS</span>
                        </div>
                        <div>
                            <StatusBadge ok label="Running" />
                            <span style={{ marginLeft: 8, fontSize: 14 }}>Bridge Service</span>
                        </div>
                    </div>
                </div>
            </Card>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, marginBottom: 24 }}>
                <Button primary onClick={runAllMappings} loading={syncing}>
                    Run All Mappings
                </Button>
                <Button onClick={load}>Refresh</Button>
            </div>

            {logs.length > 0 && (
                <div>
                    <h3>Recent Sync Activity</h3>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCellHead>Mapping</TableCellHead>
                                <TableCellHead>Status</TableCellHead>
                                <TableCellHead>Processed</TableCellHead>
                                <TableCellHead>Failed</TableCellHead>
                                <TableCellHead>When</TableCellHead>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.slice(0, 5).map(log => (
                                <TableRow key={log.id}>
                                    <TableCell>{log.mapping_id}</TableCell>
                                    <TableCell>
                                        <span style={{
                                            display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                                            fontSize: 12, fontWeight: 600,
                                            backgroundColor: log.status === 'success' ? '#e0f2f1' :
                                                log.status === 'failed' ? '#fce4ec' : '#fff3e0',
                                            color: log.status === 'success' ? '#009688' :
                                                log.status === 'failed' ? '#f44336' : '#ff9800',
                                        }}>
                                            {log.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>{log.records_processed}</TableCell>
                                    <TableCell>{log.records_failed}</TableCell>
                                    <TableCell>{timeAgo(log.started_at)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
