// omnia-vault/src-tauri/src/bin/fire_frame.rs
// Standalone Raw SCION L2/L3 Frame Emitter
use omnia_vault::raw_socket;

fn main() {
    let claim = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "SYSTEM_CLAIM: Traffic anomaly detected on node 7. Evaluate immediately.".to_string());
    
    println!("🔥 OMNIA-VAULT: Preparing raw L2 SCION packet...");
    match raw_socket::fire_scion_frame(&claim) {
        Ok(bytes) => println!("✅ Fired {} bytes through raw TAP interface to /tmp/scion_tap.sock", bytes),
        Err(e) => {
            eprintln!("❌ Failed to fire frame: {}", e);
            std::process::exit(1);
        }
    }
}
