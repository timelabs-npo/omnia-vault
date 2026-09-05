use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

use super::types::*;

const TAG_FILE: &[u8] = b"OMNIA-FILE-V1\0";
const TAG_TREE: &[u8] = b"OMNIA-TREE-V1\0";
const TAG_REV: &[u8] = b"OMNIA-REV-V1\0";
const TAG_PUBLISH: &[u8] = b"OMNIA-PUBLISH-V1\0";
const TAG_INIT: &[u8] = b"OMNIA-INIT-V1\0";
const TAG_RECEIPT: &[u8] = b"OMNIA-RECEIPT-V1\0";
const TAG_INIT_RECEIPT: &[u8] = b"OMNIA-INIT-RECEIPT-V1\0";

pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    let digest = Sha256::digest(bytes);
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    out
}

fn put_u8(out: &mut Vec<u8>, value: u8) { out.push(value); }
fn put_u32(out: &mut Vec<u8>, value: u32) { out.extend_from_slice(&value.to_be_bytes()); }
fn put_u64(out: &mut Vec<u8>, value: u64) { out.extend_from_slice(&value.to_be_bytes()); }

#[derive(Debug, Clone)]
pub struct CapturedChunk {
    pub object_id: ObjectId,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct CapturedFile {
    pub total_length: u64,
    pub chunks: Vec<CapturedChunk>,
    pub canonical_manifest: Vec<u8>,
    pub file_manifest_id: FileManifestId,
}

pub fn capture_file(bytes: &[u8]) -> CapturedFile {
    let mut chunks = Vec::new();
    for part in bytes.chunks(CHUNK_SIZE) {
        chunks.push(CapturedChunk {
            object_id: ObjectId(sha256(part)),
            bytes: part.to_vec(),
        });
    }

    let mut canonical = Vec::with_capacity(32 + chunks.len() * 36);
    canonical.extend_from_slice(TAG_FILE);
    put_u64(&mut canonical, bytes.len() as u64);
    put_u32(&mut canonical, chunks.len() as u32);
    for chunk in &chunks {
        canonical.extend_from_slice(chunk.object_id.as_bytes());
        put_u32(&mut canonical, chunk.bytes.len() as u32);
    }

    CapturedFile {
        total_length: bytes.len() as u64,
        chunks,
        file_manifest_id: FileManifestId(sha256(&canonical)),
        canonical_manifest: canonical,
    }
}

pub fn tree_bytes(entries: &BTreeMap<ItemId, FileManifestId>) -> Vec<u8> {
    let mut out = Vec::with_capacity(18 + entries.len() * 48);
    out.extend_from_slice(TAG_TREE);
    put_u32(&mut out, entries.len() as u32);
    for (item_id, manifest_id) in entries {
        out.extend_from_slice(item_id.as_bytes());
        out.extend_from_slice(manifest_id.as_bytes());
    }
    out
}

pub fn tree_id(entries: &BTreeMap<ItemId, FileManifestId>) -> (TreeId, Vec<u8>) {
    let bytes = tree_bytes(entries);
    (TreeId(sha256(&bytes)), bytes)
}

pub fn revision_bytes(
    workspace_id: WorkspaceId,
    replica_id: ReplicaId,
    actor_id: ActorId,
    operation_id: OperationId,
    generation: u64,
    parent: Option<RevisionId>,
    tree_id: TreeId,
) -> Result<Vec<u8>, &'static str> {
    if generation == 0 && parent.is_some() { return Err("genesis cannot have a parent"); }
    if generation != 0 && parent.is_none() { return Err("non-genesis revision requires one parent"); }
    let mut out = Vec::with_capacity(160);
    out.extend_from_slice(TAG_REV);
    out.extend_from_slice(workspace_id.as_bytes());
    out.extend_from_slice(replica_id.as_bytes());
    out.extend_from_slice(actor_id.as_bytes());
    out.extend_from_slice(operation_id.as_bytes());
    put_u64(&mut out, generation);
    match parent {
        None => put_u8(&mut out, 0),
        Some(parent_id) => {
            put_u8(&mut out, 1);
            out.extend_from_slice(parent_id.as_bytes());
        }
    }
    out.extend_from_slice(tree_id.as_bytes());
    Ok(out)
}

pub fn revision_id(
    workspace_id: WorkspaceId,
    replica_id: ReplicaId,
    actor_id: ActorId,
    operation_id: OperationId,
    generation: u64,
    parent: Option<RevisionId>,
    tree_id: TreeId,
) -> Result<(RevisionId, Vec<u8>), &'static str> {
    let bytes = revision_bytes(workspace_id, replica_id, actor_id, operation_id, generation, parent, tree_id)?;
    Ok((RevisionId(sha256(&bytes)), bytes))
}

pub fn publish_request_digest(
    ctx: HostContext,
    operation_id: OperationId,
    expected_head: Head,
    item_id: ItemId,
    file_manifest_id: FileManifestId,
) -> RequestDigest {
    let mut out = Vec::with_capacity(192);
    out.extend_from_slice(TAG_PUBLISH);
    out.extend_from_slice(ctx.actor_id.as_bytes());
    out.extend_from_slice(ctx.workspace_id.as_bytes());
    out.extend_from_slice(ctx.replica_id.as_bytes());
    out.extend_from_slice(operation_id.as_bytes());
    out.extend_from_slice(expected_head.revision_id.as_bytes());
    put_u64(&mut out, expected_head.generation);
    out.extend_from_slice(item_id.as_bytes());
    out.extend_from_slice(file_manifest_id.as_bytes());
    RequestDigest(sha256(&out))
}

pub fn init_request_digest(ctx: HostContext, operation_id: OperationId) -> RequestDigest {
    let mut out = Vec::with_capacity(128);
    out.extend_from_slice(TAG_INIT);
    out.extend_from_slice(ctx.owner_id.as_bytes());
    out.extend_from_slice(ctx.actor_id.as_bytes());
    out.extend_from_slice(ctx.workspace_id.as_bytes());
    out.extend_from_slice(ctx.replica_id.as_bytes());
    out.extend_from_slice(operation_id.as_bytes());
    RequestDigest(sha256(&out))
}

pub fn publish_receipt_bytes(receipt: &PublishReceipt) -> Vec<u8> {
    let mut out = Vec::with_capacity(320);
    out.extend_from_slice(TAG_RECEIPT);
    put_u8(&mut out, receipt.kind as u8);
    out.extend_from_slice(receipt.owner_id.as_bytes());
    out.extend_from_slice(receipt.actor_id.as_bytes());
    out.extend_from_slice(receipt.workspace_id.as_bytes());
    out.extend_from_slice(receipt.replica_id.as_bytes());
    out.extend_from_slice(receipt.operation_id.as_bytes());
    out.extend_from_slice(receipt.request_digest.as_bytes());
    out.extend_from_slice(receipt.expected_head.revision_id.as_bytes());
    put_u64(&mut out, receipt.expected_head.generation);
    out.extend_from_slice(receipt.result_head.revision_id.as_bytes());
    put_u64(&mut out, receipt.result_head.generation);
    out.extend_from_slice(receipt.item_id.as_bytes());
    out.extend_from_slice(receipt.file_manifest_id.as_bytes());
    out
}

pub fn finalize_publish_receipt(mut receipt: PublishReceipt) -> PublishReceipt {
    let canonical = publish_receipt_bytes(&receipt);
    receipt.receipt_digest = ReceiptDigest(sha256(&canonical));
    receipt.canonical_bytes = canonical;
    receipt
}

pub fn bootstrap_receipt_bytes(receipt: &BootstrapReceipt) -> Vec<u8> {
    let mut out = Vec::with_capacity(256);
    out.extend_from_slice(TAG_INIT_RECEIPT);
    out.extend_from_slice(receipt.owner_id.as_bytes());
    out.extend_from_slice(receipt.actor_id.as_bytes());
    out.extend_from_slice(receipt.workspace_id.as_bytes());
    out.extend_from_slice(receipt.replica_id.as_bytes());
    out.extend_from_slice(receipt.operation_id.as_bytes());
    out.extend_from_slice(receipt.request_digest.as_bytes());
    out.extend_from_slice(receipt.genesis_head.revision_id.as_bytes());
    put_u64(&mut out, receipt.genesis_head.generation);
    out.extend_from_slice(receipt.empty_tree_id.as_bytes());
    out
}

pub fn finalize_bootstrap_receipt(mut receipt: BootstrapReceipt) -> BootstrapReceipt {
    let canonical = bootstrap_receipt_bytes(&receipt);
    receipt.receipt_digest = ReceiptDigest(sha256(&canonical));
    receipt.canonical_bytes = canonical;
    receipt
}
