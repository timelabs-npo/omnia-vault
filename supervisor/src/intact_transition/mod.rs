mod encoding;
mod store;
mod types;
mod wire;

pub use encoding::{
    bootstrap_receipt_bytes, capture_file,
    finalize_bootstrap_receipt, finalize_publish_receipt, init_request_digest,
    publish_receipt_bytes, publish_request_digest, revision_bytes, revision_id, sha256,
    tree_bytes, tree_id, CapturedChunk, CapturedFile,
};
pub use store::{StateStore, StoreError};
pub use types::*;
pub use wire::{
    DiagnosticPayload, Frame, FrameHeader, RequestEnvelope, ResponseEnvelope, WireError,
    WireTransport, MAGIC, HEADER_SIZE, KIND_REQUEST, KIND_RESPONSE, KIND_DIAGNOSTIC,
    MAX_METADATA_BYTES, MAX_PAYLOAD_BYTES, READ_TIMEOUT_MS,
    DIAG_FRAME_TIMEOUT, DIAG_MAGIC_MISMATCH, DIAG_INVALID_KIND,
    DIAG_METADATA_OVERSIZE, DIAG_PAYLOAD_OVERSIZE, DIAG_TRUNCATED_HEADER,
    DIAG_TRUNCATED_BODY, DIAG_JSON_SYNTAX, DIAG_JSON_SCHEMA,
    DIAG_UNKNOWN_METHOD, DIAG_INTERNAL,
    read_frame, parse_request, encode_response, encode_error_response,
    wire_error_to_diagnostic,
};

/// Public convenience: calculate the v1 FileManifestId for an owned byte buffer.
pub fn manifest_id_for_bytes(bytes: &[u8]) -> FileManifestId {
    capture_file(bytes).file_manifest_id
}
