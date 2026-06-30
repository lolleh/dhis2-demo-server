const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'bridge.db')

let db

function getDb() {
    if (!db) {
        const fs = require('fs')
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
        db = new Database(DB_PATH)
        db.pragma('journal_mode = WAL')
        migrate()
    }
    return db
}

function migrate() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            direction TEXT NOT NULL CHECK(direction IN ('omrs2dhis2', 'dhis22omrs')),
            source_resource TEXT NOT NULL,
            target_resource TEXT NOT NULL,
            field_mappings TEXT NOT NULL DEFAULT '{}',
            schedule TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sync_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mapping_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
            records_processed INTEGER DEFAULT 0,
            records_failed INTEGER DEFAULT 0,
            error TEXT,
            started_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT,
            FOREIGN KEY (mapping_id) REFERENCES mappings(id)
        );

        CREATE TABLE IF NOT EXISTS sync_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `)
}

const store = {
    // Mappings
    getMappings() {
        return getDb().prepare('SELECT * FROM mappings ORDER BY created_at DESC').all()
    },

    getMapping(id) {
        return getDb().prepare('SELECT * FROM mappings WHERE id = ?').get(id)
    },

    createMapping(data) {
        const stmt = getDb().prepare(`
            INSERT INTO mappings (name, direction, source_resource, target_resource, field_mappings, schedule)
            VALUES (@name, @direction, @source_resource, @target_resource, @field_mappings, @schedule)
        `)
        const result = stmt.run({
            name: data.name,
            direction: data.direction,
            source_resource: data.source_resource,
            target_resource: data.target_resource,
            field_mappings: JSON.stringify(data.field_mappings || {}),
            schedule: data.schedule || null
        })
        return store.getMapping(result.lastInsertRowid)
    },

    updateMapping(id, data) {
        const stmt = getDb().prepare(`
            UPDATE mappings
            SET name = @name, direction = @direction, source_resource = @source_resource,
                target_resource = @target_resource, field_mappings = @field_mappings,
                schedule = @schedule, enabled = @enabled, updated_at = datetime('now')
            WHERE id = @id
        `)
        stmt.run({ id, ...data, field_mappings: JSON.stringify(data.field_mappings || {}) })
        return store.getMapping(id)
    },

    deleteMapping(id) {
        getDb().prepare('DELETE FROM mappings WHERE id = ?').run(id)
    },

    // Sync logs
    getSyncLogs(mappingId, limit = 50) {
        if (mappingId) {
            return getDb().prepare('SELECT * FROM sync_logs WHERE mapping_id = ? ORDER BY started_at DESC LIMIT ?').all(mappingId, limit)
        }
        return getDb().prepare('SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT ?').all(limit)
    },

    createSyncLog(data) {
        const stmt = getDb().prepare(`
            INSERT INTO sync_logs (mapping_id, status, records_processed, records_failed, error)
            VALUES (@mapping_id, @status, @records_processed, @records_failed, @error)
        `)
        const result = stmt.run({
            mapping_id: data.mapping_id,
            status: data.status || 'running',
            records_processed: data.records_processed || 0,
            records_failed: data.records_failed || 0,
            error: data.error || null
        })
        return result.lastInsertRowid
    },

    updateSyncLog(id, data) {
        getDb().prepare(`
            UPDATE sync_logs
            SET status = @status, records_processed = @records_processed,
                records_failed = @records_failed, error = @error,
                completed_at = CASE WHEN @status IN ('success','failed') THEN datetime('now') ELSE NULL END
            WHERE id = @id
        `).run({ id, ...data })
    },

    // Config
    getConfig(key) {
        const row = getDb().prepare('SELECT value FROM sync_config WHERE key = ?').get(key)
        return row ? row.value : null
    },

    setConfig(key, value) {
        getDb().prepare('INSERT OR REPLACE INTO sync_config (key, value) VALUES (?, ?)').run(key, value)
    }
}

module.exports = store
