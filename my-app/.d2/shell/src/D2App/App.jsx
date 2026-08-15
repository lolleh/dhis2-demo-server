import React, { useState } from 'react'
import { TabBar, Tab } from '@dhis2/ui'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Mappings from './pages/Mappings'
import SyncLogs from './pages/SyncLogs'
import './App.css'

const PAGES = {
    dashboard: { label: 'Dashboard', component: Dashboard },
    mappings: { label: 'Mappings', component: Mappings },
    syncLogs: { label: 'Sync Logs', component: SyncLogs },
}

const InteropApp = () => {
    const [page, setPage] = useState('dashboard')
    const PageComponent = PAGES[page].component

    return (
        <ToastProvider>
            <div className="app-container" style={{ padding: 16 }}>
                <h1>Interoperability Bridge</h1>
                <TabBar>
                    {Object.entries(PAGES).map(([key, { label }]) => (
                        <Tab key={key} selected={page === key} onClick={() => setPage(key)}>
                            {label}
                        </Tab>
                    ))}
                </TabBar>
                <div style={{ padding: '16px 0' }}>
                    <PageComponent />
                </div>
            </div>
        </ToastProvider>
    )
}

export default InteropApp
