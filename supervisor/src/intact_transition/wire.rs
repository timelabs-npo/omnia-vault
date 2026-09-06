use std::io::{self, Read, Write};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json;

pub const MAGIC: [u8; 4] = *b"LIT1";
pub const HEADER_SIZE: usize = 13;
pub const MAX_METADATA_BYTES: u32 = 16_384;
pub const MAX_PAYLOAD_BYTES: u32 = 33_554_432;

pub const KIND_REQUEST: u8 = 1;
pub const KIND_RESPONSE: u8 = 2;
pub const KIND_DIAGNOSTIC: u8 = 3;

pub const DIAG_FRAME_TIMEOUT: &str = "FRAME_TIMEOUT";
pub const DIAG_MAGIC_MISMATCH: &str = "MAGIC_MISMATCH";
pub const DIAG_INVALID_KIND: &str = "INVALID_KIND";
pub const DIAG_METADATA_OVERSIZE: &str = "METADATA_OVERSIZE";
pub const DIAG_PAYLOAD_OVERSIZE: &str = "PAYLOAD_OVERSIZE";
pub const DIAG_TRUNCATED_HEADER: &str = "TRUNCATED_HEADER";
pub const DIAG_TRUNCATED_BODY: &str = "TRUNCATED_BODY";
pub const DIAG_JSON_SYNTAX: &str = "JSON_SYNTAX";
pub const DIAG_JSON_SCHEMA: &str = "JSON_SCHEMA";
pub const DIAG_UNKNOWN_METHOD: &str = "UNKNOWN_METHOD";
pub const DIAG_INTERNAL: &str = "INTERNAL";

pub const READ_TIMEOUT_MS: u64 = 30_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrameHeader {
    pub magic: [u8; 4],
    pub kind: u8,
    pub metadata_length: u32,
    pub payload_length: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub header: FrameHeader,
    pub metadata: Vec<u8>,
    pub payload: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiagnosticPayload {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestEnvelope {
    pub method: String,
    pub id: Option<String>,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseEnvelope {
    pub ok: bool,
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<DiagnosticPayload>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WireError {
    Internal,
    FrameTimeout,
    MagicMismatch,
    InvalidKind(u8),
    MetadataOversize(u32),
    PayloadOversize(u32),
    TruncatedHeader { expected: usize, got: usize },
    TruncatedBody { section: &'static str, expected: u32, got: usize },
    JsonSyntax(String),
    JsonSchema(String),
    Io(std::io::ErrorKind),
}

impl FrameHeader {
    pub fn to_bytes(&self) -> [u8; HEADER_SIZE] {
        let mut out = [0u8; HEADER_SIZE];
        out[0..4].copy_from_slice(&self.magic);
        out[4] = self.kind;
        out[5..9].copy_from_slice(&self.metadata_length.to_be_bytes());
        out[9..13].copy_from_slice(&self.payload_length.to_be_bytes());
        out
    }

    pub fn from_bytes(bytes: &[u8; HEADER_SIZE]) -> Result<Self, WireError> {
        let mut magic = [0u8; 4];
        magic.copy_from_slice(&bytes[0..4]);
        let kind = bytes[4];
        let mut ml = [0u8; 4];
        ml.copy_from_slice(&bytes[5..9]);
        let metadata_length = u32::from_be_bytes(ml);
        let mut pl = [0u8; 4];
        pl.copy_from_slice(&bytes[9..13]);
        let payload_length = u32::from_be_bytes(pl);

        if magic != MAGIC {
            return Err(WireError::MagicMismatch);
        }
        match kind {
            KIND_REQUEST | KIND_RESPONSE | KIND_DIAGNOSTIC => {}
            _ => return Err(WireError::InvalidKind(kind)),
        }
        if metadata_length > MAX_METADATA_BYTES {
            return Err(WireError::MetadataOversize(metadata_length));
        }
        if payload_length > MAX_PAYLOAD_BYTES {
            return Err(WireError::PayloadOversize(payload_length));
        }
        Ok(Self { magic, kind, metadata_length, payload_length })
    }
}

impl Frame {
    pub fn new(kind: u8, metadata: Vec<u8>, payload: Vec<u8>) -> Result<Self, WireError> {
        let metadata_length = metadata.len() as u32;
        let payload_length = payload.len() as u32;
        match kind {
            KIND_REQUEST | KIND_RESPONSE | KIND_DIAGNOSTIC => {}
            _ => return Err(WireError::InvalidKind(kind)),
        }
        if metadata_length > MAX_METADATA_BYTES {
            return Err(WireError::MetadataOversize(metadata_length));
        }
        if payload_length > MAX_PAYLOAD_BYTES {
            return Err(WireError::PayloadOversize(payload_length));
        }
        Ok(Self {
            header: FrameHeader {
                magic: MAGIC,
                kind,
                metadata_length,
                payload_length,
            },
            metadata,
            payload,
        })
    }

    pub fn request(metadata: Vec<u8>, payload: Vec<u8>) -> Result<Self, WireError> {
        Self::new(KIND_REQUEST, metadata, payload)
    }

    pub fn response(metadata: Vec<u8>, payload: Vec<u8>) -> Result<Self, WireError> {
        Self::new(KIND_RESPONSE, metadata, payload)
    }

    pub fn diagnostic(code: &str, detail: Option<&str>) -> Result<Self, WireError> {
        let diag = DiagnosticPayload {
            code: code.to_string(),
            detail: detail.map(|s| s.to_string()),
        };
        let payload = serde_json::to_vec(&diag).map_err(|_| WireError::Internal)?;
        Self::new(KIND_DIAGNOSTIC, Vec::new(), payload)
    }

    pub fn write_to<W: Write>(&self, w: &mut W) -> io::Result<()> {
        w.write_all(&self.header.to_bytes())?;
        if self.header.metadata_length > 0 {
            w.write_all(&self.metadata)?;
        }
        if self.header.payload_length > 0 {
            w.write_all(&self.payload)?;
        }
        w.flush()
    }
}

fn read_exact_with_timeout<R: Read>(
    r: &mut R,
    buf: &mut [u8],
    deadline: Option<Instant>,
) -> Result<(), WireError> {
    let mut total = 0;
    while total < buf.len() {
        if let Some(d) = deadline {
            if Instant::now() > d {
                return Err(WireError::FrameTimeout);
            }
        }
        match r.read(&mut buf[total..]) {
            Ok(0) => {
                return if total == 0 {
                    Err(WireError::FrameTimeout)
                } else {
                    Err(WireError::TruncatedBody {
                        section: "stream",
                        expected: buf.len() as u32,
                        got: total,
                    })
                };
            }
            Ok(n) => total += n,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(1));
                continue;
            }
            Err(e) => return Err(WireError::Io(e.kind())),
        }
    }
    Ok(())
}

pub fn read_frame<R: Read>(r: &mut R, timeout_ms: u64) -> Result<Frame, WireError> {
    let deadline = if timeout_ms > 0 {
        Some(Instant::now() + Duration::from_millis(timeout_ms))
    } else {
        None
    };

    let mut header_bytes = [0u8; HEADER_SIZE];
    if let Err(e) = read_exact_with_timeout(r, &mut header_bytes, deadline) {
        return match e {
            WireError::TruncatedBody { expected, got, .. } => {
                Err(WireError::TruncatedHeader {
                    expected: expected as usize,
                    got,
                })
            }
            other => Err(other),
        };
    }

    let header = FrameHeader::from_bytes(&header_bytes)?;

    let mut metadata = vec![0u8; header.metadata_length as usize];
    if header.metadata_length > 0 {
        read_exact_with_timeout(r, &mut metadata, deadline).map_err(|e| match e {
            WireError::TruncatedBody { expected, got, .. } => WireError::TruncatedBody {
                section: "metadata",
                expected,
                got,
            },
            other => other,
        })?;
    }

    let mut payload = vec![0u8; header.payload_length as usize];
    if header.payload_length > 0 {
        read_exact_with_timeout(r, &mut payload, deadline).map_err(|e| match e {
            WireError::TruncatedBody { expected, got, .. } => WireError::TruncatedBody {
                section: "payload",
                expected,
                got,
            },
            other => other,
        })?;
    }

    Ok(Frame { header, metadata, payload })
}

pub fn parse_request(frame: &Frame) -> Result<RequestEnvelope, WireError> {
    if frame.header.kind != KIND_REQUEST {
        return Err(WireError::InvalidKind(frame.header.kind));
    }
    let json_bytes = if frame.metadata.is_empty() {
        &frame.payload
    } else {
        &frame.metadata
    };
    serde_json::from_slice::<RequestEnvelope>(json_bytes).map_err(|e| {
        WireError::JsonSyntax(e.to_string())
    })
}

pub fn encode_response(id: Option<&str>, result: Option<serde_json::Value>) -> Result<Frame, WireError> {
    let envelope = ResponseEnvelope {
        ok: true,
        id: id.map(|s| s.to_string()),
        result,
        error: None,
    };
    let payload = serde_json::to_vec(&envelope).map_err(|_| WireError::Internal)?;
    Frame::response(Vec::new(), payload)
}

pub fn encode_error_response(id: Option<&str>, code: &str, detail: Option<&str>) -> Result<Frame, WireError> {
    let envelope = ResponseEnvelope {
        ok: false,
        id: id.map(|s| s.to_string()),
        result: None,
        error: Some(DiagnosticPayload {
            code: code.to_string(),
            detail: detail.map(|s| s.to_string()),
        }),
    };
    let payload = serde_json::to_vec(&envelope).map_err(|_| WireError::Internal)?;
    Frame::response(Vec::new(), payload)
}

pub fn wire_error_to_diagnostic(e: &WireError) -> (&'static str, Option<String>) {
    match e {
        WireError::Internal => (DIAG_INTERNAL, None),
        WireError::FrameTimeout => (DIAG_FRAME_TIMEOUT, None),
        WireError::MagicMismatch => (DIAG_MAGIC_MISMATCH, None),
        WireError::InvalidKind(k) => (DIAG_INVALID_KIND, Some(format!("kind={k}"))),
        WireError::MetadataOversize(n) => (DIAG_METADATA_OVERSIZE, Some(format!("got={n}, max={MAX_METADATA_BYTES}"))),
        WireError::PayloadOversize(n) => (DIAG_PAYLOAD_OVERSIZE, Some(format!("got={n}, max={MAX_PAYLOAD_BYTES}"))),
        WireError::TruncatedHeader { expected, got } => (DIAG_TRUNCATED_HEADER, Some(format!("expected={expected}, got={got}"))),
        WireError::TruncatedBody { section, expected, got } => (DIAG_TRUNCATED_BODY, Some(format!("section={section}, expected={expected}, got={got}"))),
        WireError::JsonSyntax(s) => (DIAG_JSON_SYNTAX, Some(s.clone())),
        WireError::JsonSchema(s) => (DIAG_JSON_SCHEMA, Some(s.clone())),
        WireError::Io(k) => (DIAG_INTERNAL, Some(format!("io={k:?}"))),
    }
}

pub struct WireTransport<R, W> {
    pub reader: R,
    pub writer: W,
}

impl<R: Read, W: Write> WireTransport<R, W> {
    pub fn new(reader: R, writer: W) -> Self {
        Self { reader, writer }
    }

    pub fn read_next(&mut self) -> Result<Frame, WireError> {
        read_frame(&mut self.reader, READ_TIMEOUT_MS)
    }

    pub fn send_frame(&mut self, frame: &Frame) -> io::Result<()> {
        frame.write_to(&mut self.writer)
    }

    pub fn send_diagnostic(&mut self, code: &str, detail: Option<&str>) -> io::Result<()> {
        let frame = Frame::diagnostic(code, detail).map_err(|_| io::Error::other("encode diagnostic"))?;
        self.send_frame(&frame)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_roundtrip_exact_13_bytes() {
        let h = FrameHeader {
            magic: MAGIC,
            kind: KIND_REQUEST,
            metadata_length: 42,
            payload_length: 1024,
        };
        let bytes = h.to_bytes();
        assert_eq!(bytes.len(), 13);
        assert_eq!(&bytes[0..4], b"LIT1");
        assert_eq!(bytes[4], KIND_REQUEST);
        assert_eq!(u32::from_be_bytes(bytes[5..9].try_into().unwrap()), 42u32);
        assert_eq!(u32::from_be_bytes(bytes[9..13].try_into().unwrap()), 1024u32);
        let h2 = FrameHeader::from_bytes(&bytes).unwrap();
        assert_eq!(h, h2);
    }

    #[test]
    fn reject_bad_magic() {
        let mut hdr = FrameHeader {
            magic: MAGIC,
            kind: KIND_REQUEST,
            metadata_length: 0,
            payload_length: 0,
        }.to_bytes();
        hdr[0] = b'X';
        let result = FrameHeader::from_bytes(&hdr);
        assert!(matches!(result, Err(WireError::MagicMismatch)));
    }

    #[test]
    fn reject_invalid_kind() {
        let hdr = FrameHeader {
            magic: MAGIC,
            kind: 99,
            metadata_length: 0,
            payload_length: 0,
        }.to_bytes();
        let result = FrameHeader::from_bytes(&hdr);
        assert!(matches!(result, Err(WireError::InvalidKind(99))));
    }

    #[test]
    fn reject_metadata_oversize() {
        let hdr = FrameHeader::from_bytes(&{
            let mut b = [0u8; 13];
            b[0..4].copy_from_slice(&MAGIC);
            b[4] = KIND_REQUEST;
            b[5..9].copy_from_slice(&(MAX_METADATA_BYTES + 1).to_be_bytes());
            b
        });
        assert!(matches!(hdr, Err(WireError::MetadataOversize(x)) if x == MAX_METADATA_BYTES + 1));
    }

    #[test]
    fn reject_payload_oversize() {
        let hdr = FrameHeader::from_bytes(&{
            let mut b = [0u8; 13];
            b[0..4].copy_from_slice(&MAGIC);
            b[4] = KIND_RESPONSE;
            b[9..13].copy_from_slice(&(MAX_PAYLOAD_BYTES + 1).to_be_bytes());
            b
        });
        assert!(matches!(hdr, Err(WireError::PayloadOversize(x)) if x == MAX_PAYLOAD_BYTES + 1));
    }

    #[test]
    fn frame_write_and_read_roundtrip() {
        let meta = b"meta_here".to_vec();
        let pay = b"{\"method\":\"ping\",\"id\":\"1\",\"params\":{}}".to_vec();
        let f = Frame::request(meta.clone(), pay.clone()).unwrap();
        assert_eq!(f.header.metadata_length, meta.len() as u32);
        assert_eq!(f.header.payload_length, pay.len() as u32);

        let mut buf = Vec::new();
        f.write_to(&mut buf).unwrap();
        let expected_size = 13 + meta.len() + pay.len();
        assert_eq!(buf.len(), expected_size);

        let mut cursor = io::Cursor::new(&buf);
        let f2 = read_frame(&mut cursor, 0).unwrap();
        assert_eq!(f, f2);
    }

    #[test]
    fn fail_truncated_header() {
        let mut partial = Vec::with_capacity(13);
        partial.extend_from_slice(&MAGIC);
        partial.push(KIND_REQUEST);
        let mut cursor = io::Cursor::new(&partial);
        let err = read_frame(&mut cursor, 0).unwrap_err();
        assert!(matches!(err, WireError::TruncatedHeader { expected: 13, got: 5 }));
    }

    #[test]
    fn fail_truncated_payload() {
        let meta = b"abc".to_vec();
        let pay = b"full_pay_load".to_vec();
        let f = Frame::request(meta, pay).unwrap();
        let mut buf = Vec::new();
        f.write_to(&mut buf).unwrap();
        let trunc = &buf[..buf.len() - 3];
        let mut cursor = io::Cursor::new(trunc);
        let err = read_frame(&mut cursor, 0).unwrap_err();
        assert!(matches!(err, WireError::TruncatedBody { section: "payload", .. }));
    }

    #[test]
    fn fail_truncated_metadata() {
        let meta = vec![0u8; 100];
        let pay = vec![0u8; 0];
        let f = Frame::request(meta, pay).unwrap();
        let mut buf = Vec::new();
        f.write_to(&mut buf).unwrap();
        let trunc = &buf[..13 + 50];
        let mut cursor = io::Cursor::new(trunc);
        let err = read_frame(&mut cursor, 0).unwrap_err();
        assert!(matches!(err, WireError::TruncatedBody { section: "metadata", expected: 100, got: 50 }));
    }

    #[test]
    fn diagnostic_frame_encoding() {
        let d = Frame::diagnostic(DIAG_MAGIC_MISMATCH, None).unwrap();
        assert_eq!(d.header.kind, KIND_DIAGNOSTIC);
        let parsed: DiagnosticPayload = serde_json::from_slice(&d.payload).unwrap();
        assert_eq!(parsed.code, DIAG_MAGIC_MISMATCH);
        assert!(parsed.detail.is_none());
    }

    #[test]
    fn diagnostic_frame_with_detail() {
        let d = Frame::diagnostic(DIAG_JSON_SYNTAX, Some("expected `:` at line 2")).unwrap();
        let parsed: DiagnosticPayload = serde_json::from_slice(&d.payload).unwrap();
        assert_eq!(parsed.code, DIAG_JSON_SYNTAX);
        assert_eq!(parsed.detail.as_deref(), Some("expected `:` at line 2"));
    }

    #[test]
    fn parse_request_envelope() {
        let req = RequestEnvelope {
            method: "head".to_string(),
            id: Some("req-7".to_string()),
            params: serde_json::json!({"db":"/tmp/x"}),
        };
        let bytes = serde_json::to_vec(&req).unwrap();
        let frame = Frame::request(Vec::new(), bytes).unwrap();
        let parsed = parse_request(&frame).unwrap();
        assert_eq!(parsed.method, "head");
        assert_eq!(parsed.id.as_deref(), Some("req-7"));
        assert_eq!(parsed.params["db"], "/tmp/x");
    }

    #[test]
    fn parse_request_rejects_garbage_json() {
        let frame = Frame::request(Vec::new(), b"not json {{{{".to_vec()).unwrap();
        let err = parse_request(&frame).unwrap_err();
        assert!(matches!(err, WireError::JsonSyntax(_)));
    }

    #[test]
    fn encode_response_ok_roundtrip() {
        let f = encode_response(Some("r1"), Some(serde_json::json!({"status":"ok"}))).unwrap();
        assert_eq!(f.header.kind, KIND_RESPONSE);
        let env: ResponseEnvelope = serde_json::from_slice(&f.payload).unwrap();
        assert!(env.ok);
        assert_eq!(env.id.as_deref(), Some("r1"));
        assert_eq!(env.result.unwrap()["status"], "ok");
        assert!(env.error.is_none());
    }

    #[test]
    fn encode_error_response_roundtrip() {
        let f = encode_error_response(Some("r2"), DIAG_UNKNOWN_METHOD, Some("no such op")).unwrap();
        let env: ResponseEnvelope = serde_json::from_slice(&f.payload).unwrap();
        assert!(!env.ok);
        assert_eq!(env.id.as_deref(), Some("r2"));
        let e = env.error.unwrap();
        assert_eq!(e.code, DIAG_UNKNOWN_METHOD);
        assert_eq!(e.detail.as_deref(), Some("no such op"));
    }

    #[test]
    fn wire_error_mappings() {
        let (c, d) = wire_error_to_diagnostic(&WireError::MagicMismatch);
        assert_eq!(c, DIAG_MAGIC_MISMATCH);
        assert!(d.is_none());

        let (c, _d) = wire_error_to_diagnostic(&WireError::FrameTimeout);
        assert_eq!(c, DIAG_FRAME_TIMEOUT);

        let (c, d) = wire_error_to_diagnostic(&WireError::PayloadOversize(99_000_000));
        assert_eq!(c, DIAG_PAYLOAD_OVERSIZE);
        assert!(d.unwrap().contains("99000000"));
    }

    #[test]
    fn frame_constructor_rejects_invalid_bounds() {
        let big_meta = vec![0u8; (MAX_METADATA_BYTES + 1) as usize];
        let e = Frame::request(big_meta, Vec::new()).unwrap_err();
        assert!(matches!(e, WireError::MetadataOversize(_)));

        let big_pay = vec![0u8; (MAX_PAYLOAD_BYTES + 1) as usize];
        let e = Frame::request(Vec::new(), big_pay).unwrap_err();
        assert!(matches!(e, WireError::PayloadOversize(_)));

        let e = Frame::new(42, Vec::new(), Vec::new()).unwrap_err();
        assert!(matches!(e, WireError::InvalidKind(42)));
    }

    #[test]
    fn transport_roundtrip_send_receive() {
        let meta = b"{}".to_vec();
        let pay = br#"{"method":"echo","id":"1","params":{"x":1}}"#.to_vec();
        let f = Frame::request(meta.clone(), pay.clone()).unwrap();

        let mut buf = Vec::new();
        {
            let mut t = WireTransport::new(io::empty(), &mut buf);
            t.send_frame(&f).unwrap();
        }
        let expected = 13 + meta.len() + pay.len();
        assert_eq!(buf.len(), expected);

        let mut t = WireTransport::new(io::Cursor::new(&buf), io::sink());
        let f2 = t.read_next().unwrap();
        assert_eq!(f, f2);
    }

    #[test]
    fn empty_metadata_and_payload_is_valid() {
        let f = Frame::response(Vec::new(), Vec::new()).unwrap();
        assert_eq!(f.header.metadata_length, 0);
        assert_eq!(f.header.payload_length, 0);
        let mut buf = Vec::new();
        f.write_to(&mut buf).unwrap();
        assert_eq!(buf.len(), 13);
        let mut cursor = io::Cursor::new(&buf);
        let f2 = read_frame(&mut cursor, 0).unwrap();
        assert_eq!(f, f2);
    }

    #[test]
    fn header_byte_alignment_is_manual_no_padding() {
        let h = FrameHeader {
            magic: MAGIC,
            kind: KIND_DIAGNOSTIC,
            metadata_length: 0x1234_ABCD,
            payload_length: 0x00FF_FF00,
        };
        let b = h.to_bytes();
        assert_eq!(b[0], 0x4c);
        assert_eq!(b[1], 0x49);
        assert_eq!(b[2], 0x54);
        assert_eq!(b[3], 0x31);
        assert_eq!(b[4], 0x03);
        assert_eq!(&b[5..9], &[0x12, 0x34, 0xAB, 0xCD]);
        assert_eq!(&b[9..13], &[0x00, 0xFF, 0xFF, 0x00]);
    }
}
