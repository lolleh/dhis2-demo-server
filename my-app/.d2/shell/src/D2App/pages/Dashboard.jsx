import React, { useState, useEffect } from 'react'
import { CircularLoader, Card, NoticeBox, Button, Table, TableBody, TableCell, TableHead, TableRow, TableCellHead, Modal, ModalTitle, ModalContent, ModalActions, ButtonStrip } from '@dhis2/ui'
import { api } from '../services/api'
import { useToast } from '../components/Toast'

const BADGE_CLASSES = {
    true: 'badge badge-success',
    false: 'badge badge-error',
}

function StatusBadge({ ok, label }) {
    return (
        <span className={BADGE_CLASSES[!!ok]}>
            {label || (ok ? 'Connected' : 'Disconnected')}
        </span>
    )
}

function StatCard({ label, value, color }) {
    return (
        <Card>
            <div style={{ padding: '16px 24px', textAlign: 'center' }}>
                <div className="stat-card-value" style={{ color: color || 'var(--colors-blue700)' }}>{value}</div>
                <div className="stat-card-label">{label}</div>
            </div>
        </Card>
    )
}

function formatDuration(startedAt, completedAt) {
    if (!startedAt || !completedAt) return null
    const diff = Math.round((new Date(completedAt + 'Z') - new Date(startedAt + 'Z')) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
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

function syncStatusBadge(status) {
    const cls = status === 'success' ? 'badge badge-success'
        : status === 'failed' ? 'badge badge-error'
        : 'badge badge-warning'
    return <span className={cls}>{status}</span>
}

export default function Dashboard() {
    const [health, setHealth] = useState(null)
    const [mappings, setMappings] = useState([])
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [syncing, setSyncing] = useState(false)
    const [confirmRunAll, setConfirmRunAll] = useState(false)
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
        setConfirmRunAll(false)
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

            <div className="stats-grid">
                <StatCard label="Data Mappings" value={mappings.length} color="var(--colors-blue700)" />
                <StatCard label="Sync Runs" value={totalRuns} color="var(--colors-teal700)" />
                <StatCard label="Success Rate" value={totalRuns > 0 ? `${successRate}%` : '-'} color={successRate >= 80 ? 'var(--colors-green700)' : 'var(--colors-yellow700)'} />
                <StatCard label="Last Sync" value={timeAgo(lastSync)} color="var(--colors-grey600)" />
            </div>

            <Card>
                <div style={{ padding: 16 }}>
                    <h3>System Health</h3>
                    <div className="health-row">
                        <div>
                            <StatusBadge ok={health?.dhis2?.ok} />
                            <span style={{ marginLeft: 8, fontSize: 14 }}>DHIS2</span>
                            {health?.dhis2?.version && (
                                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--colors-grey600)' }}>
                                    v{health.dhis2.version}
                                </span>
                            )}
                        </div>
                        <div>
                            <StatusBadge ok={health?.openmrs?.ok} />
                            <span style={{ marginLeft: 8, fontSize: 14 }}>OpenMRS</span>
                        </div>
                        <div>
                            <StatusBadge ok={health?.commcare?.ok} />
                            <span style={{ marginLeft: 8, fontSize: 14 }}>CommCare</span>
                        </div>
                        <div>
                            <StatusBadge ok label="Running" />
                            <span style={{ marginLeft: 8, fontSize: 14 }}>Bridge Service</span>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="action-bar">
                <Button primary onClick={() => setConfirmRunAll(true)} loading={syncing} disabled={mappings.length === 0}>
                    Run All Mappings
                </Button>
                <Button onClick={load}>Refresh</Button>
            </div>

            {mappings.length === 0 && !loading && (
                <NoticeBox title="No Mappings">
                    Create a mapping first before running syncs.
                </NoticeBox>
            )}

            {logs.length > 0 && (
                <div>
                    <h3>Recent Sync Activity</h3>
                    <div className="table-wrapper">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCellHead>Mapping</TableCellHead>
                                    <TableCellHead>Status</TableCellHead>
                                    <TableCellHead>Processed</TableCellHead>
                                    <TableCellHead>Failed</TableCellHead>
                                    <TableCellHead>Duration</TableCellHead>
                                    <TableCellHead>When</TableCellHead>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.slice(0, 5).map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell>{log.mapping_id}</TableCell>
                                        <TableCell>{syncStatusBadge(log.status)}</TableCell>
                                        <TableCell>{log.records_processed}</TableCell>
                                        <TableCell>{log.records_failed}</TableCell>
                                        <TableCell>{formatDuration(log.started_at, log.completed_at) || '-'}</TableCell>
                                        <TableCell>{timeAgo(log.started_at)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {confirmRunAll && (
                <Modal onClose={() => setConfirmRunAll(false)}>
                    <ModalTitle>Run All Mappings</ModalTitle>
                    <ModalContent>
                        <p>This will trigger a sync for all <strong>{mappings.length}</strong> mapping(s). Continue?</p>
                    </ModalContent>
                    <ModalActions>
                        <ButtonStrip>
                            <Button onClick={() => setConfirmRunAll(false)}>Cancel</Button>
                            <Button primary onClick={runAllMappings}>Run All</Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </div>
    )
}
