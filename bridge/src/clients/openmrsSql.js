// Optional direct-database source for OpenMRS. Exposes the same
// `formEncounters` interface as OpenmrsClient so the sync engine can use the
// REST API or the MySQL database interchangeably. Requires the optional
// `mysql2` dependency and OPENMRS_DB_* environment variables.
class OpenmrsSqlClient {
    constructor(options = {}) {
        this.config = {
            host: options.host || '',
            port: Number(options.port) || 3306,
            database: options.database || 'openmrs',
            user: options.user || '',
            password: options.password || '',
            connectTimeout: options.connectTimeout || 10000,
        }
        this.configured = Boolean(this.config.host && this.config.user && this.config.database)
    }

    driver() {
        if (!this._mysql) {
            try {
                this._mysql = require('mysql2/promise')
            } catch (e) {
                throw new Error('MySQL source requested but the mysql2 package is not installed')
            }
        }
        return this._mysql
    }

    async connect() {
        return this.driver().createConnection(this.config)
    }

    async ping() {
        if (!this.configured) return { ok: false, error: 'OpenMRS SQL source is not configured' }
        const conn = await this.connect()
        try {
            await conn.query('SELECT 1')
            return { ok: true }
        } finally {
            await conn.end()
        }
    }

    // Same interface as OpenmrsClient.formEncounters: accepts an OpenMRS form
    // UUID plus an optional date range and returns encounter objects shaped
    // like the REST representation (including inline obs).
    async formEncounters(formUuid, startDate, endDate, limit = 5000) {
        if (!this.configured) throw new Error('OpenMRS SQL source is not configured')
        if (!formUuid || !limit || limit <= 0) return []

        const conn = await this.connect()
        try {
            const rows = await this.fetchEncounters(conn, formUuid, startDate, endDate, limit)
            const obs = await this.fetchObs(conn, rows.map(r => r.encounter_id))
            return rows.map(r => ({
                uuid: r.encounter_uuid,
                encounterDatetime: this.toIso(r.encounter_datetime),
                form: { uuid: r.form_uuid },
                patient: {
                    uuid: r.patient_uuid,
                    person: {
                        gender: r.gender,
                        birthdate: r.birthdate ? this.toDateOnly(r.birthdate) : null,
                    },
                },
                obs: (obs.get(r.encounter_id) || []).map(o => ({ concept: { uuid: o.concept_uuid }, value: o.value })),
            }))
        } finally {
            await conn.end()
        }
    }

    async fetchEncounters(conn, formUuid, startDate, endDate, limit) {
        const where = ['e.voided = 0', 'f.uuid = ?', 'pe.voided = 0']
        const params = [formUuid]
        if (startDate) {
            where.push('e.encounter_datetime >= ?')
            params.push(`${startDate} 00:00:00`)
        }
        if (endDate) {
            where.push('e.encounter_datetime <= ?')
            params.push(`${endDate} 23:59:59`)
        }
        params.push(limit)

        const sql = `
            SELECT e.encounter_id, e.uuid AS encounter_uuid, e.encounter_datetime,
                   f.uuid AS form_uuid, pe.uuid AS patient_uuid, pe.gender, pe.birthdate
            FROM encounter e
            JOIN form f ON e.form_id = f.form_id
            JOIN person pe ON pe.person_id = e.patient_id
            WHERE ${where.join(' AND ')}
            ORDER BY e.encounter_datetime ASC
            LIMIT ?`
        const [rows] = await conn.query(sql, params)
        return rows
    }

    async fetchObs(conn, encounterIds) {
        const map = new Map()
        if (!encounterIds.length) return map
        const placeholders = encounterIds.map(() => '?').join(',')
        const sql = `
            SELECT o.encounter_id, c.uuid AS concept_uuid,
                   o.value_coded, o.value_numeric, o.value_text, o.value_datetime,
                   ac.uuid AS value_coded_uuid,
                   (SELECT cn.name FROM concept_name cn
                     WHERE cn.concept_id = ac.concept_id AND cn.voided = 0
                     ORDER BY cn.locale_preferred DESC, (cn.concept_name_type = 'FULLY_SPECIFIED') DESC
                     LIMIT 1) AS value_coded_display
            FROM obs o
            JOIN concept c ON o.concept_id = c.concept_id
            LEFT JOIN concept ac ON o.value_coded = ac.concept_id
            WHERE o.voided = 0 AND c.retired = 0 AND o.encounter_id IN (${placeholders})
            ORDER BY o.obs_id`
        const [rows] = await conn.query(sql, encounterIds)
        for (const r of rows) {
            if (!map.has(r.encounter_id)) map.set(r.encounter_id, [])
            map.get(r.encounter_id).push({ concept_uuid: r.concept_uuid, value: this.obsValue(r) })
        }
        return map
    }

    obsValue(r) {
        if (r.value_coded_uuid) {
            return { uuid: r.value_coded_uuid, display: r.value_coded_display || r.value_coded_uuid }
        }
        if (r.value_numeric !== null && r.value_numeric !== undefined) return Number(r.value_numeric)
        if (r.value_datetime) return this.toIso(r.value_datetime)
        if (r.value_text !== null && r.value_text !== undefined) return r.value_text
        return null
    }

    toIso(value) {
        return value ? new Date(value).toISOString() : null
    }

    toDateOnly(value) {
        if (value instanceof Date) return value.toISOString().slice(0, 10)
        return String(value).slice(0, 10)
    }
}

module.exports = OpenmrsSqlClient
