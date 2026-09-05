use std::collections::{BTreeMap, BTreeSet};
use std::ffi::CStr;
use std::fmt;
use std::fs::OpenOptions;
use std::io::{stderr, Write};
use std::os::raw::{c_char, c_void};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use rusqlite::{params, Connection, ErrorCode, OptionalExtension, Transaction, TransactionBehavior};

use super::encoding::*;
use super::types::*;

const BUSY_TIMEOUT_MS: u64 = 5_000;

fn test_failpoint(name: &str) {
    if std::env::var("OMNIA_LIT_FAILPOINT").ok().as_deref() != Some(name) {
        return;
    }
    if let Ok(path) = std::env::var("OMNIA_LIT_FAILPOINT_MARKER") {
        if let Ok(mut f) = OpenOptions::new().create(true).write(true).truncate(true).open(path) {
            let _ = writeln!(f, "{name}");
            let _ = f.sync_all();
        }
    }
    let _ = writeln!(stderr(), "OMNIA_LIT_FAILPOINT_REACHED:{name}");
    let _ = stderr().flush();
    loop { thread::sleep(Duration::from_secs(3600)); }
}
const SCHEMA_NAME: &[u8] = b"OMNIA-LIT-001";
const SQL_SCHEMA: &str = r#"
CREATE TABLE omnia_meta (
    key TEXT PRIMARY KEY,
    value BLOB NOT NULL
) STRICT;

CREATE TABLE chunks (
    object_id BLOB PRIMARY KEY CHECK(length(object_id)=32),
    bytes BLOB NOT NULL,
    byte_len INTEGER NOT NULL CHECK(byte_len >= 0 AND byte_len <= 4194304 AND length(bytes)=byte_len)
) STRICT;

CREATE TABLE file_manifests (
    file_manifest_id BLOB PRIMARY KEY CHECK(length(file_manifest_id)=32),
    total_length INTEGER NOT NULL CHECK(total_length >= 0 AND total_length <= 33554432),
    chunk_count INTEGER NOT NULL CHECK(chunk_count >= 0 AND chunk_count <= 8),
    canonical BLOB NOT NULL
) STRICT;

CREATE TABLE file_chunks (
    file_manifest_id BLOB NOT NULL CHECK(length(file_manifest_id)=32),
    ordinal INTEGER NOT NULL CHECK(ordinal >= 0 AND ordinal < 8),
    object_id BLOB NOT NULL CHECK(length(object_id)=32),
    chunk_length INTEGER NOT NULL CHECK(chunk_length > 0 AND chunk_length <= 4194304),
    PRIMARY KEY(file_manifest_id, ordinal),
    FOREIGN KEY(file_manifest_id) REFERENCES file_manifests(file_manifest_id),
    FOREIGN KEY(object_id) REFERENCES chunks(object_id)
) STRICT;

CREATE TABLE trees (
    tree_id BLOB PRIMARY KEY CHECK(length(tree_id)=32),
    item_count INTEGER NOT NULL CHECK(item_count >= 0 AND item_count <= 1024),
    canonical BLOB NOT NULL
) STRICT;

CREATE TABLE tree_items (
    tree_id BLOB NOT NULL CHECK(length(tree_id)=32),
    item_id BLOB NOT NULL CHECK(length(item_id)=16),
    file_manifest_id BLOB NOT NULL CHECK(length(file_manifest_id)=32),
    PRIMARY KEY(tree_id, item_id),
    FOREIGN KEY(tree_id) REFERENCES trees(tree_id),
    FOREIGN KEY(file_manifest_id) REFERENCES file_manifests(file_manifest_id)
) STRICT;

CREATE TABLE revisions (
    revision_id BLOB PRIMARY KEY CHECK(length(revision_id)=32),
    workspace_id BLOB NOT NULL CHECK(length(workspace_id)=16),
    replica_id BLOB NOT NULL CHECK(length(replica_id)=16),
    actor_id BLOB NOT NULL CHECK(length(actor_id)=16),
    operation_id BLOB NOT NULL CHECK(length(operation_id)=16),
    generation INTEGER NOT NULL CHECK(generation >= 0),
    parent_revision_id BLOB NULL CHECK(parent_revision_id IS NULL OR length(parent_revision_id)=32),
    tree_id BLOB NOT NULL CHECK(length(tree_id)=32),
    canonical BLOB NOT NULL,
    FOREIGN KEY(parent_revision_id) REFERENCES revisions(revision_id),
    FOREIGN KEY(tree_id) REFERENCES trees(tree_id),
    UNIQUE(workspace_id, replica_id, generation),
    UNIQUE(workspace_id, replica_id, operation_id),
    UNIQUE(workspace_id, replica_id, generation, revision_id),
    CHECK((generation=0 AND parent_revision_id IS NULL) OR (generation>0 AND parent_revision_id IS NOT NULL))
) STRICT;

CREATE TABLE heads (
    workspace_id BLOB NOT NULL CHECK(length(workspace_id)=16),
    replica_id BLOB NOT NULL CHECK(length(replica_id)=16),
    revision_id BLOB NOT NULL CHECK(length(revision_id)=32),
    generation INTEGER NOT NULL CHECK(generation >= 0),
    PRIMARY KEY(workspace_id, replica_id),
    FOREIGN KEY(revision_id) REFERENCES revisions(revision_id),
    FOREIGN KEY(workspace_id, replica_id, generation, revision_id)
        REFERENCES revisions(workspace_id, replica_id, generation, revision_id)
) STRICT;

CREATE TABLE receipts (
    owner_id BLOB NOT NULL CHECK(length(owner_id)=16),
    actor_id BLOB NOT NULL CHECK(length(actor_id)=16),
    workspace_id BLOB NOT NULL CHECK(length(workspace_id)=16),
    replica_id BLOB NOT NULL CHECK(length(replica_id)=16),
    operation_id BLOB NOT NULL CHECK(length(operation_id)=16),
    request_digest BLOB NOT NULL CHECK(length(request_digest)=32),
    kind INTEGER NOT NULL CHECK(kind IN (1,2)),
    expected_revision_id BLOB NOT NULL CHECK(length(expected_revision_id)=32),
    expected_generation INTEGER NOT NULL CHECK(expected_generation >= 0),
    result_revision_id BLOB NOT NULL CHECK(length(result_revision_id)=32),
    result_generation INTEGER NOT NULL CHECK(result_generation >= 0),
    item_id BLOB NOT NULL CHECK(length(item_id)=16),
    file_manifest_id BLOB NOT NULL CHECK(length(file_manifest_id)=32),
    canonical BLOB NOT NULL,
    PRIMARY KEY(owner_id, workspace_id, replica_id, operation_id),
    FOREIGN KEY(workspace_id, replica_id, result_generation, result_revision_id)
        REFERENCES revisions(workspace_id, replica_id, generation, revision_id),
    CHECK(kind != 1 OR result_generation = expected_generation + 1)
) STRICT;

CREATE UNIQUE INDEX one_success_per_generation
ON receipts(workspace_id, replica_id, result_generation)
WHERE kind=1;

CREATE TABLE bootstrap_receipts (
    owner_id BLOB NOT NULL CHECK(length(owner_id)=16),
    actor_id BLOB NOT NULL CHECK(length(actor_id)=16),
    workspace_id BLOB NOT NULL CHECK(length(workspace_id)=16),
    replica_id BLOB NOT NULL CHECK(length(replica_id)=16),
    operation_id BLOB NOT NULL CHECK(length(operation_id)=16),
    request_digest BLOB NOT NULL CHECK(length(request_digest)=32),
    genesis_revision_id BLOB NOT NULL CHECK(length(genesis_revision_id)=32),
    empty_tree_id BLOB NOT NULL CHECK(length(empty_tree_id)=32),
    canonical BLOB NOT NULL,
    PRIMARY KEY(owner_id, workspace_id, replica_id, operation_id),
    FOREIGN KEY(genesis_revision_id) REFERENCES revisions(revision_id),
    FOREIGN KEY(empty_tree_id) REFERENCES trees(tree_id)
) STRICT;

PRAGMA user_version=1;
"#;

#[derive(Debug)]
pub enum StoreError {
    UnsupportedSchema(u8),
    NamespaceMismatch(String),
    NotInitialized,
    AlreadyInitialized,
    Unauthorized,
    InputTooLarge { actual: usize, max: usize },
    ItemLimit,
    UniqueChunkLimit,
    LedgerFull,
    GenerationOverflow,
    ManifestMismatch { claimed: FileManifestId, actual: FileManifestId },
    OperationIdReuse,
    ItemNotFound,
    RevisionNotFound,
    Busy(String),
    Corrupt(String),
    Invariant(String),
    Storage(String),
    OutcomeUnknown(String),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedSchema(v) => write!(f, "unsupported schema version {v}"),
            Self::NamespaceMismatch(s) => write!(f, "namespace/schema mismatch: {s}"),
            Self::NotInitialized => f.write_str("store is not initialized"),
            Self::AlreadyInitialized => f.write_str("store is already initialized with a different bootstrap request"),
            Self::Unauthorized => f.write_str("host context does not own this store scope"),
            Self::InputTooLarge { actual, max } => write!(f, "input too large: {actual} > {max}"),
            Self::ItemLimit => f.write_str("root item limit reached"),
            Self::UniqueChunkLimit => f.write_str("retained unique chunk payload limit reached"),
            Self::LedgerFull => f.write_str("terminal operation receipt limit reached"),
            Self::GenerationOverflow => f.write_str("generation cannot advance"),
            Self::ManifestMismatch { claimed, actual } => write!(f, "claimed manifest {claimed} does not match captured bytes {actual}"),
            Self::OperationIdReuse => f.write_str("operation ID is already bound to a different request digest"),
            Self::ItemNotFound => f.write_str("item not found in pinned revision"),
            Self::RevisionNotFound => f.write_str("revision not found"),
            Self::Busy(s) => write!(f, "database busy/locked: {s}"),
            Self::Corrupt(s) => write!(f, "integrity failure: {s}"),
            Self::Invariant(s) => write!(f, "internal invariant failure: {s}"),
            Self::Storage(s) => write!(f, "storage error: {s}"),
            Self::OutcomeUnknown(s) => write!(f, "outcome unknown; reconcile with same operation ID: {s}"),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<rusqlite::Error> for StoreError {
    fn from(value: rusqlite::Error) -> Self {
        match &value {
            rusqlite::Error::SqliteFailure(code, message) => {
                let detail = message.clone().unwrap_or_else(|| value.to_string());
                match code.code {
                    ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => Self::Busy(detail),
                    ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase => Self::Corrupt(detail),
                    _ => Self::Storage(detail),
                }
            }
            _ => Self::Storage(value.to_string()),
        }
    }
}

#[derive(Debug, Clone)]
struct RevisionRecord {
    revision_id: RevisionId,
    workspace_id: WorkspaceId,
    replica_id: ReplicaId,
    actor_id: ActorId,
    operation_id: OperationId,
    generation: u64,
    parent_revision_id: Option<RevisionId>,
    tree_id: TreeId,
    canonical: Vec<u8>,
}

pub struct StateStore {
    path: PathBuf,
    conn: Connection,
    ctx: HostContext,
    write_blocked: bool,
}

impl StateStore {
    pub fn open(path: impl AsRef<Path>, ctx: HostContext) -> Result<Self, StoreError> {
        let path = path.as_ref().to_path_buf();
        let mut conn = Connection::open(&path)?;
        // Gate the linked SQLite engine before any schema/data write. Then reject a
        // foreign/unauthorized existing store before applying mutating durability PRAGMAs.
        ensure_supported_sqlite(&conn)?;
        ensure_schema(&mut conn)?;
        if identity_present(&conn)? {
            verify_identity(&conn, ctx)?;
        }
        configure_connection(&conn)?;
        Ok(Self { path, conn, ctx, write_blocked: false })
    }

    pub fn path(&self) -> &Path { &self.path }

    pub fn context(&self) -> HostContext { self.ctx }

    pub fn engine_info(&self) -> Result<EngineInfo, StoreError> {
        let sqlite_version: String = self.conn.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
        let sqlite_source_id: String = self.conn.query_row("SELECT sqlite_source_id()", [], |r| r.get(0))?;
        let vfs_name = diagnostic_vfs_name(&self.conn);
        let journal_mode: String = self.conn.query_row("PRAGMA journal_mode", [], |r| r.get(0))?;
        let synchronous: i64 = self.conn.query_row("PRAGMA synchronous", [], |r| r.get(0))?;
        let foreign_keys: i64 = self.conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?;
        #[cfg(target_os = "macos")]
        let fullfsync = Some(self.conn.query_row("PRAGMA fullfsync", [], |r| r.get(0))?);
        #[cfg(not(target_os = "macos"))]
        let fullfsync = None;
        let mut stmt = self.conn.prepare("PRAGMA compile_options")?;
        let compile_options = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(EngineInfo {
            sqlite_version,
            sqlite_source_id,
            vfs_name,
            compile_options,
            journal_mode,
            synchronous,
            foreign_keys,
            fullfsync,
            busy_timeout_ms: BUSY_TIMEOUT_MS,
        })
    }

    pub fn init_workspace(&mut self, request: InitWorkspaceV1) -> Result<BootstrapReceipt, StoreError> {
        if request.schema_version != SCHEMA_VERSION {
            return Err(StoreError::UnsupportedSchema(request.schema_version));
        }
        if self.write_blocked {
            return Err(StoreError::OutcomeUnknown("connection is blocked after an uncertain write; reopen and reconcile".into()));
        }
        let request_digest = init_request_digest(self.ctx, request.operation_id);

        if identity_present(&self.conn)? {
            verify_identity(&self.conn, self.ctx)?;
            if let Some(existing) = load_bootstrap_receipt(&self.conn, self.ctx, request.operation_id)? {
                if existing.request_digest != request_digest {
                    return Err(StoreError::OperationIdReuse);
                }
                return Ok(existing);
            }
            return Err(StoreError::AlreadyInitialized);
        }

        let tx = self.conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        if identity_present(&tx)? {
            // A competing identical bootstrap may have committed while this caller
            // waited for BEGIN IMMEDIATE. Reconcile the operation ledger before
            // deciding that initialization conflicts.
            verify_identity(&tx, self.ctx)?;
            if let Some(existing) = load_bootstrap_receipt(&tx, self.ctx, request.operation_id)? {
                if existing.request_digest != request_digest {
                    return Err(StoreError::OperationIdReuse);
                }
                tx.commit()?;
                return Ok(existing);
            }
            return Err(StoreError::AlreadyInitialized);
        }

        set_identity(&tx, self.ctx)?;

        let entries = BTreeMap::new();
        let (empty_tree_id, empty_tree_bytes) = tree_id(&entries);
        insert_or_verify_tree(&tx, empty_tree_id, &empty_tree_bytes, &entries)?;

        let (genesis_revision_id, genesis_bytes) = revision_id(
            self.ctx.workspace_id,
            self.ctx.replica_id,
            self.ctx.actor_id,
            request.operation_id,
            0,
            None,
            empty_tree_id,
        ).map_err(|e| StoreError::Invariant(e.into()))?;
        insert_or_verify_revision(&tx, RevisionRecord {
            revision_id: genesis_revision_id,
            workspace_id: self.ctx.workspace_id,
            replica_id: self.ctx.replica_id,
            actor_id: self.ctx.actor_id,
            operation_id: request.operation_id,
            generation: 0,
            parent_revision_id: None,
            tree_id: empty_tree_id,
            canonical: genesis_bytes,
        })?;

        tx.execute(
            "INSERT INTO heads(workspace_id,replica_id,revision_id,generation) VALUES(?1,?2,?3,0)",
            params![self.ctx.workspace_id.as_bytes().as_slice(), self.ctx.replica_id.as_bytes().as_slice(), genesis_revision_id.as_bytes().as_slice()],
        )?;

        let receipt = finalize_bootstrap_receipt(BootstrapReceipt {
            owner_id: self.ctx.owner_id,
            actor_id: self.ctx.actor_id,
            workspace_id: self.ctx.workspace_id,
            replica_id: self.ctx.replica_id,
            operation_id: request.operation_id,
            request_digest,
            genesis_head: Head { revision_id: genesis_revision_id, generation: 0 },
            empty_tree_id,
            canonical_bytes: Vec::new(),
            receipt_digest: ReceiptDigest([0; 32]),
        });
        insert_bootstrap_receipt(&tx, &receipt)?;

        if let Err(e) = tx.commit() {
            self.write_blocked = true;
            return Err(StoreError::OutcomeUnknown(e.to_string()));
        }
        Ok(receipt)
    }

    pub fn publish_item_bytes(&mut self, request: PublishItemBytesV1) -> Result<PublishReceipt, StoreError> {
        if request.schema_version != SCHEMA_VERSION {
            return Err(StoreError::UnsupportedSchema(request.schema_version));
        }
        if request.bytes.len() > MAX_INPUT_BYTES {
            return Err(StoreError::InputTooLarge { actual: request.bytes.len(), max: MAX_INPUT_BYTES });
        }
        if request.expected_head.generation >= MAX_GENERATION {
            return Err(StoreError::GenerationOverflow);
        }
        if self.write_blocked {
            return Err(StoreError::OutcomeUnknown("connection is blocked after an uncertain write; reopen and reconcile".into()));
        }
        verify_identity(&self.conn, self.ctx)?;

        let captured = capture_file(&request.bytes);
        if captured.file_manifest_id != request.claimed_file_manifest_id {
            return Err(StoreError::ManifestMismatch {
                claimed: request.claimed_file_manifest_id,
                actual: captured.file_manifest_id,
            });
        }
        let request_digest = publish_request_digest(
            self.ctx,
            request.operation_id,
            request.expected_head,
            request.item_id,
            captured.file_manifest_id,
        );

        test_failpoint("before_begin");
        let tx = self.conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        verify_identity(&tx, self.ctx)?;

        // Idempotency precedes fresh-head comparison.
        if let Some(existing) = load_publish_receipt(&tx, self.ctx, request.operation_id)? {
            if existing.request_digest != request_digest {
                return Err(StoreError::OperationIdReuse);
            }
            tx.commit()?;
            return Ok(existing);
        }
        // Bootstrap and publish operation IDs share one logical namespace.
        if load_bootstrap_receipt(&tx, self.ctx, request.operation_id)?.is_some() {
            return Err(StoreError::OperationIdReuse);
        }

        let receipt_count = count_publish_receipts(&tx, self.ctx)?;
        if receipt_count >= MAX_TERMINAL_RECEIPTS {
            return Err(StoreError::LedgerFull);
        }

        let current = load_head(&tx, self.ctx)?;
        let current_revision = validate_revision_closure(&tx, self.ctx, current.revision_id)?;
        if current_revision.generation != current.generation {
            return Err(StoreError::Corrupt("head generation disagrees with referenced revision".into()));
        }

        if current != request.expected_head {
            let receipt = finalize_publish_receipt(PublishReceipt {
                kind: PublishReceiptKind::Conflict,
                owner_id: self.ctx.owner_id,
                actor_id: self.ctx.actor_id,
                workspace_id: self.ctx.workspace_id,
                replica_id: self.ctx.replica_id,
                operation_id: request.operation_id,
                request_digest,
                expected_head: request.expected_head,
                result_head: current,
                item_id: request.item_id,
                file_manifest_id: captured.file_manifest_id,
                canonical_bytes: Vec::new(),
                receipt_digest: ReceiptDigest([0; 32]),
            });
            insert_publish_receipt(&tx, &receipt)?;
            test_failpoint("after_receipt_insert");
            test_failpoint("before_commit");
            if let Err(e) = tx.commit() {
                self.write_blocked = true;
                return Err(StoreError::OutcomeUnknown(e.to_string()));
            }
            test_failpoint("after_commit_before_response");
            return Ok(receipt);
        }

        enforce_unique_chunk_limit(&tx, &captured)?;
        insert_or_verify_captured_file(&tx, &captured)?;

        let base_revision = current_revision;
        let mut entries = load_and_verify_tree(&tx, base_revision.tree_id, true)?;
        if !entries.contains_key(&request.item_id) && entries.len() >= MAX_ITEMS_PER_ROOT {
            return Err(StoreError::ItemLimit);
        }
        entries.insert(request.item_id, captured.file_manifest_id);
        let (new_tree_id, new_tree_bytes) = tree_id(&entries);
        insert_or_verify_tree(&tx, new_tree_id, &new_tree_bytes, &entries)?;

        let new_generation = current.generation.checked_add(1).ok_or(StoreError::GenerationOverflow)?;
        if new_generation > MAX_GENERATION { return Err(StoreError::GenerationOverflow); }
        let (new_revision_id, new_revision_bytes) = revision_id(
            self.ctx.workspace_id,
            self.ctx.replica_id,
            self.ctx.actor_id,
            request.operation_id,
            new_generation,
            Some(current.revision_id),
            new_tree_id,
        ).map_err(|e| StoreError::Invariant(e.into()))?;
        insert_or_verify_revision(&tx, RevisionRecord {
            revision_id: new_revision_id,
            workspace_id: self.ctx.workspace_id,
            replica_id: self.ctx.replica_id,
            actor_id: self.ctx.actor_id,
            operation_id: request.operation_id,
            generation: new_generation,
            parent_revision_id: Some(current.revision_id),
            tree_id: new_tree_id,
            canonical: new_revision_bytes,
        })?;
        test_failpoint("after_manifest_revision_insert");

        validate_revision_closure(&tx, self.ctx, new_revision_id)?;

        let changed = tx.execute(
            "UPDATE heads SET revision_id=?1,generation=?2 WHERE workspace_id=?3 AND replica_id=?4 AND revision_id=?5 AND generation=?6",
            params![
                new_revision_id.as_bytes().as_slice(),
                to_i64(new_generation)?,
                self.ctx.workspace_id.as_bytes().as_slice(),
                self.ctx.replica_id.as_bytes().as_slice(),
                current.revision_id.as_bytes().as_slice(),
                to_i64(current.generation)?,
            ],
        )?;
        if changed != 1 {
            return Err(StoreError::Invariant(format!("conditional head update changed {changed} rows")));
        }
        test_failpoint("after_head_update");

        let receipt = finalize_publish_receipt(PublishReceipt {
            kind: PublishReceiptKind::LocalCommitted,
            owner_id: self.ctx.owner_id,
            actor_id: self.ctx.actor_id,
            workspace_id: self.ctx.workspace_id,
            replica_id: self.ctx.replica_id,
            operation_id: request.operation_id,
            request_digest,
            expected_head: current,
            result_head: Head { revision_id: new_revision_id, generation: new_generation },
            item_id: request.item_id,
            file_manifest_id: captured.file_manifest_id,
            canonical_bytes: Vec::new(),
            receipt_digest: ReceiptDigest([0; 32]),
        });
        insert_publish_receipt(&tx, &receipt)?;
        test_failpoint("after_receipt_insert");
        test_failpoint("before_commit");

        if let Err(e) = tx.commit() {
            self.write_blocked = true;
            return Err(StoreError::OutcomeUnknown(e.to_string()));
        }
        test_failpoint("after_commit_before_response");
        Ok(receipt)
    }

    pub fn get_head(&self) -> Result<Head, StoreError> {
        verify_identity(&self.conn, self.ctx)?;
        let head = load_head(&self.conn, self.ctx)?;
        let revision = validate_revision_closure(&self.conn, self.ctx, head.revision_id)?;
        if revision.generation != head.generation {
            return Err(StoreError::Corrupt("head generation disagrees with referenced revision".into()));
        }
        Ok(head)
    }

    pub fn get_operation(&self, operation_id: OperationId) -> Result<OperationObservation, StoreError> {
        verify_identity(&self.conn, self.ctx)?;
        if let Some(receipt) = load_publish_receipt(&self.conn, self.ctx, operation_id)? {
            return Ok(OperationObservation::Recorded(OperationReceipt::Publish(receipt)));
        }
        if let Some(receipt) = load_bootstrap_receipt(&self.conn, self.ctx, operation_id)? {
            return Ok(OperationObservation::Recorded(OperationReceipt::Bootstrap(receipt)));
        }
        Ok(OperationObservation::NotRecorded)
    }

    pub fn read_item(&self, revision_id: RevisionId, item_id: ItemId) -> Result<Vec<u8>, StoreError> {
        verify_identity(&self.conn, self.ctx)?;
        let revision = validate_revision_closure(&self.conn, self.ctx, revision_id)?;
        let entries = load_and_verify_tree(&self.conn, revision.tree_id, false)?;
        let manifest_id = entries.get(&item_id).copied().ok_or(StoreError::ItemNotFound)?;
        verify_manifest(&self.conn, manifest_id, true)?.ok_or(StoreError::Corrupt("manifest read returned no bytes".into()))
    }

    pub fn is_descendant(&self, descendant: RevisionId, ancestor: RevisionId) -> Result<bool, StoreError> {
        verify_identity(&self.conn, self.ctx)?;
        let mut cur = descendant;
        loop {
            if cur == ancestor { return Ok(true); }
            let rec = load_revision_record(&self.conn, cur)?.ok_or(StoreError::RevisionNotFound)?;
            validate_revision_record(&self.conn, self.ctx, &rec)?;
            match rec.parent_revision_id {
                Some(parent) => cur = parent,
                None => return Ok(false),
            }
        }
    }

    pub fn integrity_check(&self) -> Result<(), StoreError> {
        verify_identity(&self.conn, self.ctx)?;
        let result: String = self.conn.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
        if result != "ok" { return Err(StoreError::Corrupt(format!("sqlite integrity_check: {result}"))); }
        let head = load_head(&self.conn, self.ctx)?;
        let revision = validate_revision_closure(&self.conn, self.ctx, head.revision_id)?;
        if revision.generation != head.generation {
            return Err(StoreError::Corrupt("head generation disagrees with referenced revision".into()));
        }
        Ok(())
    }
}

fn sqlite_version_is_fixed(version: &str) -> bool {
    let mut parts = version.split('.');
    let Some(major) = parts.next().and_then(|v| v.parse::<u32>().ok()) else { return false; };
    let Some(minor) = parts.next().and_then(|v| v.parse::<u32>().ok()) else { return false; };
    let Some(patch) = parts.next().and_then(|v| v.parse::<u32>().ok()) else { return false; };
    if major != 3 { return false; }
    (minor > 51)
        || (minor == 51 && patch >= 3)
        || (minor == 50 && patch >= 7)
        || (minor == 44 && patch >= 6)
}

fn diagnostic_vfs_name(conn: &Connection) -> Option<String> {
    unsafe {
        let mut name_ptr: *mut c_char = std::ptr::null_mut();
        let rc = rusqlite::ffi::sqlite3_file_control(
            conn.handle(),
            b"main\0".as_ptr() as *const c_char,
            rusqlite::ffi::SQLITE_FCNTL_VFSNAME,
            (&mut name_ptr as *mut *mut c_char).cast::<c_void>(),
        );
        if rc != rusqlite::ffi::SQLITE_OK || name_ptr.is_null() { return None; }
        let name = CStr::from_ptr(name_ptr).to_string_lossy().into_owned();
        rusqlite::ffi::sqlite3_free(name_ptr.cast::<c_void>());
        Some(name)
    }
}

fn ensure_supported_sqlite(conn: &Connection) -> Result<(), StoreError> {
    let sqlite_version: String = conn.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
    if !sqlite_version_is_fixed(&sqlite_version) {
        return Err(StoreError::NamespaceMismatch(format!(
            "linked SQLite {sqlite_version} is outside the documented fixed WAL-reset release lines"
        )));
    }
    Ok(())
}

fn configure_connection(conn: &Connection) -> Result<(), StoreError> {
    // Recheck defensively at the configuration boundary; StateStore::open already
    // performed this check before schema creation.
    ensure_supported_sqlite(conn)?;
    conn.busy_timeout(Duration::from_millis(BUSY_TIMEOUT_MS))?;
    let journal: String = conn.query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0))?;
    if !journal.eq_ignore_ascii_case("wal") {
        return Err(StoreError::NamespaceMismatch(format!("required WAL, got {journal}")));
    }
    conn.execute_batch("PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;")?;
    #[cfg(target_os = "macos")]
    conn.execute_batch("PRAGMA fullfsync=ON;")?;
    let synchronous: i64 = conn.query_row("PRAGMA synchronous", [], |r| r.get(0))?;
    let foreign_keys: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?;
    if synchronous != 2 { return Err(StoreError::NamespaceMismatch(format!("required synchronous=FULL(2), got {synchronous}"))); }
    if foreign_keys != 1 { return Err(StoreError::NamespaceMismatch("foreign_keys did not enable".into())); }
    #[cfg(target_os = "macos")]
    {
        let fullfsync: i64 = conn.query_row("PRAGMA fullfsync", [], |r| r.get(0))?;
        if fullfsync != 1 { return Err(StoreError::NamespaceMismatch("fullfsync did not enable".into())); }
    }
    Ok(())
}

fn ensure_schema(conn: &mut Connection) -> Result<(), StoreError> {
    let schema_objects: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
        [], |r| r.get(0),
    )?;
    if schema_objects == 0 {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute_batch(SQL_SCHEMA)?;
        tx.execute("INSERT INTO omnia_meta(key,value) VALUES('schema_name',?1)", params![SCHEMA_NAME])?;
        tx.execute("INSERT INTO omnia_meta(key,value) VALUES('contract_version',?1)", params![CONTRACT_VERSION.as_bytes()])?;
        tx.commit()?;
        return Ok(());
    }
    let meta_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='omnia_meta'",
        [], |r| r.get(0),
    )?;
    if meta_exists != 1 { return Err(StoreError::NamespaceMismatch("nonempty database is not an OMNIA-LIT-001 store".into())); }
    let user_version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if user_version != 1 { return Err(StoreError::NamespaceMismatch(format!("unsupported SQLite user_version {user_version}"))); }
    let schema_name = meta_blob(conn, "schema_name")?.ok_or_else(|| StoreError::NamespaceMismatch("missing schema_name".into()))?;
    if schema_name != SCHEMA_NAME { return Err(StoreError::NamespaceMismatch("schema_name mismatch".into())); }
    let contract = meta_blob(conn, "contract_version")?.ok_or_else(|| StoreError::NamespaceMismatch("missing contract_version".into()))?;
    if contract != CONTRACT_VERSION.as_bytes() { return Err(StoreError::NamespaceMismatch("contract_version mismatch".into())); }
    Ok(())
}

fn meta_blob(conn: &Connection, key: &str) -> Result<Option<Vec<u8>>, StoreError> {
    Ok(conn.query_row("SELECT value FROM omnia_meta WHERE key=?1", params![key], |r| r.get(0)).optional()?)
}

fn identity_present(conn: &Connection) -> Result<bool, StoreError> {
    Ok(meta_blob(conn, "owner_id")?.is_some() || meta_blob(conn, "workspace_id")?.is_some() || meta_blob(conn, "replica_id")?.is_some())
}

fn set_identity(tx: &Transaction<'_>, ctx: HostContext) -> Result<(), StoreError> {
    tx.execute("INSERT INTO omnia_meta(key,value) VALUES('owner_id',?1)", params![ctx.owner_id.as_bytes().as_slice()])?;
    tx.execute("INSERT INTO omnia_meta(key,value) VALUES('workspace_id',?1)", params![ctx.workspace_id.as_bytes().as_slice()])?;
    tx.execute("INSERT INTO omnia_meta(key,value) VALUES('replica_id',?1)", params![ctx.replica_id.as_bytes().as_slice()])?;
    Ok(())
}

fn verify_identity(conn: &Connection, ctx: HostContext) -> Result<(), StoreError> {
    let owner = meta_blob(conn, "owner_id")?.ok_or(StoreError::NotInitialized)?;
    let workspace = meta_blob(conn, "workspace_id")?.ok_or(StoreError::NotInitialized)?;
    let replica = meta_blob(conn, "replica_id")?.ok_or(StoreError::NotInitialized)?;
    if owner.as_slice() != ctx.owner_id.as_bytes() || workspace.as_slice() != ctx.workspace_id.as_bytes() || replica.as_slice() != ctx.replica_id.as_bytes() {
        return Err(StoreError::Unauthorized);
    }
    Ok(())
}

fn to_i64(v: u64) -> Result<i64, StoreError> {
    i64::try_from(v).map_err(|_| StoreError::GenerationOverflow)
}

fn vec16(v: Vec<u8>, label: &str) -> Result<[u8; 16], StoreError> {
    v.try_into().map_err(|_| StoreError::Corrupt(format!("{label} width != 16")))
}

fn vec32(v: Vec<u8>, label: &str) -> Result<[u8; 32], StoreError> {
    v.try_into().map_err(|_| StoreError::Corrupt(format!("{label} width != 32")))
}

fn nonnegative_u64(v: i64, label: &str) -> Result<u64, StoreError> {
    u64::try_from(v).map_err(|_| StoreError::Corrupt(format!("negative {label}")))
}

fn load_head(conn: &Connection, ctx: HostContext) -> Result<Head, StoreError> {
    let row: Option<(Vec<u8>, i64)> = conn.query_row(
        "SELECT revision_id,generation FROM heads WHERE workspace_id=?1 AND replica_id=?2",
        params![ctx.workspace_id.as_bytes().as_slice(), ctx.replica_id.as_bytes().as_slice()],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).optional()?;
    let (revision, generation) = row.ok_or(StoreError::NotInitialized)?;
    Ok(Head { revision_id: RevisionId(vec32(revision, "head revision")?), generation: nonnegative_u64(generation, "head generation")? })
}

fn count_publish_receipts(conn: &Connection, ctx: HostContext) -> Result<u64, StoreError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM receipts WHERE owner_id=?1 AND workspace_id=?2 AND replica_id=?3",
        params![ctx.owner_id.as_bytes().as_slice(), ctx.workspace_id.as_bytes().as_slice(), ctx.replica_id.as_bytes().as_slice()],
        |r| r.get(0),
    )?;
    nonnegative_u64(n, "receipt count")
}

fn load_revision_record(conn: &Connection, revision_id: RevisionId) -> Result<Option<RevisionRecord>, StoreError> {
    let row = conn.query_row(
        "SELECT workspace_id,replica_id,actor_id,operation_id,generation,parent_revision_id,tree_id,canonical FROM revisions WHERE revision_id=?1",
        params![revision_id.as_bytes().as_slice()],
        |r| Ok((
            r.get::<_, Vec<u8>>(0)?, r.get::<_, Vec<u8>>(1)?, r.get::<_, Vec<u8>>(2)?, r.get::<_, Vec<u8>>(3)?,
            r.get::<_, i64>(4)?, r.get::<_, Option<Vec<u8>>>(5)?, r.get::<_, Vec<u8>>(6)?, r.get::<_, Vec<u8>>(7)?,
        )),
    ).optional()?;
    let Some((workspace, replica, actor, operation, generation, parent, tree, canonical)) = row else { return Ok(None); };
    Ok(Some(RevisionRecord {
        revision_id,
        workspace_id: WorkspaceId(vec16(workspace, "revision workspace")?),
        replica_id: ReplicaId(vec16(replica, "revision replica")?),
        actor_id: ActorId(vec16(actor, "revision actor")?),
        operation_id: OperationId(vec16(operation, "revision operation")?),
        generation: nonnegative_u64(generation, "revision generation")?,
        parent_revision_id: match parent { Some(v) => Some(RevisionId(vec32(v, "parent revision")?)), None => None },
        tree_id: TreeId(vec32(tree, "revision tree")?),
        canonical,
    }))
}

fn validate_revision_record(conn: &Connection, ctx: HostContext, record: &RevisionRecord) -> Result<(), StoreError> {
    if record.workspace_id != ctx.workspace_id || record.replica_id != ctx.replica_id {
        return Err(StoreError::Corrupt("revision namespace mismatch".into()));
    }
    let expected = revision_bytes(
        record.workspace_id, record.replica_id, record.actor_id, record.operation_id,
        record.generation, record.parent_revision_id, record.tree_id,
    ).map_err(|e| StoreError::Corrupt(e.into()))?;
    if expected != record.canonical || RevisionId(sha256(&expected)) != record.revision_id {
        return Err(StoreError::Corrupt(format!("revision {} canonical identity mismatch", record.revision_id)));
    }
    match record.parent_revision_id {
        None if record.generation != 0 => return Err(StoreError::Corrupt("non-genesis revision missing parent".into())),
        Some(_) if record.generation == 0 => return Err(StoreError::Corrupt("genesis revision has parent".into())),
        Some(parent_id) => {
            let parent = load_revision_record(conn, parent_id)?.ok_or_else(|| StoreError::Corrupt("missing parent revision".into()))?;
            if parent.workspace_id != record.workspace_id || parent.replica_id != record.replica_id {
                return Err(StoreError::Corrupt("parent namespace mismatch".into()));
            }
            let expected_generation = parent.generation.checked_add(1).ok_or_else(|| StoreError::Corrupt("parent generation overflow".into()))?;
            if expected_generation != record.generation {
                return Err(StoreError::Corrupt("revision generation is not parent+1".into()));
            }
        }
        None => {}
    }
    Ok(())
}

fn validate_revision_closure(conn: &Connection, ctx: HostContext, revision_id: RevisionId) -> Result<RevisionRecord, StoreError> {
    let record = load_revision_record(conn, revision_id)?.ok_or(StoreError::RevisionNotFound)?;
    validate_revision_record(conn, ctx, &record)?;
    load_and_verify_tree(conn, record.tree_id, true)?;
    Ok(record)
}

fn load_and_verify_tree(conn: &Connection, tree_id_value: TreeId, verify_manifests: bool) -> Result<BTreeMap<ItemId, FileManifestId>, StoreError> {
    let row: Option<(i64, Vec<u8>)> = conn.query_row(
        "SELECT item_count,canonical FROM trees WHERE tree_id=?1",
        params![tree_id_value.as_bytes().as_slice()],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).optional()?;
    let (item_count_i64, canonical) = row.ok_or_else(|| StoreError::Corrupt(format!("missing tree {tree_id_value}")))?;
    let item_count = usize::try_from(nonnegative_u64(item_count_i64, "tree item_count")?).map_err(|_| StoreError::Corrupt("tree item_count overflow".into()))?;
    if item_count > MAX_ITEMS_PER_ROOT { return Err(StoreError::Corrupt("tree exceeds item limit".into())); }

    let mut stmt = conn.prepare("SELECT item_id,file_manifest_id FROM tree_items WHERE tree_id=?1 ORDER BY item_id")?;
    let mut rows = stmt.query(params![tree_id_value.as_bytes().as_slice()])?;
    let mut entries = BTreeMap::new();
    while let Some(row) = rows.next()? {
        let item = ItemId(vec16(row.get::<_, Vec<u8>>(0)?, "tree item")?);
        let manifest = FileManifestId(vec32(row.get::<_, Vec<u8>>(1)?, "tree manifest")?);
        if entries.insert(item, manifest).is_some() {
            return Err(StoreError::Corrupt("duplicate tree item".into()));
        }
    }
    if entries.len() != item_count { return Err(StoreError::Corrupt("tree item_count mismatch".into())); }
    let (computed_id, computed_bytes) = tree_id(&entries);
    if computed_id != tree_id_value || computed_bytes != canonical {
        return Err(StoreError::Corrupt(format!("tree {tree_id_value} canonical identity mismatch")));
    }
    if verify_manifests {
        let mut seen = BTreeSet::new();
        for manifest in entries.values().copied() {
            if seen.insert(manifest) { verify_manifest(conn, manifest, false)?; }
        }
    }
    Ok(entries)
}

fn verify_manifest(conn: &Connection, manifest_id: FileManifestId, collect: bool) -> Result<Option<Vec<u8>>, StoreError> {
    let row: Option<(i64, i64, Vec<u8>)> = conn.query_row(
        "SELECT total_length,chunk_count,canonical FROM file_manifests WHERE file_manifest_id=?1",
        params![manifest_id.as_bytes().as_slice()],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).optional()?;
    let (total_i64, count_i64, stored_canonical) = row.ok_or_else(|| StoreError::Corrupt(format!("missing manifest {manifest_id}")))?;
    let total = nonnegative_u64(total_i64, "manifest total_length")?;
    let count = usize::try_from(nonnegative_u64(count_i64, "manifest chunk_count")?).map_err(|_| StoreError::Corrupt("chunk_count overflow".into()))?;
    if total > MAX_INPUT_BYTES as u64 || count > (MAX_INPUT_BYTES + CHUNK_SIZE - 1) / CHUNK_SIZE {
        return Err(StoreError::Corrupt("manifest exceeds bounded profile".into()));
    }
    if total == 0 && count != 0 { return Err(StoreError::Corrupt("empty manifest has chunks".into())); }
    if total > 0 && count == 0 { return Err(StoreError::Corrupt("nonempty manifest has zero chunks".into())); }

    let mut stmt = conn.prepare("SELECT ordinal,object_id,chunk_length FROM file_chunks WHERE file_manifest_id=?1 ORDER BY ordinal")?;
    let mut rows = stmt.query(params![manifest_id.as_bytes().as_slice()])?;
    let mut records: Vec<(ObjectId, usize)> = Vec::new();
    let mut content = if collect { Some(Vec::with_capacity(total as usize)) } else { None };
    let mut expected_ordinal = 0usize;
    let mut sum = 0u64;
    while let Some(row) = rows.next()? {
        let ordinal_i64: i64 = row.get(0)?;
        let ordinal = usize::try_from(nonnegative_u64(ordinal_i64, "chunk ordinal")?).map_err(|_| StoreError::Corrupt("chunk ordinal overflow".into()))?;
        if ordinal != expected_ordinal { return Err(StoreError::Corrupt("non-contiguous chunk ordinals".into())); }
        expected_ordinal += 1;
        let object_id = ObjectId(vec32(row.get::<_, Vec<u8>>(1)?, "object id")?);
        let len_i64: i64 = row.get(2)?;
        let len = usize::try_from(nonnegative_u64(len_i64, "chunk length")?).map_err(|_| StoreError::Corrupt("chunk length overflow".into()))?;
        let bytes: Vec<u8> = conn.query_row(
            "SELECT bytes FROM chunks WHERE object_id=?1",
            params![object_id.as_bytes().as_slice()], |r| r.get(0),
        ).optional()?.ok_or_else(|| StoreError::Corrupt(format!("missing chunk {object_id}")))?;
        if bytes.len() != len || ObjectId(sha256(&bytes)) != object_id {
            return Err(StoreError::Corrupt(format!("chunk {object_id} identity mismatch")));
        }
        if ordinal + 1 < count && len != CHUNK_SIZE { return Err(StoreError::Corrupt("nonfinal chunk has wrong length".into())); }
        if ordinal + 1 == count && (len == 0 || len > CHUNK_SIZE) { return Err(StoreError::Corrupt("final chunk has wrong length".into())); }
        sum = sum.checked_add(len as u64).ok_or_else(|| StoreError::Corrupt("manifest length overflow".into()))?;
        if let Some(buf) = content.as_mut() { buf.extend_from_slice(&bytes); }
        records.push((object_id, len));
    }
    if records.len() != count || sum != total { return Err(StoreError::Corrupt("manifest count/length mismatch".into())); }

    let mut canonical = Vec::new();
    canonical.extend_from_slice(b"OMNIA-FILE-V1\0");
    canonical.extend_from_slice(&total.to_be_bytes());
    canonical.extend_from_slice(&(count as u32).to_be_bytes());
    for (object_id, len) in records {
        canonical.extend_from_slice(object_id.as_bytes());
        canonical.extend_from_slice(&(len as u32).to_be_bytes());
    }
    if canonical != stored_canonical || FileManifestId(sha256(&canonical)) != manifest_id {
        return Err(StoreError::Corrupt(format!("manifest {manifest_id} canonical identity mismatch")));
    }
    Ok(content)
}

fn enforce_unique_chunk_limit(conn: &Connection, captured: &CapturedFile) -> Result<(), StoreError> {
    let current_i64: i64 = conn.query_row("SELECT COALESCE(SUM(byte_len),0) FROM chunks", [], |r| r.get(0))?;
    let current = nonnegative_u64(current_i64, "unique chunk bytes")?;
    let mut seen = BTreeSet::new();
    let mut additional = 0u64;
    for chunk in &captured.chunks {
        if !seen.insert(chunk.object_id) { continue; }
        let exists: Option<i64> = conn.query_row(
            "SELECT byte_len FROM chunks WHERE object_id=?1",
            params![chunk.object_id.as_bytes().as_slice()], |r| r.get(0),
        ).optional()?;
        if let Some(existing_len) = exists {
            if nonnegative_u64(existing_len, "existing chunk length")? != chunk.bytes.len() as u64 {
                return Err(StoreError::Corrupt("existing chunk length disagrees with captured object".into()));
            }
        } else {
            additional = additional.checked_add(chunk.bytes.len() as u64).ok_or(StoreError::UniqueChunkLimit)?;
        }
    }
    if current.checked_add(additional).ok_or(StoreError::UniqueChunkLimit)? > MAX_UNIQUE_CHUNK_BYTES {
        return Err(StoreError::UniqueChunkLimit);
    }
    Ok(())
}

fn insert_or_verify_captured_file(tx: &Transaction<'_>, captured: &CapturedFile) -> Result<(), StoreError> {
    for (chunk_index, chunk) in captured.chunks.iter().enumerate() {
        let existing: Option<Vec<u8>> = tx.query_row(
            "SELECT bytes FROM chunks WHERE object_id=?1",
            params![chunk.object_id.as_bytes().as_slice()], |r| r.get(0),
        ).optional()?;
        match existing {
            Some(bytes) => {
                if bytes != chunk.bytes || ObjectId(sha256(&bytes)) != chunk.object_id {
                    return Err(StoreError::Corrupt(format!("existing CAS chunk {} disagrees with its ID", chunk.object_id)));
                }
            }
            None => {
                tx.execute(
                    "INSERT INTO chunks(object_id,bytes,byte_len) VALUES(?1,?2,?3)",
                    params![chunk.object_id.as_bytes().as_slice(), &chunk.bytes, chunk.bytes.len() as i64],
                )?;
            }
        }
        if chunk_index == 0 { test_failpoint("after_first_chunk_insert"); }
    }

    let existing: Option<(i64, i64, Vec<u8>)> = tx.query_row(
        "SELECT total_length,chunk_count,canonical FROM file_manifests WHERE file_manifest_id=?1",
        params![captured.file_manifest_id.as_bytes().as_slice()],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).optional()?;
    if let Some((total, count, canonical)) = existing {
        if total != captured.total_length as i64 || count != captured.chunks.len() as i64 || canonical != captured.canonical_manifest {
            return Err(StoreError::Corrupt("existing manifest row disagrees with manifest ID".into()));
        }
        verify_manifest(tx, captured.file_manifest_id, false)?;
        return Ok(());
    }

    tx.execute(
        "INSERT INTO file_manifests(file_manifest_id,total_length,chunk_count,canonical) VALUES(?1,?2,?3,?4)",
        params![
            captured.file_manifest_id.as_bytes().as_slice(),
            captured.total_length as i64,
            captured.chunks.len() as i64,
            &captured.canonical_manifest,
        ],
    )?;
    for (ordinal, chunk) in captured.chunks.iter().enumerate() {
        tx.execute(
            "INSERT INTO file_chunks(file_manifest_id,ordinal,object_id,chunk_length) VALUES(?1,?2,?3,?4)",
            params![
                captured.file_manifest_id.as_bytes().as_slice(),
                ordinal as i64,
                chunk.object_id.as_bytes().as_slice(),
                chunk.bytes.len() as i64,
            ],
        )?;
    }
    verify_manifest(tx, captured.file_manifest_id, false)?;
    Ok(())
}

fn insert_or_verify_tree(tx: &Transaction<'_>, tree_id_value: TreeId, canonical: &[u8], entries: &BTreeMap<ItemId, FileManifestId>) -> Result<(), StoreError> {
    let existing: Option<(i64, Vec<u8>)> = tx.query_row(
        "SELECT item_count,canonical FROM trees WHERE tree_id=?1",
        params![tree_id_value.as_bytes().as_slice()], |r| Ok((r.get(0)?, r.get(1)?)),
    ).optional()?;
    if let Some((count, stored)) = existing {
        if count != entries.len() as i64 || stored != canonical {
            return Err(StoreError::Corrupt("existing tree row disagrees with tree ID".into()));
        }
        let loaded = load_and_verify_tree(tx, tree_id_value, false)?;
        if &loaded != entries { return Err(StoreError::Corrupt("existing tree items disagree with tree ID".into())); }
        return Ok(());
    }
    tx.execute(
        "INSERT INTO trees(tree_id,item_count,canonical) VALUES(?1,?2,?3)",
        params![tree_id_value.as_bytes().as_slice(), entries.len() as i64, canonical],
    )?;
    for (item, manifest) in entries {
        tx.execute(
            "INSERT INTO tree_items(tree_id,item_id,file_manifest_id) VALUES(?1,?2,?3)",
            params![tree_id_value.as_bytes().as_slice(), item.as_bytes().as_slice(), manifest.as_bytes().as_slice()],
        )?;
    }
    Ok(())
}

fn insert_or_verify_revision(tx: &Transaction<'_>, record: RevisionRecord) -> Result<(), StoreError> {
    if let Some(existing) = load_revision_record(tx, record.revision_id)? {
        if existing.workspace_id != record.workspace_id || existing.replica_id != record.replica_id ||
           existing.actor_id != record.actor_id || existing.operation_id != record.operation_id ||
           existing.generation != record.generation || existing.parent_revision_id != record.parent_revision_id ||
           existing.tree_id != record.tree_id || existing.canonical != record.canonical {
            return Err(StoreError::Corrupt("existing revision row disagrees with revision ID".into()));
        }
        return Ok(());
    }
    tx.execute(
        "INSERT INTO revisions(revision_id,workspace_id,replica_id,actor_id,operation_id,generation,parent_revision_id,tree_id,canonical) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            record.revision_id.as_bytes().as_slice(),
            record.workspace_id.as_bytes().as_slice(),
            record.replica_id.as_bytes().as_slice(),
            record.actor_id.as_bytes().as_slice(),
            record.operation_id.as_bytes().as_slice(),
            to_i64(record.generation)?,
            record.parent_revision_id.map(|v| v.as_bytes().to_vec()),
            record.tree_id.as_bytes().as_slice(),
            &record.canonical,
        ],
    )?;
    Ok(())
}

fn insert_publish_receipt(tx: &Transaction<'_>, receipt: &PublishReceipt) -> Result<(), StoreError> {
    tx.execute(
        "INSERT INTO receipts(owner_id,actor_id,workspace_id,replica_id,operation_id,request_digest,kind,expected_revision_id,expected_generation,result_revision_id,result_generation,item_id,file_manifest_id,canonical) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        params![
            receipt.owner_id.as_bytes().as_slice(), receipt.actor_id.as_bytes().as_slice(),
            receipt.workspace_id.as_bytes().as_slice(), receipt.replica_id.as_bytes().as_slice(),
            receipt.operation_id.as_bytes().as_slice(), receipt.request_digest.as_bytes().as_slice(),
            receipt.kind as i64, receipt.expected_head.revision_id.as_bytes().as_slice(),
            to_i64(receipt.expected_head.generation)?, receipt.result_head.revision_id.as_bytes().as_slice(),
            to_i64(receipt.result_head.generation)?, receipt.item_id.as_bytes().as_slice(),
            receipt.file_manifest_id.as_bytes().as_slice(), &receipt.canonical_bytes,
        ],
    )?;
    Ok(())
}

fn load_publish_receipt(conn: &Connection, ctx: HostContext, operation_id: OperationId) -> Result<Option<PublishReceipt>, StoreError> {
    let row = conn.query_row(
        "SELECT actor_id,request_digest,kind,expected_revision_id,expected_generation,result_revision_id,result_generation,item_id,file_manifest_id,canonical FROM receipts WHERE owner_id=?1 AND workspace_id=?2 AND replica_id=?3 AND operation_id=?4",
        params![ctx.owner_id.as_bytes().as_slice(), ctx.workspace_id.as_bytes().as_slice(), ctx.replica_id.as_bytes().as_slice(), operation_id.as_bytes().as_slice()],
        |r| Ok((
            r.get::<_, Vec<u8>>(0)?, r.get::<_, Vec<u8>>(1)?, r.get::<_, i64>(2)?, r.get::<_, Vec<u8>>(3)?, r.get::<_, i64>(4)?,
            r.get::<_, Vec<u8>>(5)?, r.get::<_, i64>(6)?, r.get::<_, Vec<u8>>(7)?, r.get::<_, Vec<u8>>(8)?, r.get::<_, Vec<u8>>(9)?,
        )),
    ).optional()?;
    let Some((actor, req, kind_i64, expected_rev, expected_gen, result_rev, result_gen, item, manifest, canonical)) = row else { return Ok(None); };
    let kind = PublishReceiptKind::from_i64(kind_i64).ok_or_else(|| StoreError::Corrupt("unknown receipt kind".into()))?;
    let mut receipt = PublishReceipt {
        kind,
        owner_id: ctx.owner_id,
        actor_id: ActorId(vec16(actor, "receipt actor")?),
        workspace_id: ctx.workspace_id,
        replica_id: ctx.replica_id,
        operation_id,
        request_digest: RequestDigest(vec32(req, "receipt request digest")?),
        expected_head: Head { revision_id: RevisionId(vec32(expected_rev, "receipt expected revision")?), generation: nonnegative_u64(expected_gen, "receipt expected generation")? },
        result_head: Head { revision_id: RevisionId(vec32(result_rev, "receipt result revision")?), generation: nonnegative_u64(result_gen, "receipt result generation")? },
        item_id: ItemId(vec16(item, "receipt item")?),
        file_manifest_id: FileManifestId(vec32(manifest, "receipt manifest")?),
        canonical_bytes: canonical,
        receipt_digest: ReceiptDigest([0; 32]),
    };
    let digest_ctx = HostContext {
        owner_id: receipt.owner_id, actor_id: receipt.actor_id,
        workspace_id: receipt.workspace_id, replica_id: receipt.replica_id,
    };
    let computed_request_digest = publish_request_digest(
        digest_ctx, receipt.operation_id, receipt.expected_head, receipt.item_id, receipt.file_manifest_id,
    );
    if computed_request_digest != receipt.request_digest {
        return Err(StoreError::Corrupt("publish receipt request digest mismatch".into()));
    }
    let expected_canonical = publish_receipt_bytes(&receipt);
    if expected_canonical != receipt.canonical_bytes {
        return Err(StoreError::Corrupt("publish receipt canonical bytes mismatch".into()));
    }
    receipt.receipt_digest = ReceiptDigest(sha256(&expected_canonical));
    let result_revision = validate_revision_closure(conn, ctx, receipt.result_head.revision_id)?;
    if result_revision.generation != receipt.result_head.generation {
        return Err(StoreError::Corrupt("receipt result generation disagrees with revision".into()));
    }
    Ok(Some(receipt))
}

fn insert_bootstrap_receipt(tx: &Transaction<'_>, receipt: &BootstrapReceipt) -> Result<(), StoreError> {
    tx.execute(
        "INSERT INTO bootstrap_receipts(owner_id,actor_id,workspace_id,replica_id,operation_id,request_digest,genesis_revision_id,empty_tree_id,canonical) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            receipt.owner_id.as_bytes().as_slice(), receipt.actor_id.as_bytes().as_slice(),
            receipt.workspace_id.as_bytes().as_slice(), receipt.replica_id.as_bytes().as_slice(),
            receipt.operation_id.as_bytes().as_slice(), receipt.request_digest.as_bytes().as_slice(),
            receipt.genesis_head.revision_id.as_bytes().as_slice(), receipt.empty_tree_id.as_bytes().as_slice(),
            &receipt.canonical_bytes,
        ],
    )?;
    Ok(())
}

fn load_bootstrap_receipt(conn: &Connection, ctx: HostContext, operation_id: OperationId) -> Result<Option<BootstrapReceipt>, StoreError> {
    let row = conn.query_row(
        "SELECT actor_id,request_digest,genesis_revision_id,empty_tree_id,canonical FROM bootstrap_receipts WHERE owner_id=?1 AND workspace_id=?2 AND replica_id=?3 AND operation_id=?4",
        params![ctx.owner_id.as_bytes().as_slice(), ctx.workspace_id.as_bytes().as_slice(), ctx.replica_id.as_bytes().as_slice(), operation_id.as_bytes().as_slice()],
        |r| Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, Vec<u8>>(1)?, r.get::<_, Vec<u8>>(2)?, r.get::<_, Vec<u8>>(3)?, r.get::<_, Vec<u8>>(4)?)),
    ).optional()?;
    let Some((actor, req, revision, tree, canonical)) = row else { return Ok(None); };
    let mut receipt = BootstrapReceipt {
        owner_id: ctx.owner_id,
        actor_id: ActorId(vec16(actor, "bootstrap actor")?),
        workspace_id: ctx.workspace_id,
        replica_id: ctx.replica_id,
        operation_id,
        request_digest: RequestDigest(vec32(req, "bootstrap request digest")?),
        genesis_head: Head { revision_id: RevisionId(vec32(revision, "bootstrap revision")?), generation: 0 },
        empty_tree_id: TreeId(vec32(tree, "bootstrap tree")?),
        canonical_bytes: canonical,
        receipt_digest: ReceiptDigest([0; 32]),
    };
    let digest_ctx = HostContext {
        owner_id: receipt.owner_id, actor_id: receipt.actor_id,
        workspace_id: receipt.workspace_id, replica_id: receipt.replica_id,
    };
    let computed_request_digest = init_request_digest(digest_ctx, receipt.operation_id);
    if computed_request_digest != receipt.request_digest {
        return Err(StoreError::Corrupt("bootstrap receipt request digest mismatch".into()));
    }
    let expected = bootstrap_receipt_bytes(&receipt);
    if expected != receipt.canonical_bytes {
        return Err(StoreError::Corrupt("bootstrap receipt canonical bytes mismatch".into()));
    }
    receipt.receipt_digest = ReceiptDigest(sha256(&expected));
    validate_revision_closure(conn, ctx, receipt.genesis_head.revision_id)?;
    Ok(Some(receipt))
}
