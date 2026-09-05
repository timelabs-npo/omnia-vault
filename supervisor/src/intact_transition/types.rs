use std::fmt;

pub const CONTRACT_VERSION: &str = "OMNIA-LIT-001/v1.1";
pub const SCHEMA_VERSION: u8 = 1;
pub const CHUNK_SIZE: usize = 4_194_304;
pub const MAX_INPUT_BYTES: usize = 32 * 1024 * 1024;
pub const MAX_ITEMS_PER_ROOT: usize = 1_024;
pub const MAX_UNIQUE_CHUNK_BYTES: u64 = 256 * 1024 * 1024;
pub const MAX_TERMINAL_RECEIPTS: u64 = 4_096;
pub const MAX_GENERATION: u64 = i64::MAX as u64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HexError {
    WrongLength { expected: usize, actual: usize },
    InvalidDigit { index: usize, byte: u8 },
}

impl fmt::Display for HexError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::WrongLength { expected, actual } => {
                write!(f, "wrong hex length: expected {expected}, got {actual}")
            }
            Self::InvalidDigit { index, byte } => {
                write!(f, "invalid hex digit at index {index}: 0x{byte:02x}")
            }
        }
    }
}

impl std::error::Error for HexError {}

fn hex_nibble(b: u8, index: usize) -> Result<u8, HexError> {
    match b {
        b'0'..=b'9' => Ok(b - b'0'),
        b'a'..=b'f' => Ok(b - b'a' + 10),
        _ => Err(HexError::InvalidDigit { index, byte: b }),
    }
}

pub fn decode_hex<const N: usize>(s: &str) -> Result<[u8; N], HexError> {
    let bytes = s.as_bytes();
    if bytes.len() != N * 2 {
        return Err(HexError::WrongLength {
            expected: N * 2,
            actual: bytes.len(),
        });
    }
    let mut out = [0u8; N];
    for i in 0..N {
        let hi = hex_nibble(bytes[i * 2], i * 2)?;
        let lo = hex_nibble(bytes[i * 2 + 1], i * 2 + 1)?;
        out[i] = (hi << 4) | lo;
    }
    Ok(out)
}

pub fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

macro_rules! id16_type {
    ($name:ident) => {
        #[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub struct $name(pub [u8; 16]);

        impl $name {
            pub const fn from_bytes(bytes: [u8; 16]) -> Self { Self(bytes) }
            pub const fn as_bytes(&self) -> &[u8; 16] { &self.0 }
            pub fn from_hex(s: &str) -> Result<Self, HexError> { Ok(Self(decode_hex::<16>(s)?)) }
            pub fn to_hex(&self) -> String { encode_hex(&self.0) }
        }

        impl fmt::Debug for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}({})", stringify!($name), self.to_hex())
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(&self.to_hex()) }
        }
    };
}

macro_rules! digest32_type {
    ($name:ident) => {
        #[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub struct $name(pub [u8; 32]);

        impl $name {
            pub const fn from_bytes(bytes: [u8; 32]) -> Self { Self(bytes) }
            pub const fn as_bytes(&self) -> &[u8; 32] { &self.0 }
            pub fn from_hex(s: &str) -> Result<Self, HexError> { Ok(Self(decode_hex::<32>(s)?)) }
            pub fn to_hex(&self) -> String { encode_hex(&self.0) }
        }

        impl fmt::Debug for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}({})", stringify!($name), self.to_hex())
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(&self.to_hex()) }
        }
    };
}

id16_type!(OwnerId);
id16_type!(ActorId);
id16_type!(WorkspaceId);
id16_type!(ReplicaId);
id16_type!(OperationId);
id16_type!(ItemId);

digest32_type!(ObjectId);
digest32_type!(FileManifestId);
digest32_type!(TreeId);
digest32_type!(RevisionId);
digest32_type!(RequestDigest);
digest32_type!(ReceiptDigest);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Head {
    pub revision_id: RevisionId,
    pub generation: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HostContext {
    pub owner_id: OwnerId,
    pub actor_id: ActorId,
    pub workspace_id: WorkspaceId,
    pub replica_id: ReplicaId,
}

#[derive(Debug, Clone)]
pub struct InitWorkspaceV1 {
    pub schema_version: u8,
    pub operation_id: OperationId,
}

#[derive(Debug, Clone)]
pub struct PublishItemBytesV1 {
    pub schema_version: u8,
    pub operation_id: OperationId,
    pub item_id: ItemId,
    pub expected_head: Head,
    pub claimed_file_manifest_id: FileManifestId,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PublishReceiptKind {
    LocalCommitted = 1,
    Conflict = 2,
}

impl PublishReceiptKind {
    pub fn from_i64(v: i64) -> Option<Self> {
        match v {
            1 => Some(Self::LocalCommitted),
            2 => Some(Self::Conflict),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublishReceipt {
    pub kind: PublishReceiptKind,
    pub owner_id: OwnerId,
    pub actor_id: ActorId,
    pub workspace_id: WorkspaceId,
    pub replica_id: ReplicaId,
    pub operation_id: OperationId,
    pub request_digest: RequestDigest,
    pub expected_head: Head,
    pub result_head: Head,
    pub item_id: ItemId,
    pub file_manifest_id: FileManifestId,
    pub canonical_bytes: Vec<u8>,
    pub receipt_digest: ReceiptDigest,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BootstrapReceipt {
    pub owner_id: OwnerId,
    pub actor_id: ActorId,
    pub workspace_id: WorkspaceId,
    pub replica_id: ReplicaId,
    pub operation_id: OperationId,
    pub request_digest: RequestDigest,
    pub genesis_head: Head,
    pub empty_tree_id: TreeId,
    pub canonical_bytes: Vec<u8>,
    pub receipt_digest: ReceiptDigest,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OperationReceipt {
    Bootstrap(BootstrapReceipt),
    Publish(PublishReceipt),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OperationObservation {
    NotRecorded,
    Recorded(OperationReceipt),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EngineInfo {
    pub sqlite_version: String,
    pub sqlite_source_id: String,
    pub vfs_name: Option<String>,
    pub compile_options: Vec<String>,
    pub journal_mode: String,
    pub synchronous: i64,
    pub foreign_keys: i64,
    pub fullfsync: Option<i64>,
    pub busy_timeout_ms: u64,
}
