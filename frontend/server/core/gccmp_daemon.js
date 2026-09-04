import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';

export class GCCmpDaemon {
    constructor(dbPath) {
        this.dbPath = dbPath;
        // Ensure the directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL'); // Essential for high concurrency local journal
        
        this.initSchema();
    }
    
    initSchema() {
        // Blobs: immutable content addressed storage
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS blobs (
                hash TEXT PRIMARY KEY,
                content BLOB NOT NULL,
                size INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Manifests: directories or file metadata state
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS manifests (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                path TEXT NOT NULL,
                blob_hash TEXT,
                parent_id TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Commits: Causal DAG
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS commits (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                manifest_id TEXT NOT NULL,
                author TEXT NOT NULL,
                message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(parent_id) REFERENCES commits(id),
                FOREIGN KEY(manifest_id) REFERENCES manifests(id)
            );
        `);
    }

    computeHash(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    // Simplistic API for Phase 1 to track AI agent events or user modifications
    commitEvent(author, filePath, contentStr, message) {
        const hash = this.computeHash(contentStr);
        const blobContent = Buffer.from(contentStr, 'utf8');
        
        const insertBlob = this.db.prepare('INSERT OR IGNORE INTO blobs (hash, content, size) VALUES (?, ?, ?)');
        insertBlob.run(hash, blobContent, blobContent.length);
        
        const manifestId = `man_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const insertManifest = this.db.prepare('INSERT INTO manifests (id, type, path, blob_hash, metadata) VALUES (?, ?, ?, ?, ?)');
        insertManifest.run(manifestId, 'file', filePath, hash, JSON.stringify({ source: author }));
        
        const commitId = `commit_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        // TODO: In Phase 2, calculate parent_id for true DAG logic. 
        // For now, this is a simplified offline journal entry.
        const insertCommit = this.db.prepare('INSERT INTO commits (id, parent_id, manifest_id, author, message) VALUES (?, ?, ?, ?, ?)');
        insertCommit.run(commitId, null, manifestId, author, message);
        
        return commitId;
    }
    
    getLatestCommits(limit = 10) {
        return this.db.prepare(`
            SELECT c.id as commitId, c.author, c.message, c.created_at, m.path, m.type, m.blob_hash 
            FROM commits c
            JOIN manifests m ON c.manifest_id = m.id
            ORDER BY c.created_at DESC
            LIMIT ?
        `).all(limit);
    }
}
