// src-tauri/src/raw_socket.rs
// Bare-Metal SCION L2/L3 Raw Frame Socket (Zero-Trust TAP/Packet Ingress)
use std::io;
use std::os::unix::net::UnixDatagram;

pub const SCION_ETHERTYPE: u16 = 0x88B5; // IEEE 802 Local Experimental / SCION L2
pub const DEFAULT_TAP_SOCKET: &str = "/tmp/scion_tap.sock";

/// Fires a raw SCION L2/L3 frame containing the claim directly into the TAP socket.
/// Bypasses TCP/IP. Encapsulated in IEEE 802.3 EtherType 0x88B5.
pub fn fire_scion_frame(claim: &str) -> io::Result<usize> {
    fire_scion_frame_to(DEFAULT_TAP_SOCKET, claim)
}

/// Fires an unfragmented L2/L3 SCION packet frame to an explicit raw socket endpoint.
pub fn fire_scion_frame_to(socket_path: &str, claim: &str) -> io::Result<usize> {
    let socket = UnixDatagram::unbound()?;
    let mut frame = Vec::with_capacity(1024);

    // 1. Ethernet Header (14 bytes): Dst MAC, Src MAC, EtherType (0x88B5)
    frame.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x11]); // Dst MAC
    frame.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x22]); // Src MAC
    frame.extend_from_slice(&SCION_ETHERTYPE.to_be_bytes());          // EtherType (0x88B5)

    // 2. SCION Dummy L3 Header (32 bytes): Src AS (16 bytes), Dst AS (16 bytes)
    frame.extend_from_slice(b"1-ff00:0:110    "); // Src AS (16B)
    frame.extend_from_slice(b"1-ff00:0:111    "); // Dst AS (16B)

    // 3. Payload (The Claim, starts at offset 46)
    frame.extend_from_slice(claim.as_bytes());

    let sent = socket.send_to(&frame, socket_path)?;
    println!("⚡ RUST INGRESS: Fired {} byte L2 SCION frame to {}.", frame.len(), socket_path);
    Ok(sent)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fire_scion_frame_packet_structure() {
        let test_sock = "/tmp/test_scion_harness.sock";
        let rx = UnixDatagram::bind(test_sock).expect("bind harness");

        let claim = "SYSTEM_CLAIM: Traffic anomaly detected on node 7.";
        let sent = fire_scion_frame_to(test_sock, claim).expect("fire frame");
        assert_eq!(sent, 46 + claim.len());

        let mut buf = [0u8; 512];
        let len = rx.recv(&mut buf).expect("recv harness");
        assert_eq!(len, sent);

        // Verify Ethernet EtherType
        assert_eq!(&buf[12..14], &[0x88, 0xB5]);

        // Verify SCION AS headers
        assert_eq!(&buf[14..30], b"1-ff00:0:110    ");
        assert_eq!(&buf[30..46], b"1-ff00:0:111    ");

        // Verify Payload at offset 46
        assert_eq!(&buf[46..len], claim.as_bytes());

        let _ = std::fs::remove_file(test_sock);
    }
}
