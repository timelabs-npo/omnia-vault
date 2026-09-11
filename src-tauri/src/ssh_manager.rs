// src-tauri/src/ssh_manager.rs
use std::process::{Command, Child};
use std::sync::Mutex;
use once_cell::sync::Lazy;

static TUNNEL_PROCESS: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));

pub fn start_ssh_tunnel(
    remote_host: String,
    identity_file: String,
    remote_port: u16,
    local_port: u16,
) -> Result<String, String> {
    stop_ssh_tunnel().ok();
    let ssh_cmd = Command::new("ssh")
        .arg("-N")
        .arg("-i")
        .arg(identity_file)
        .arg("-R")
        .arg(format!("{remote_port}:127.0.0.1:{local_port}"))
        .arg(remote_host)
        .spawn();
    match ssh_cmd {
        Ok(child) => {
            let pid = child.id();
            *TUNNEL_PROCESS.lock().unwrap() = Some(child);
            Ok(format!("SSH tunnel started (PID {})", pid))
        }
        Err(e) => Err(format!("Failed to start SSH tunnel: {}", e)),
    }
}

pub fn stop_ssh_tunnel() -> Result<String, String> {
    let mut guard = TUNNEL_PROCESS.lock().unwrap();
    if let Some(mut child) = guard.take() {
        match child.kill() {
            Ok(_) => Ok("SSH tunnel stopped".into()),
            Err(e) => Err(format!("Failed to kill SSH tunnel: {}", e)),
        }
    } else {
        Ok("No SSH tunnel was running".into())
    }
}

pub fn flip_backbone(current_host: String) -> Result<String, String> {
    let next_host = if current_host == "mio.local" { "wd.local" } else { "mio.local" };
    Ok(format!("Backbone flipped from {} to {}", current_host, next_host))
}

pub fn prepare_and_reboot(is_mac: bool) -> Result<String, String> {
    let _ = stop_ssh_tunnel();
    // In future: graceful docker / state shutdown
    let mut cmd = if is_mac {
        let mut c = Command::new("shutdown");
        c.arg("-r").arg("now");
        c
    } else {
        let mut c = Command::new("shutdown");
        c.arg("/r");
        c
    };
    match cmd.spawn() {
        Ok(_) => Ok("Reboot command issued".into()),
        Err(e) => Err(format!("Failed to issue reboot: {}", e)),
    }
}
