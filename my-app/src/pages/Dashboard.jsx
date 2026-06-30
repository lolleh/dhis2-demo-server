import React, { useState, useEffect } from 'react'
import { CircularLoader, Card, NoticeBox } from '@dhis2/ui'
import { api } from '../services/api'

export default function Dashboard() {
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        api.health().then(setHealth).catch(setError).finally(() => setLoading(false))
    }, [])

    if (loading) return <CircularLoader />
    if (error) return <NoticeBox title="Connection Error" error>{error.message}</NoticeBox>

    return (
        <div>
            <h2>System Health</h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                <Card>
                    <div style={{ padding: 16, minWidth: 200 }}>
                        <h3 style={{ color: health?.dhis2?.ok ? '#009688' : '#f44336' }}>
                            {health?.dhis2?.ok ? 'Connected' : 'Disconnected'}
                        </h3>
                        <p>DHIS2</p>
                        {health?.dhis2?.version && (
                            <small>v{health.dhis2.version}</small>
                        )}
                    </div>
                </Card>
                <Card>
                    <div style={{ padding: 16, minWidth: 200 }}>
                        <h3 style={{ color: health?.openmrs?.ok ? '#009688' : '#f44336' }}>
                            {health?.openmrs?.ok ? 'Connected' : 'Disconnected'}
                        </h3>
                        <p>OpenMRS</p>
                    </div>
                </Card>
                <Card>
                    <div style={{ padding: 16, minWidth: 200 }}>
                        <h3 style={{ color: '#009688' }}>Running</h3>
                        <p>Bridge Service</p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
