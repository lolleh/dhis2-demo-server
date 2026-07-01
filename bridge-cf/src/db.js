export function createStore(db) {
    return {
        getMappings() {
            return db.prepare('SELECT * FROM mappings ORDER BY created_at DESC').all()
        },

        getMapping(id) {
            return db.prepare('SELECT * FROM mappings WHERE id = ?').get(id)
        },

        createMapping(data) {
            const result = db.prepare(`
                INSERT INTO mappings (name, direction, source_resource, target_resource, field_mappings, schedule)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(data.name, data.direction, data.source_resource, data.target_resource,
                JSON.stringify(data.field_mappings || {}), data.schedule || null)
            return this.getMapping(result.meta.last_row_id)
        },

        updateMapping(id, data) {
            db.prepare(`
                UPDATE mappings SET name = ?, direction = ?, source_resource = ?, target_resource = ?,
                    field_mappings = ?, schedule = ?, enabled = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(data.name, data.direction, data.source_resource, data.target_resource,
                JSON.stringify(data.field_mappings || {}), data.schedule, data.enabled ?? 1, id)
            return this.getMapping(id)
        },

        deleteMapping(id) {
            db.prepare('DELETE FROM mappings WHERE id = ?').run(id)
        },

        getSyncLogs(mappingId, limit = 50) {
            if (mappingId) {
                return db.prepare('SELECT * FROM sync_logs WHERE mapping_id = ? ORDER BY started_at DESC LIMIT ?').bind(mappingId, limit).all()
            }
            return db.prepare('SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT ?').bind(limit).all()
        },

        createSyncLog(data) {
            const result = db.prepare(`
                INSERT INTO sync_logs (mapping_id, status, records_processed, records_failed, error)
                VALUES (?, ?, ?, ?, ?)
            `).run(data.mapping_id, data.status || 'running', data.records_processed || 0, data.records_failed || 0, data.error || null)
            return result.meta.last_row_id
        },

        updateSyncLog(id, data) {
            db.prepare(`
                UPDATE sync_logs SET status = ?, records_processed = ?, records_failed = ?, error = ?,
                    completed_at = CASE WHEN ? IN ('success','failed') THEN datetime('now') ELSE NULL END
                WHERE id = ?
            `).run(data.status, data.records_processed || 0, data.records_failed || 0, data.error || null, data.status, id)
        },

        getConfig(key) {
            const row = db.prepare('SELECT value FROM sync_config WHERE key = ?').get(key)
            return row ? row.value : null
        },

        setConfig(key, value) {
            db.prepare('INSERT OR REPLACE INTO sync_config (key, value) VALUES (?, ?)').run(key, value)
        },
    }
}
