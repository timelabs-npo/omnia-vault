use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::io::{self, Write};
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};
use supervisor::intact_transition::*;

fn die(message: impl Into<String>) -> ! {
    let message = message.into();
    eprintln!("{}", json!({"ok": false, "error": message}));
    process::exit(2);
}


fn after_response_failpoint() {
    if std::env::var("OMNIA_LIT_FAILPOINT").ok().as_deref() != Some("after_response_observed") {
        return;
    }
    if let Ok(path) = std::env::var("OMNIA_LIT_FAILPOINT_MARKER") {
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(path) {
            let _ = writeln!(f, "after_response_observed");
            let _ = f.sync_all();
        }
    }
    loop { thread::sleep(Duration::from_secs(3600)); }
}

fn parse_flags(args: &[String]) -> BTreeMap<String, String> {
    if args.len() % 2 != 0 { die("flags must be --name value pairs"); }
    let mut out = BTreeMap::new();
    let mut i = 0;
    while i < args.len() {
        let key = &args[i];
        if !key.starts_with("--") { die(format!("expected flag, got {key}")); }
        if out.insert(key[2..].to_string(), args[i + 1].clone()).is_some() {
            die(format!("duplicate flag {key}"));
        }
        i += 2;
    }
    out
}


fn ensure_only(m: &BTreeMap<String, String>, allowed: &[&str]) {
    for key in m.keys() {
        if !allowed.iter().any(|allowed_key| key == allowed_key) {
            die(format!("unexpected --{key}"));
        }
    }
}

fn required<'a>(m: &'a BTreeMap<String, String>, key: &str) -> &'a str {
    m.get(key).map(String::as_str).unwrap_or_else(|| die(format!("missing --{key}")))
}

fn db_path(m: &BTreeMap<String, String>) -> PathBuf { PathBuf::from(required(m, "db")) }

fn owner(m: &BTreeMap<String, String>) -> OwnerId { OwnerId::from_hex(required(m, "owner")).unwrap_or_else(|e| die(e.to_string())) }
fn actor(m: &BTreeMap<String, String>) -> ActorId { ActorId::from_hex(required(m, "actor")).unwrap_or_else(|e| die(e.to_string())) }
fn workspace(m: &BTreeMap<String, String>) -> WorkspaceId { WorkspaceId::from_hex(required(m, "workspace")).unwrap_or_else(|e| die(e.to_string())) }
fn replica(m: &BTreeMap<String, String>) -> ReplicaId { ReplicaId::from_hex(required(m, "replica")).unwrap_or_else(|e| die(e.to_string())) }
fn operation(m: &BTreeMap<String, String>) -> OperationId { OperationId::from_hex(required(m, "operation")).unwrap_or_else(|e| die(e.to_string())) }
fn item(m: &BTreeMap<String, String>) -> ItemId { ItemId::from_hex(required(m, "item")).unwrap_or_else(|e| die(e.to_string())) }
fn revision(m: &BTreeMap<String, String>, key: &str) -> RevisionId { RevisionId::from_hex(required(m, key)).unwrap_or_else(|e| die(e.to_string())) }
fn manifest(m: &BTreeMap<String, String>) -> FileManifestId { FileManifestId::from_hex(required(m, "manifest")).unwrap_or_else(|e| die(e.to_string())) }
fn generation(m: &BTreeMap<String, String>, key: &str) -> u64 {
    let raw = required(m, key);
    if raw.is_empty() || (raw.len() > 1 && raw.starts_with('0')) || !raw.bytes().all(|b| b.is_ascii_digit()) {
        die(format!("--{key} must be canonical unsigned decimal"));
    }
    raw.parse::<u64>().unwrap_or_else(|_| die(format!("invalid --{key}")))
}

fn context(m: &BTreeMap<String, String>) -> HostContext {
    HostContext { owner_id: owner(m), actor_id: actor(m), workspace_id: workspace(m), replica_id: replica(m) }
}

fn open_store(m: &BTreeMap<String, String>) -> StateStore {
    StateStore::open(db_path(m), context(m)).unwrap_or_else(|e| die(e.to_string()))
}

fn head_json(h: Head) -> Value {
    json!({"revision_id": {"type":"RevisionId","algorithm":"sha256","version":1,"hex":h.revision_id.to_hex()}, "generation":h.generation.to_string()})
}

fn publish_receipt_json(r: &PublishReceipt) -> Value {
    json!({
        "kind": match r.kind { PublishReceiptKind::LocalCommitted => "LOCAL_COMMITTED", PublishReceiptKind::Conflict => "CONFLICT" },
        "operation_id": r.operation_id.to_hex(),
        "request_digest": r.request_digest.to_hex(),
        "owner_id": r.owner_id.to_hex(),
        "actor_id": r.actor_id.to_hex(),
        "workspace_id": r.workspace_id.to_hex(),
        "replica_id": r.replica_id.to_hex(),
        "expected_head": head_json(r.expected_head),
        "result_head": head_json(r.result_head),
        "item_id": r.item_id.to_hex(),
        "file_manifest_id": {"type":"FileManifestId","algorithm":"sha256","version":1,"hex":r.file_manifest_id.to_hex()},
        "canonical_hex": encode_hex(&r.canonical_bytes),
        "receipt_digest": r.receipt_digest.to_hex(),
    })
}

fn bootstrap_receipt_json(r: &BootstrapReceipt) -> Value {
    json!({
        "kind":"BOOTSTRAP_COMMITTED",
        "operation_id":r.operation_id.to_hex(),
        "request_digest":r.request_digest.to_hex(),
        "owner_id":r.owner_id.to_hex(),
        "actor_id":r.actor_id.to_hex(),
        "workspace_id":r.workspace_id.to_hex(),
        "replica_id":r.replica_id.to_hex(),
        "genesis_head":head_json(r.genesis_head),
        "empty_tree_id":{"type":"TreeId","algorithm":"sha256","version":1,"hex":r.empty_tree_id.to_hex()},
        "canonical_hex":encode_hex(&r.canonical_bytes),
        "receipt_digest":r.receipt_digest.to_hex(),
    })
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 { die("command required: manifest-id|init|publish|head|get-operation|read-item|engine-info|integrity|is-descendant"); }
    let cmd = args[1].as_str();
    let flags = parse_flags(&args[2..]);

    let result = match cmd {
        "manifest-id" => {
            ensure_only(&flags, &["input"]);
            let data = fs::read(required(&flags, "input")).unwrap_or_else(|e| die(e.to_string()));
            let captured = capture_file(&data);
            json!({"ok":true,"length":data.len(),"file_manifest_id":{"type":"FileManifestId","algorithm":"sha256","version":1,"hex":captured.file_manifest_id.to_hex()}})
        }
        "init" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica","operation"]);
            let mut store = open_store(&flags);
            let receipt = store.init_workspace(InitWorkspaceV1 { schema_version: SCHEMA_VERSION, operation_id: operation(&flags) })
                .unwrap_or_else(|e| die(e.to_string()));
            json!({"ok":true,"receipt":bootstrap_receipt_json(&receipt)})
        }
        "publish" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica","operation","item","expected-revision","expected-generation","manifest","input"]);
            let data = fs::read(required(&flags, "input")).unwrap_or_else(|e| die(e.to_string()));
            let mut store = open_store(&flags);
            let req = PublishItemBytesV1 {
                schema_version: SCHEMA_VERSION,
                operation_id: operation(&flags),
                item_id: item(&flags),
                expected_head: Head { revision_id: revision(&flags, "expected-revision"), generation: generation(&flags, "expected-generation") },
                claimed_file_manifest_id: manifest(&flags),
                bytes: data,
            };
            let receipt = store.publish_item_bytes(req).unwrap_or_else(|e| die(e.to_string()));
            json!({"ok":true,"receipt":publish_receipt_json(&receipt)})
        }
        "head" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica"]);
            let store = open_store(&flags);
            let head = store.get_head().unwrap_or_else(|e| die(e.to_string()));
            json!({"ok":true,"head":head_json(head)})
        }
        "get-operation" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica","operation"]);
            let store = open_store(&flags);
            let observed = store.get_operation(operation(&flags)).unwrap_or_else(|e| die(e.to_string()));
            match observed {
                OperationObservation::NotRecorded => json!({"ok":true,"observation":"NOT_RECORDED"}),
                OperationObservation::Recorded(OperationReceipt::Bootstrap(r)) => json!({"ok":true,"observation":"RECORDED","receipt":bootstrap_receipt_json(&r)}),
                OperationObservation::Recorded(OperationReceipt::Publish(r)) => json!({"ok":true,"observation":"RECORDED","receipt":publish_receipt_json(&r)}),
            }
        }
        "read-item" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica","revision","item","out"]);
            let store = open_store(&flags);
            let bytes = store.read_item(revision(&flags, "revision"), item(&flags)).unwrap_or_else(|e| die(e.to_string()));
            let output = PathBuf::from(required(&flags, "out"));
            fs::write(&output, &bytes).unwrap_or_else(|e| die(e.to_string()));
            json!({"ok":true,"length":bytes.len(),"content_sha256":encode_hex(&sha256(&bytes)),"output":output})
        }
        "engine-info" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica"]);
            let store = open_store(&flags);
            let info = store.engine_info().unwrap_or_else(|e| die(e.to_string()));
            json!({"ok":true,"contract_version":CONTRACT_VERSION,"sqlite_version":info.sqlite_version,"sqlite_source_id":info.sqlite_source_id,"vfs_name":info.vfs_name,"compile_options":info.compile_options,"journal_mode":info.journal_mode,"synchronous":info.synchronous,"foreign_keys":info.foreign_keys,"fullfsync":info.fullfsync,"busy_timeout_ms":info.busy_timeout_ms})
        }
        "integrity" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica"]);
            let store = open_store(&flags);
            store.integrity_check().unwrap_or_else(|e| die(e.to_string()));
            json!({"ok":true,"integrity":"OK"})
        }
        "is-descendant" => {
            ensure_only(&flags, &["db","owner","actor","workspace","replica","descendant","ancestor"]);
            let store = open_store(&flags);
            let desc = revision(&flags, "descendant");
            let anc = revision(&flags, "ancestor");
            let value = store.is_descendant(desc, anc).unwrap_or_else(|e| die(e.to_string()));
            json!({"ok":true,"is_descendant":value})
        }
        _ => die(format!("unknown command {cmd}")),
    };

    println!("{result}");
    let _ = io::stdout().flush();
    after_response_failpoint();
}
