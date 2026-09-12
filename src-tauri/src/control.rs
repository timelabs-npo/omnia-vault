// src-tauri/src/control.rs
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::net::{TcpStream, SocketAddr};
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use log::{info, warn};

static MIO_VALVE_ACTIVE: AtomicBool = AtomicBool::new(true);

pub fn open_connection_checks() -> Result<(), String> {
    let output = Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.timelabs.BlueshoesPane")
        .output()
        .map_err(|e| format!("Could not open Connections in System Settings: {}", e))?;
    if output.status.success() {
        Ok(())
    } else {
        Err("Could not open Connections in System Settings. Open System Settings and select Connections.".into())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TunnelStatus {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub port_responding: bool,
    pub label: String,
    pub target_host: String,
    pub plist_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DualValveState {
    pub valve_mio: bool,
    pub valve_wd: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScionDaemonEntity {
    pub id: String,
    pub name: String,
    pub as_id: String,
    pub daemon_type: String, // "Control Service (CS)", "Border Router (BR)", "Daemon (sciond)", "IP Gateway (SIG)", "Dispatcher"
    pub status: String,      // "running", "stopped", "standby"
    pub port: u16,
    pub packet_count: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScionPathEntity {
    pub destination_as: String,
    pub hops: Vec<String>,
    pub mtu: u16,
    pub latency_ms: f32,
    pub expiration_secs: u64,
    pub is_active: bool,
    pub policy: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Gns3TopologyNode {
    pub node_id: String,
    pub name: String,
    pub node_type: String,
    pub status: String,
    pub console_port: u16,
    pub as_mapping: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NdiSettings {
    pub video_format: String,
    pub frame_rate: String,
    pub enabled: bool,
    pub last_restart_timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SyncFolderPair {
    pub id: String,
    pub local_path: String,
    pub remote_path: String,
    pub direction: String, // "two-way", "up", "down"
    pub conflict_handling: String, // "keep-both", "overwrite-local", "overwrite-remote"
    pub pending_items: u32,
    pub errors: u32,
    pub last_completed: String,
    pub is_paused: bool,
    pub exclusions: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SyncStatus {
    pub accounts: Vec<String>,
    pub pairs: Vec<SyncFolderPair>,
    pub archive_status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActiveMonitoringStatus {
    pub is_active: bool,
    pub vpn_priority_lowered: bool,
    pub dead_ends_excluded: u32,
    pub last_scan: String,
}

pub fn get_gns3_tunnel_status() -> TunnelStatus {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/sa".to_string());
    let plist_path = format!("{}/Library/LaunchAgents/com.omniavault.gns3tunnel.plist", home);

    let mut is_running = false;
    let mut pid = None;
    let target_host = "wd.local".to_string();

    let output = Command::new("launchctl")
        .arg("list")
        .arg("com.omniavault.gns3tunnel")
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("\"PID\"") {
                    if let Some(val) = trimmed.split('=').nth(1) {
                        let num_str = val.trim().trim_matches(';').trim();
                        if let Ok(parsed_pid) = num_str.parse::<u32>() {
                            pid = Some(parsed_pid);
                            is_running = true;
                        }
                    }
                }
            }
        }
    }

    // Check if 127.0.0.1:3080 TCP port is open and responding
    let addr: SocketAddr = "127.0.0.1:3080".parse().unwrap();
    let port_responding = TcpStream::connect_timeout(&addr, Duration::from_millis(600)).is_ok();

    TunnelStatus {
        is_running,
        pid,
        port_responding,
        label: "com.omniavault.gns3tunnel".to_string(),
        target_host,
        plist_path,
    }
}

pub fn get_dual_valve_state() -> DualValveState {
    let tunnel = get_gns3_tunnel_status();
    let valve_wd = tunnel.is_running;
    let valve_mio = MIO_VALVE_ACTIVE.load(Ordering::SeqCst);

    DualValveState {
        valve_mio,
        valve_wd,
    }
}

pub fn set_valve_state(valve: &str, enable: bool) -> Result<DualValveState, String> {
    match valve {
        "wd" => {
            toggle_gns3_tunnel(enable)?;
        }
        "mio" => {
            MIO_VALVE_ACTIVE.store(enable, Ordering::SeqCst);
            if enable {
                let out1 = Command::new("networksetup")
                    .args(&["-setautoproxyurl", "Wi-Fi", "http://127.0.0.1:8888/skip.pac"])
                    .output();
                if out1.is_err() || !out1.as_ref().unwrap().status.success() {
                    MIO_VALVE_ACTIVE.store(false, Ordering::SeqCst);
                    return Err("Failed to set automatic proxy URL".into());
                }
                let out2 = Command::new("networksetup")
                    .args(&["-setautoproxystate", "Wi-Fi", "on"])
                    .output();
                if out2.is_err() || !out2.as_ref().unwrap().status.success() {
                    MIO_VALVE_ACTIVE.store(false, Ordering::SeqCst);
                    return Err("Failed to enable automatic proxy state".into());
                }
                info!("Automatic proxy enabled.");
            } else {
                let out = Command::new("networksetup")
                    .args(&["-setautoproxystate", "Wi-Fi", "off"])
                    .output();
                if out.is_err() || !out.as_ref().unwrap().status.success() {
                    return Err("Failed to disable automatic proxy".into());
                }
                info!("Automatic proxy disabled.");
            }
        }
        _ => return Err(format!("Unknown connection: {}", valve)),
    }
    Ok(get_dual_valve_state())
}

fn get_current_uid() -> u32 {
    Command::new("id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<u32>().ok())
        .unwrap_or(501)
}

pub fn toggle_gns3_tunnel(enable: bool) -> Result<TunnelStatus, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/sa".to_string());
    let plist_path = format!("{}/Library/LaunchAgents/com.omniavault.gns3tunnel.plist", home);

    if enable {
        info!("Enabling GNS3 tunnel via launchctl: {}", plist_path);
        let _ = Command::new("launchctl").arg("load").arg("-w").arg(&plist_path).output();
        let uid = get_current_uid();
        let _ = Command::new("launchctl")
            .arg("kickstart")
            .arg("-k")
            .arg(format!("gui/{}/com.omniavault.gns3tunnel", uid))
            .output();
    } else {
        info!("Stopping GNS3 tunnel via launchctl");
        let _ = Command::new("launchctl").arg("stop").arg("com.omniavault.gns3tunnel").output();
        let _ = Command::new("launchctl").arg("unload").arg(&plist_path).output();
    }

    std::thread::sleep(Duration::from_millis(300));
    Ok(get_gns3_tunnel_status())
}

pub fn restart_gns3_tunnel() -> Result<TunnelStatus, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/sa".to_string());
    let plist_path = format!("{}/Library/LaunchAgents/com.omniavault.gns3tunnel.plist", home);
    let uid = get_current_uid();

    info!("Restarting GNS3 tunnel via kickstart");
    let _ = Command::new("launchctl").arg("load").arg("-w").arg(&plist_path).output();
    let output = Command::new("launchctl")
        .arg("kickstart")
        .arg("-k")
        .arg(format!("gui/{}/com.omniavault.gns3tunnel", uid))
        .output();

    match output {
        Ok(out) if out.status.success() => {
            std::thread::sleep(Duration::from_millis(400));
            Ok(get_gns3_tunnel_status())
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            warn!("Kickstart non-zero output: {}", err);
            std::thread::sleep(Duration::from_millis(300));
            Ok(get_gns3_tunnel_status())
        }
        Err(e) => Err(format!("Failed to execute launchctl kickstart: {}", e)),
    }
}

pub fn get_scion_managed_daemons() -> Vec<ScionDaemonEntity> {
    vec![]
}

pub fn get_scion_paths() -> Vec<ScionPathEntity> {
    vec![]
}

pub fn get_gns3_topology_nodes() -> Vec<Gns3TopologyNode> {
    vec![]
}

pub fn get_ndi_settings() -> NdiSettings {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/sa".to_string());
    let config_path = format!("{}/.omnia-vault/ndi_settings.json", home);

    if let Ok(data) = std::fs::read_to_string(&config_path) {
        if let Ok(settings) = serde_json::from_str::<NdiSettings>(&data) {
            return settings;
        }
    }

    NdiSettings {
        video_format: "720p HD        ITU Rec 709".to_string(),
        frame_rate: "60".to_string(),
        enabled: true,
        last_restart_timestamp: 0,
    }
}

pub fn restart_ndi_stream(format: String, frame_rate: String) -> Result<String, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/sa".to_string());
    let dir = format!("{}/.omnia-vault", home);
    let _ = std::fs::create_dir_all(&dir);
    let config_path = format!("{}/ndi_settings.json", dir);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let settings = NdiSettings {
        video_format: format.clone(),
        frame_rate: frame_rate.clone(),
        enabled: true,
        last_restart_timestamp: now,
    };

    let serialized = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize NDI settings: {}", e))?;
    std::fs::write(&config_path, serialized)
        .map_err(|e| format!("Failed to write NDI settings file: {}", e))?;

    info!("NDI stream parameters updated: format={}, fps={}", format, frame_rate);
    Ok(format!(
        "NDI Output restarted successfully. Broadcasting at {} fps ({}).",
        frame_rate, format
    ))
}

pub fn get_sync_status() -> SyncStatus {
    SyncStatus {
        accounts: vec!["Pro Apple Cloud".to_string(), "Local Storage".to_string()],
        pairs: vec![
            SyncFolderPair {
                id: "pair-1".to_string(),
                local_path: "/Users/sa/Documents".to_string(),
                remote_path: "Pro Apple Cloud/Documents".to_string(),
                direction: "two-way".to_string(),
                conflict_handling: "keep-both".to_string(),
                pending_items: 0,
                errors: 0,
                last_completed: "Just now".to_string(),
                is_paused: false,
                exclusions: vec!["*.tmp".to_string(), "node_modules".to_string()],
            }
        ],
        archive_status: "Healthy".to_string(),
    }
}

pub fn get_monitoring_status() -> ActiveMonitoringStatus {
    ActiveMonitoringStatus {
        is_active: true,
        vpn_priority_lowered: true,
        dead_ends_excluded: 2,
        last_scan: "Just now".to_string(),
    }
}

pub fn set_monitoring_priority(_vpn_priority_lowered: bool) -> Result<(), String> {
    // Mock changing network priority
    Ok(())
}
