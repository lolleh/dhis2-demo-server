import React from 'react'
import { DataQuery } from '@dhis2/app-runtime'
import { CircularLoader, DataTable, DataTableBody, DataTableCell, DataTableColumnHeader, DataTableHead, DataTableRow, TableHead, Button } from '@dhis2/ui'

const query = {
    me: {
        resource: 'me',
    },
    organisationUnits: {
        resource: 'organisationUnits',
        params: {
            fields: ['id', 'displayName', 'level'],
            pageSize: 10,
            paging: false,
        },
    },
}

const MyApp = () => (
    <DataQuery query={query}>
        {({ error, loading, data }) => {
            if (error) return <span>ERROR: {error.message}</span>
            if (loading) return <CircularLoader />

            return (
                <div style={{ padding: 16 }}>
                    <h1>Welcome, {data.me.displayName}</h1>

                    <DataTable>
                        <DataTableHead>
                            <DataTableRow>
                                <DataTableColumnHeader>Org Unit</DataTableColumnHeader>
                                <DataTableColumnHeader>Level</DataTableColumnHeader>
                            </DataTableRow>
                        </DataTableHead>
                        <DataTableBody>
                            {data.organisationUnits.organisationUnits.map(ou => (
                                <DataTableRow key={ou.id}>
                                    <DataTableCell>{ou.displayName}</DataTableCell>
                                    <DataTableCell>{ou.level}</DataTableCell>
                                </DataTableRow>
                            ))}
                        </DataTableBody>
                    </DataTable>

                    <Button primary onClick={() => alert('Hello from My App!')}>
                        Click me
                    </Button>
                </div>
            )
        }}
    </DataQuery>
)

export default MyApp
