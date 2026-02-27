const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// In production, use /tmp (writable on most platforms like Render, Railway, Heroku)
// In development, use the project root
const DB_PATH = IS_PRODUCTION
    ? path.join('/tmp', 'moneytrack.db')
    : path.join(__dirname, '..', '..', 'moneytrack.db');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

async function initDatabase() {
    // Locate the sql.js WASM binary explicitly from node_modules
    const SQL = await initSqlJs({
        locateFile: file => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file)
    });

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
        console.log(`📂 Loaded existing database from ${DB_PATH}`);
    } else {
        db = new SQL.Database();
        console.log('🆕 Created new in-memory database');
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Initialize schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.run(schema);

    // Migration: add starting_balance if not present
    try {
        db.run("ALTER TABLE users ADD COLUMN starting_balance REAL DEFAULT 0");
    } catch (e) {
        // Column already exists — ignore
    }

    // Save to disk
    saveDatabase();

    return db;
}

function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('⚠️ Could not save database to disk:', err.message);
        // In production on read-only filesystems, this is expected
        // The database will still work in-memory
    }
}

function getDb() {
    if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
    return db;
}

// Helper: run a query and return all results as objects
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// Helper: run a query and return first result as object
function queryOne(sql, params = []) {
    const results = queryAll(sql, params);
    return results.length > 0 ? results[0] : null;
}

// Helper: run an insert/update/delete and return { changes, lastInsertRowid }
function runSql(sql, params = []) {
    db.run(sql, params);
    const changes = db.getRowsModified();
    const lastId = queryOne('SELECT last_insert_rowid() as id');
    saveDatabase();
    return { changes, lastInsertRowid: lastId ? lastId.id : 0 };
}

// Helper: execute raw SQL (for schema etc)
function execSql(sql) {
    db.run(sql);
    saveDatabase();
}

module.exports = { initDatabase, getDb, queryAll, queryOne, runSql, execSql, saveDatabase };
