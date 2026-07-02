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
    const userVersion = db.pragma('user_version', { simple: true })

    db.exec(`
        CREATE TABLE IF NOT EXISTS mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            direction TEXT NOT NULL CHECK(direction IN ('omrs2dhis2', 'dhis22omrs', 'commcare2dhis2')),
            source_resource TEXT,
            target_resource TEXT,
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

    if (userVersion < 1) {
        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN mapping_type TEXT NOT NULL DEFAULT 'tracker'`)
        } catch (e) {
            // column may already exist
        }
        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN source_data_set TEXT`)
        } catch (e) {}
        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN target_data_set TEXT`)
        } catch (e) {}
        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN source_org_unit TEXT`)
        } catch (e) {}
        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN target_org_unit TEXT`)
        } catch (e) {}
        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN period_type TEXT DEFAULT 'Monthly'`)
        } catch (e) {}

        db.exec(`
            CREATE TABLE IF NOT EXISTS data_element_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mapping_id INTEGER NOT NULL,
                source_element TEXT NOT NULL,
                target_element TEXT NOT NULL,
                transformation TEXT DEFAULT 'direct',
                FOREIGN KEY (mapping_id) REFERENCES mappings(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_data_de_mappings_mapping ON data_element_mappings(mapping_id);
        `)

        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN commcare_form_xmlns TEXT`)
        } catch (e) {}
        try {
            db.exec(`ALTER TABLE mappings ADD COLUMN commcare_app_id TEXT`)
        } catch (e) {}

        db.pragma('user_version = 1')
    }
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
            INSERT INTO mappings (
                name, mapping_type, direction,
                source_resource, target_resource,
                source_data_set, target_data_set,
                source_org_unit, target_org_unit, period_type,
                field_mappings, schedule,
                commcare_form_xmlns, commcare_app_id
            ) VALUES (
                @name, @mapping_type, @direction,
                @source_resource, @target_resource,
                @source_data_set, @target_data_set,
                @source_org_unit, @target_org_unit, @period_type,
                @field_mappings, @schedule,
                @commcare_form_xmlns, @commcare_app_id
            )
        `)
        const result = stmt.run({
            name: data.name,
            mapping_type: data.mapping_type || 'tracker',
            direction: data.direction,
            source_resource: data.source_resource || null,
            target_resource: data.target_resource || null,
            source_data_set: data.source_data_set || null,
            target_data_set: data.target_data_set || null,
            source_org_unit: data.source_org_unit || null,
            target_org_unit: data.target_org_unit || null,
            period_type: data.period_type || 'Monthly',
            field_mappings: JSON.stringify(data.field_mappings || {}),
            schedule: data.schedule || null,
            commcare_form_xmlns: data.commcare_form_xmlns || null,
            commcare_app_id: data.commcare_app_id || null,
        })
        const mapping = store.getMapping(result.lastInsertRowid)
        if (data.element_mappings) {
            store.setElementMappings(mapping.id, data.element_mappings)
        }
        return store.getMapping(mapping.id)
    },

    updateMapping(id, data) {
        const existing = store.getMapping(id)
        if (!existing) return null
        const stmt = getDb().prepare(`
            UPDATE mappings SET
                name = @name, mapping_type = @mapping_type, direction = @direction,
                source_resource = @source_resource, target_resource = @target_resource,
                source_data_set = @source_data_set, target_data_set = @target_data_set,
                source_org_unit = @source_org_unit, target_org_unit = @target_org_unit,
                period_type = @period_type, field_mappings = @field_mappings,
                schedule = @schedule, enabled = @enabled,
                commcare_form_xmlns = @commcare_form_xmlns,
                commcare_app_id = @commcare_app_id,
                updated_at = datetime('now')
            WHERE id = @id
        `)
        stmt.run({
            id,
            name: data.name ?? existing.name,
            mapping_type: data.mapping_type ?? existing.mapping_type,
            direction: data.direction ?? existing.direction,
            source_resource: data.source_resource ?? existing.source_resource,
            target_resource: data.target_resource ?? existing.target_resource,
            source_data_set: data.source_data_set ?? existing.source_data_set,
            target_data_set: data.target_data_set ?? existing.target_data_set,
            source_org_unit: data.source_org_unit ?? existing.source_org_unit,
            target_org_unit: data.target_org_unit ?? existing.target_org_unit,
            period_type: data.period_type ?? existing.period_type,
            field_mappings: JSON.stringify(data.field_mappings ?? JSON.parse(existing.field_mappings || '{}')),
            schedule: data.schedule ?? existing.schedule,
            enabled: data.enabled ?? existing.enabled,
            commcare_form_xmlns: data.commcare_form_xmlns ?? existing.commcare_form_xmlns,
            commcare_app_id: data.commcare_app_id ?? existing.commcare_app_id,
        })
        if (data.element_mappings) {
            store.setElementMappings(id, data.element_mappings)
        }
        return store.getMapping(id)
    },

    deleteMapping(id) {
        getDb().prepare('DELETE FROM data_element_mappings WHERE mapping_id = ?').run(id)
        getDb().prepare('DELETE FROM mappings WHERE id = ?').run(id)
    },

    // Element-level field mappings
    getElementMappings(mappingId) {
        return getDb().prepare('SELECT * FROM data_element_mappings WHERE mapping_id = ? ORDER BY id').all(mappingId)
    },

    setElementMappings(mappingId, elements) {
        getDb().prepare('DELETE FROM data_element_mappings WHERE mapping_id = ?').run(mappingId)
        const stmt = getDb().prepare(`
            INSERT INTO data_element_mappings (mapping_id, source_element, target_element, transformation)
            VALUES (@mapping_id, @source_element, @target_element, @transformation)
        `)
        for (const el of elements) {
            stmt.run({
                mapping_id: mappingId,
                source_element: el.source_element,
                target_element: el.target_element,
                transformation: el.transformation || 'direct',
            })
        }
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
            error: data.error || null,
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
        `).run({
            id,
            status: data.status ?? 'running',
            records_processed: data.records_processed ?? 0,
            records_failed: data.records_failed ?? 0,
            error: data.error ?? null,
        })
    },

    // Config
    getConfig(key) {
        const row = getDb().prepare('SELECT value FROM sync_config WHERE key = ?').get(key)
        return row ? row.value : null
    },

    setConfig(key, value) {
        getDb().prepare('INSERT OR REPLACE INTO sync_config (key, value) VALUES (?, ?)').run(key, value)
    },
}

module.exports = store
