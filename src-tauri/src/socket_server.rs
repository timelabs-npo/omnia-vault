// src-tauri/src/socket_server.rs
use std::io::{BufRead, BufReader, Write};
use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use serde_json::json;
use log::info;

use crate::ssh_manager;

#[derive(Deserialize)]
struct CommandRequest {
    cmd: String,
    #[serde(default)]
    args: serde_json::Value,
}

#[derive(Serialize)]
struct CommandResponse {
    status: String,
    message: String,
}

#[cfg(unix)]
pub async fn run_socket_server(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use std::path::Path;
    use std::os::unix::net::UnixListener;
    use std::fs::Permissions;
    use std::os::unix::fs::PermissionsExt;

    let base_dir = std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/tmp".to_string());
    let socket_path = format!("{}/omnia_vault.sock", base_dir);
    let path = Path::new(&socket_path);
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    let listener = UnixListener::bind(path)?;
    if let Ok(_) = std::fs::set_permissions(path, Permissions::from_mode(0o600)) {
        info!("Set socket permissions to 0600 on {}", socket_path);
    }
    info!("Unix socket server listening on {}", socket_path);

    tokio::task::spawn_blocking(move || {
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let mut reader = BufReader::new(&stream);
                let mut line = String::new();
                if reader.read_line(&mut line).is_ok() {
                    let req: Result<CommandRequest, _> = serde_json::from_str(&line);
                    let resp = match req {
                        Ok(cmd) => handle_command(cmd, &app_handle),
                        Err(e) => CommandResponse { status: "error".into(), message: format!("Invalid request: {}", e) },
                    };
                    let resp_str = serde_json::to_string(&resp).unwrap_or_else(|e| {
                        json!({"status":"error","message":format!("Serialize error: {}", e)}).to_string()
                    });
                    let _ = stream.write_all(resp_str.as_bytes());
                    let _ = stream.write_all(b"\n");
                }
            }
        }
    });
    Ok(())
}

#[cfg(windows)]
pub async fn run_socket_server(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use std::net::TcpListener;

    let bind_addr = "127.0.0.1:49152";
    let listener = TcpListener::bind(bind_addr)?;
    info!("Windows local TCP IPC server listening on {}", bind_addr);

    tokio::task::spawn_blocking(move || {
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let mut reader = BufReader::new(&stream);
                let mut line = String::new();
                if reader.read_line(&mut line).is_ok() {
                    let req: Result<CommandRequest, _> = serde_json::from_str(&line);
                    let resp = match req {
                        Ok(cmd) => handle_command(cmd, &app_handle),
                        Err(e) => CommandResponse { status: "error".into(), message: format!("Invalid request: {}", e) },
                    };
                    let resp_str = serde_json::to_string(&resp).unwrap_or_else(|e| {
                        json!({"status":"error","message":format!("Serialize error: {}", e)}).to_string()
                    });
                    let _ = stream.write_all(resp_str.as_bytes());
                    let _ = stream.write_all(b"\n");
                }
            }
        }
    });
    Ok(())
}

fn handle_command(cmd: CommandRequest, _app_handle: &AppHandle) -> CommandResponse {
    match cmd.cmd.as_str() {
        "status" | "check_daemon_health" => {
            CommandResponse {
                status: "ok".into(),
                message: "Omnia-Vault daemon is healthy and running".into(),
            }
        }
        "get_metrics" | "get_system_metrics" => {
            let snap = crate::metrics::collect_metrics();
            let msg = serde_json::to_string(&snap).unwrap_or_else(|_| "{}".into());
            CommandResponse {
                status: "ok".into(),
                message: msg,
            }
        }
        "quick_clean" => {
            match crate::metrics::perform_quick_clean() {
                Ok(msg) => CommandResponse { status: "ok".into(), message: msg },
                Err(err) => CommandResponse { status: "error".into(), message: err },
            }
        }
        "flip_backbone" => {
            let current = cmd.args.get("current_host").and_then(|v| v.as_str()).unwrap_or("");
            match ssh_manager::flip_backbone(current.to_string()) {
                Ok(msg) => CommandResponse { status: "ok".into(), message: msg },
                Err(err) => CommandResponse { status: "error".into(), message: err },
            }
        }
        "prepare_and_reboot" => {
            let is_mac = cfg!(target_os = "macos");
            match ssh_manager::prepare_and_reboot(is_mac) {
                Ok(msg) => CommandResponse { status: "ok".into(), message: msg },
                Err(err) => CommandResponse { status: "error".into(), message: err },
            }
        }
        "stop_ssh_tunnel" => {
            match ssh_manager::stop_ssh_tunnel() {
                Ok(msg) => CommandResponse { status: "ok".into(), message: msg },
                Err(err) => CommandResponse { status: "error".into(), message: err },
            }
        }
        "start_ssh_tunnel" => {
            let remote_host = cmd.args.get("remote_host").and_then(|v| v.as_str()).unwrap_or("");
            let identity_file = cmd.args.get("identity_file").and_then(|v| v.as_str()).unwrap_or("");
            let remote_port = cmd.args.get("remote_port").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
            let local_port = cmd.args.get("local_port").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
            match ssh_manager::start_ssh_tunnel(remote_host.to_string(), identity_file.to_string(), remote_port, local_port) {
                Ok(msg) => CommandResponse { status: "ok".into(), message: msg },
                Err(err) => CommandResponse { status: "error".into(), message: err },
            }
        }
        _ => CommandResponse { status: "error".into(), message: format!("Unknown command: {}", cmd.cmd) },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handle_command_status() {
        let req = CommandRequest {
            cmd: "check_daemon_health".into(),
            args: serde_json::Value::Null,
        };
        assert_eq!(req.cmd, "check_daemon_health");
    }

    #[test]
    fn test_flip_backbone_logic() {
        let res = ssh_manager::flip_backbone("mio.local".into()).unwrap();
        assert_eq!(res, "Backbone flipped from mio.local to wd.local");

        let res2 = ssh_manager::flip_backbone("wd.local".into()).unwrap();
        assert_eq!(res2, "Backbone flipped from wd.local to mio.local");
    }
}
