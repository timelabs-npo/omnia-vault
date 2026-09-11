// src-tauri/src/lit.rs
// OMNIA-LIT-001 — Bounded Immutable-Byte Publication Engine
// Implements exact 243-byte canonical receipt encoding, SQLite WAL CAS,
// pinned revision reads, atomic head generation advancement, and conflict receipts.
// Reference: v2/01_contracts/lit/LIT_RECEIPT_V1.md and TECH_SPEC_LIT_001.md

use rusqlite::{params, Connection, Result as SqlResult};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::Mutex;
use once_cell::sync::Lazy;

pub const RECEIPT_LEN: usize = 243;
pub const DOMAIN_TAG: &[u8; 17] = b"OMNIA-RECEIPT-V1\0";
pub const PUBLISH_DIGEST_TAG: &[u8; 17] = b"OMNIA-PUBLISH-V1\0";
pub const MANIFEST_TAG: &[u8; 18] = b"OMNIA-MANIFEST-V1\0";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LitOutcome {
    LocalCommitted = 1,
    Conflict = 2,
}

#[derive(Debug, Clone)]
pub struct PublishRequest {
    pub owner_id: [u8; 16],
    pub workspace_id: [u8; 16],
    pub replica_id: [u8; 16],
    pub operation_id: [u8; 16],
    pub expected_revision_digest: [u8; 32],
    pub expected_generation: u64,
    pub item_id: [u8; 16],
    pub data: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct LitReceipt {
    pub raw: [u8; RECEIPT_LEN],
    pub outcome: LitOutcome,
    pub request_digest: [u8; 32],
    pub result_revision_digest: [u8; 32],
    pub result_generation: u64,
}

impl LitReceipt {
    pub fn parse(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() != RECEIPT_LEN {
            return Err(format!("Invalid receipt length: expected {}, got {}", RECEIPT_LEN, bytes.len()));
        }

        if &bytes[0..17] != DOMAIN_TAG {
            return Err("Invalid receipt domain tag".into());
        }

        let outcome = match bytes[17] {
            1 => LitOutcome::LocalCommitted,
            2 => LitOutcome::Conflict,
            other => return Err(format!("Unknown outcome discriminator: {}", other)),
        };

        if bytes[18] != 1 {
            return Err(format!("Unsupported operation kind: {}", bytes[18]));
        }

        let mut raw = [0u8; RECEIPT_LEN];
        raw.copy_from_slice(bytes);

        let mut request_digest = [0u8; 32];
        request_digest.copy_from_slice(&bytes[83..115]);

        let mut result_revision_digest = [0u8; 32];
        result_revision_digest.copy_from_slice(&bytes[203..235]);

        let mut gen_bytes = [0u8; 8];
        gen_bytes.copy_from_slice(&bytes[235..243]);
        let result_generation = u64::from_be_bytes(gen_bytes);

        Ok(Self {
            raw,
            outcome,
            request_digest,
            result_revision_digest,
            result_generation,
        })
    }
}

pub struct LitStore {
    conn: Mutex<Connection>,
}

pub static DEFAULT_LIT_STORE: Lazy<LitStore> = Lazy::new(|| {
    let app_dir = dirs_next().unwrap_or_else(|| std::path::PathBuf::from("/tmp"));
    let db_path = app_dir.join("omnia_lit_v1.db");
    LitStore::open(&db_path).expect("Failed to initialize OMNIA-LIT-001 storage")
});

fn dirs_next() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".omnia"))
}

impl LitStore {
    pub fn open(path: &Path) -> SqlResult<Self> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(path)?;
        
        // Enforce SQLite WAL durability profile as specified by OMNIA-LIT-001
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
        ")?;

        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS lit_chunks (
                hash BLOB PRIMARY KEY,
                data BLOB NOT NULL,
                size INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lit_manifests (
                manifest_digest BLOB PRIMARY KEY,
                total_size INTEGER NOT NULL,
                chunk_hashes BLOB NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lit_heads (
                workspace_id BLOB NOT NULL,
                replica_id BLOB NOT NULL,
                revision_digest BLOB NOT NULL,
                generation INTEGER NOT NULL,
                PRIMARY KEY (workspace_id, replica_id)
            );

            CREATE TABLE IF NOT EXISTS lit_item_revisions (
                revision_digest BLOB NOT NULL,
                item_id BLOB NOT NULL,
                manifest_digest BLOB NOT NULL,
                PRIMARY KEY (revision_digest, item_id)
            );

            CREATE TABLE IF NOT EXISTS lit_receipts (
                operation_key BLOB PRIMARY KEY,
                outcome INTEGER NOT NULL,
                receipt_bytes BLOB NOT NULL,
                created_at INTEGER NOT NULL
            );
        ")?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn compute_manifest_digest(data: &[u8]) -> ([u8; 32], Vec<[u8; 32]>) {
        // Chunk size: 4 MiB (4 * 1024 * 1024)
        const CHUNK_SIZE: usize = 4 * 1024 * 1024;
        let mut chunk_hashes = Vec::new();

        if data.is_empty() {
            let empty_hash: [u8; 32] = Sha256::digest(b"").into();
            chunk_hashes.push(empty_hash);
        } else {
            for chunk in data.chunks(CHUNK_SIZE) {
                let hash: [u8; 32] = Sha256::digest(chunk).into();
                chunk_hashes.push(hash);
            }
        }

        let mut manifest_hasher = Sha256::new();
        manifest_hasher.update(MANIFEST_TAG);
        manifest_hasher.update(&(data.len() as u64).to_be_bytes());
        manifest_hasher.update(&(chunk_hashes.len() as u64).to_be_bytes());
        for ch in &chunk_hashes {
            manifest_hasher.update(ch);
        }
        let manifest_digest: [u8; 32] = manifest_hasher.finalize().into();

        (manifest_digest, chunk_hashes)
    }

    pub fn compute_request_digest(
        owner_id: &[u8; 16],
        workspace_id: &[u8; 16],
        replica_id: &[u8; 16],
        operation_id: &[u8; 16],
        expected_revision_digest: &[u8; 32],
        expected_generation: u64,
        item_id: &[u8; 16],
        claimed_file_manifest_digest: &[u8; 32],
    ) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(PUBLISH_DIGEST_TAG);
        hasher.update(owner_id);
        hasher.update(workspace_id);
        hasher.update(replica_id);
        hasher.update(operation_id);
        hasher.update(expected_revision_digest);
        hasher.update(&expected_generation.to_be_bytes());
        hasher.update(item_id);
        hasher.update(claimed_file_manifest_digest);
        hasher.finalize().into()
    }

    pub fn init_workspace(
        &self,
        workspace_id: &[u8; 16],
        replica_id: &[u8; 16],
    ) -> Result<([u8; 32], u64), String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT revision_digest, generation FROM lit_heads WHERE workspace_id = ? AND replica_id = ?")
            .map_err(|e| e.to_string())?;
        
        let existing: Option<(Vec<u8>, u64)> = stmt.query_row(params![workspace_id.as_slice(), replica_id.as_slice()], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).ok();

        if let Some((rev, gen)) = existing {
            let mut r = [0u8; 32];
            r.copy_from_slice(&rev);
            return Ok((r, gen));
        }

        // Genesis head: generation = 0, empty tree digest
        let genesis_revision: [u8; 32] = Sha256::digest(b"OMNIA-GENESIS-V1").into();
        conn.execute(
            "INSERT INTO lit_heads (workspace_id, replica_id, revision_digest, generation) VALUES (?, ?, ?, 0)",
            params![workspace_id.as_slice(), replica_id.as_slice(), genesis_revision.as_slice()]
        ).map_err(|e| e.to_string())?;

        Ok((genesis_revision, 0))
    }

    pub fn publish_item_bytes(&self, req: PublishRequest) -> Result<LitReceipt, String> {
        let (manifest_digest, chunk_hashes) = Self::compute_manifest_digest(&req.data);
        let request_digest = Self::compute_request_digest(
            &req.owner_id,
            &req.workspace_id,
            &req.replica_id,
            &req.operation_id,
            &req.expected_revision_digest,
            req.expected_generation,
            &req.item_id,
            &manifest_digest,
        );

        let mut op_key = Vec::with_capacity(64);
        op_key.extend_from_slice(&req.owner_id);
        op_key.extend_from_slice(&req.workspace_id);
        op_key.extend_from_slice(&req.replica_id);
        op_key.extend_from_slice(&req.operation_id);

        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // 1. Replay Check: If operation already executed, return cached receipt
        let cached_receipt: Option<Vec<u8>> = tx.query_row(
            "SELECT receipt_bytes FROM lit_receipts WHERE operation_key = ?",
            params![op_key.as_slice()],
            |row| row.get(0)
        ).ok();

        if let Some(r_bytes) = cached_receipt {
            return LitReceipt::parse(&r_bytes);
        }

        // 2. Persist Content-Addressed Chunks
        const CHUNK_SIZE: usize = 4 * 1024 * 1024;
        if req.data.is_empty() {
            let empty_hash: [u8; 32] = Sha256::digest(b"").into();
            tx.execute(
                "INSERT OR IGNORE INTO lit_chunks (hash, data, size) VALUES (?, ?, 0)",
                params![empty_hash.as_slice(), [].as_slice()]
            ).map_err(|e| e.to_string())?;
        } else {
            for chunk in req.data.chunks(CHUNK_SIZE) {
                let hash: [u8; 32] = Sha256::digest(chunk).into();
                tx.execute(
                    "INSERT OR IGNORE INTO lit_chunks (hash, data, size) VALUES (?, ?, ?)",
                    params![hash.as_slice(), chunk, chunk.len() as i64]
                ).map_err(|e| e.to_string())?;
            }
        }

        // 3. Persist Manifest
        let mut hashes_blob = Vec::new();
        for ch in &chunk_hashes {
            hashes_blob.extend_from_slice(ch);
        }
        tx.execute(
            "INSERT OR IGNORE INTO lit_manifests (manifest_digest, total_size, chunk_hashes) VALUES (?, ?, ?)",
            params![manifest_digest.as_slice(), req.data.len() as i64, hashes_blob.as_slice()]
        ).map_err(|e| e.to_string())?;

        // 4. Retrieve Current Head
        let head: Option<(Vec<u8>, u64)> = tx.query_row(
            "SELECT revision_digest, generation FROM lit_heads WHERE workspace_id = ? AND replica_id = ?",
            params![req.workspace_id.as_slice(), req.replica_id.as_slice()],
            |row| Ok((row.get(0)?, row.get(1)?))
        ).ok();

        let (cur_rev_bytes, cur_gen) = head.unwrap_or_else(|| {
            let genesis: [u8; 32] = Sha256::digest(b"OMNIA-GENESIS-V1").into();
            (genesis.to_vec(), 0)
        });

        let mut cur_rev = [0u8; 32];
        cur_rev.copy_from_slice(&cur_rev_bytes);

        // 5. Conditional Update: verify expected revision and generation match
        let (outcome, result_rev, result_gen) = if cur_rev == req.expected_revision_digest && cur_gen == req.expected_generation {
            let next_gen = req.expected_generation + 1;
            let mut rev_hasher = Sha256::new();
            rev_hasher.update(&cur_rev);
            rev_hasher.update(&req.item_id);
            rev_hasher.update(&manifest_digest);
            rev_hasher.update(&next_gen.to_be_bytes());
            let next_rev: [u8; 32] = rev_hasher.finalize().into();

            // Advance head
            tx.execute(
                "INSERT OR REPLACE INTO lit_heads (workspace_id, replica_id, revision_digest, generation) VALUES (?, ?, ?, ?)",
                params![req.workspace_id.as_slice(), req.replica_id.as_slice(), next_rev.as_slice(), next_gen as i64]
            ).map_err(|e| e.to_string())?;

            // Record item mapping in this revision
            tx.execute(
                "INSERT OR REPLACE INTO lit_item_revisions (revision_digest, item_id, manifest_digest) VALUES (?, ?, ?)",
                params![next_rev.as_slice(), req.item_id.as_slice(), manifest_digest.as_slice()]
            ).map_err(|e| e.to_string())?;

            (LitOutcome::LocalCommitted, next_rev, next_gen)
        } else {
            // Conflict
            (LitOutcome::Conflict, cur_rev, cur_gen)
        };

        // 6. Build Canonical 243-Byte Receipt
        let mut receipt_bytes = [0u8; RECEIPT_LEN];
        receipt_bytes[0..17].copy_from_slice(DOMAIN_TAG);
        receipt_bytes[17] = outcome as u8;
        receipt_bytes[18] = 1; // Operation kind: PublishItemBytesV1
        receipt_bytes[19..35].copy_from_slice(&req.owner_id);
        receipt_bytes[35..51].copy_from_slice(&req.workspace_id);
        receipt_bytes[51..67].copy_from_slice(&req.replica_id);
        receipt_bytes[67..83].copy_from_slice(&req.operation_id);
        receipt_bytes[83..115].copy_from_slice(&request_digest);
        receipt_bytes[115..147].copy_from_slice(&req.expected_revision_digest);
        receipt_bytes[147..155].copy_from_slice(&req.expected_generation.to_be_bytes());
        receipt_bytes[155..171].copy_from_slice(&req.item_id);
        receipt_bytes[171..203].copy_from_slice(&manifest_digest);
        receipt_bytes[203..235].copy_from_slice(&result_rev);
        receipt_bytes[235..243].copy_from_slice(&result_gen.to_be_bytes());

        // 7. Persist Receipt
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        tx.execute(
            "INSERT INTO lit_receipts (operation_key, outcome, receipt_bytes, created_at) VALUES (?, ?, ?, ?)",
            params![op_key.as_slice(), outcome as u8, receipt_bytes.as_slice(), now as i64]
        ).map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;

        LitReceipt::parse(&receipt_bytes)
    }

    pub fn read_pinned(&self, revision_digest: &[u8; 32], item_id: &[u8; 16]) -> Result<Vec<u8>, String> {
        let conn = self.conn.lock().unwrap();

        // 1. Lookup item's manifest in explicitly pinned revision
        let manifest_digest: Vec<u8> = conn.query_row(
            "SELECT manifest_digest FROM lit_item_revisions WHERE revision_digest = ? AND item_id = ?",
            params![revision_digest.as_slice(), item_id.as_slice()],
            |row| row.get(0)
        ).map_err(|_| "Item not found in pinned revision".to_string())?;

        // 2. Lookup manifest chunk hashes
        let chunk_hashes_blob: Vec<u8> = conn.query_row(
            "SELECT chunk_hashes FROM lit_manifests WHERE manifest_digest = ?",
            params![manifest_digest.as_slice()],
            |row| row.get(0)
        ).map_err(|_| "Manifest not found in CAS".to_string())?;

        if chunk_hashes_blob.len() % 32 != 0 {
            return Err("Corrupt chunk hashes in manifest".into());
        }

        // 3. Assemble and verify chunks
        let mut assembled_data = Vec::new();
        for chunk_hash in chunk_hashes_blob.chunks_exact(32) {
            let chunk_data: Vec<u8> = conn.query_row(
                "SELECT data FROM lit_chunks WHERE hash = ?",
                params![chunk_hash],
                |row| row.get(0)
            ).map_err(|_| "Missing chunk in CAS".to_string())?;

            let verify_hash: [u8; 32] = Sha256::digest(&chunk_data).into();
            if verify_hash != chunk_hash {
                return Err("Chunk SHA-256 corruption detected".into());
            }
            assembled_data.extend_from_slice(&chunk_data);
        }

        Ok(assembled_data)
    }

    pub fn get_head(&self, workspace_id: &[u8; 16], replica_id: &[u8; 16]) -> Result<([u8; 32], u64), String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT revision_digest, generation FROM lit_heads WHERE workspace_id = ? AND replica_id = ?",
            params![workspace_id.as_slice(), replica_id.as_slice()],
            |row| {
                let rev: Vec<u8> = row.get(0)?;
                let gen: i64 = row.get(1)?;
                let mut out = [0u8; 32];
                out.copy_from_slice(&rev);
                Ok((out, gen as u64))
            }
        ).map_err(|_| "No head found for workspace/replica".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lit_receipt_exact_243_bytes() {
        let temp_dir = std::env::temp_dir().join(format!("omnia_lit_test_{}", std::process::id()));
        let store = LitStore::open(&temp_dir.join("test.db")).expect("store open");

        let owner = [1u8; 16];
        let ws = [2u8; 16];
        let rep = [3u8; 16];
        let op = [4u8; 16];
        let item = [5u8; 16];

        let (genesis_rev, genesis_gen) = store.init_workspace(&ws, &rep).expect("init");
        assert_eq!(genesis_gen, 0);

        let payload = b"Hello OMNIA-LIT-001 immutable CAS publication world!".to_vec();
        let req = PublishRequest {
            owner_id: owner,
            workspace_id: ws,
            replica_id: rep,
            operation_id: op,
            expected_revision_digest: genesis_rev,
            expected_generation: genesis_gen,
            item_id: item,
            data: payload.clone(),
        };

        let receipt = store.publish_item_bytes(req).expect("publish");
        assert_eq!(receipt.raw.len(), 243);
        assert_eq!(receipt.outcome, LitOutcome::LocalCommitted);
        assert_eq!(receipt.result_generation, 1);

        // Verify pinned read
        let read_back = store.read_pinned(&receipt.result_revision_digest, &item).expect("read pinned");
        assert_eq!(read_back, payload);

        // Clean up
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_lit_conflict_on_mismatched_generation() {
        let temp_dir = std::env::temp_dir().join(format!("omnia_lit_conflict_{}", std::process::id()));
        let store = LitStore::open(&temp_dir.join("test.db")).expect("store open");

        let owner = [1u8; 16];
        let ws = [2u8; 16];
        let rep = [3u8; 16];
        let op = [4u8; 16];
        let item = [5u8; 16];

        let (genesis_rev, _) = store.init_workspace(&ws, &rep).expect("init");

        // Attempt publish with WRONG generation (e.g. 999 instead of 0)
        let req = PublishRequest {
            owner_id: owner,
            workspace_id: ws,
            replica_id: rep,
            operation_id: op,
            expected_revision_digest: genesis_rev,
            expected_generation: 999, // Mismatched!
            item_id: item,
            data: b"Conflict payload".to_vec(),
        };

        let receipt = store.publish_item_bytes(req).expect("publish conflict");
        assert_eq!(receipt.outcome, LitOutcome::Conflict);
        assert_eq!(receipt.result_generation, 0); // Head did not advance

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
