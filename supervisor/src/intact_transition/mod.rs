mod encoding;
mod store;
mod types;

pub use encoding::{
    bootstrap_receipt_bytes, capture_file,
    finalize_bootstrap_receipt, finalize_publish_receipt, init_request_digest,
    publish_receipt_bytes, publish_request_digest, revision_bytes, revision_id, sha256,
    tree_bytes, tree_id, CapturedChunk, CapturedFile,
};
pub use store::{StateStore, StoreError};
pub use types::*;

/// Public convenience: calculate the v1 FileManifestId for an owned byte buffer.
pub fn manifest_id_for_bytes(bytes: &[u8]) -> FileManifestId {
    capture_file(bytes).file_manifest_id
}
