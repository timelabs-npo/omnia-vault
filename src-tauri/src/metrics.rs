// src-tauri/src/metrics.rs
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use sysinfo::{System, Disks, Networks};

static SYS: Lazy<Mutex<System>> = Lazy::new(|| {
    let mut sys = System::new_all();
    sys.refresh_all();
    Mutex::new(sys)
});

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_gb: f64,
    pub used_gb: f64,
    pub free_gb: f64,
    pub usage_percent: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_mb: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemMetricsSnapshot {
    pub cpu_usage: f32,
    pub cpu_cores: usize,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_percent: f32,
    pub swap_total_mb: u64,
    pub swap_used_mb: u64,
    pub disks: Vec<DiskInfo>,
    pub cleanable_estimate_mb: u64,
    pub network_rx_kb: u64,
    pub network_tx_kb: u64,
    pub top_processes: Vec<ProcessInfo>,
    pub uptime_secs: u64,
    pub os_name: String,
}

pub fn collect_metrics() -> SystemMetricsSnapshot {
    let mut sys = SYS.lock().unwrap();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_usage();
    let cpu_cores = sys.cpus().len();

    let memory_total_mb = sys.total_memory() / 1024 / 1024;
    let memory_used_mb = sys.used_memory() / 1024 / 1024;
    let memory_percent = if memory_total_mb > 0 {
        (memory_used_mb as f32 / memory_total_mb as f32) * 100.0
    } else {
        0.0
    };

    let swap_total_mb = sys.total_swap() / 1024 / 1024;
    let swap_used_mb = sys.used_swap() / 1024 / 1024;

    // Disks
    let disks_info = Disks::new_with_refreshed_list();
    let mut disks = Vec::new();
    for disk in disks_info.list() {
        let total = disk.total_space() as f64 / 1024.0 / 1024.0 / 1024.0;
        let available = disk.available_space() as f64 / 1024.0 / 1024.0 / 1024.0;
        let used = total - available;
        let pct = if total > 0.0 { (used / total) * 100.0 } else { 0.0 };
        disks.push(DiskInfo {
            name: disk.name().to_string_lossy().into_owned(),
            mount_point: disk.mount_point().to_string_lossy().into_owned(),
            total_gb: (total * 10.0).round() / 10.0,
            used_gb: (used * 10.0).round() / 10.0,
            free_gb: (available * 10.0).round() / 10.0,
            usage_percent: (pct * 10.0).round() / 10.0,
        });
    }

    // Networks
    let networks = Networks::new_with_refreshed_list();
    let mut rx_bytes = 0u64;
    let mut tx_bytes = 0u64;
    for (_name, net) in networks.iter() {
        rx_bytes += net.received();
        tx_bytes += net.transmitted();
    }

    // Cleanable estimate (Mole scan targets: user Caches, logs, etc.)
    let cleanable_mb = estimate_cleanable_cache();

    // Processes & Uptime
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let mut procs: Vec<ProcessInfo> = sys.processes().iter().map(|(pid, p)| {
        ProcessInfo {
            pid: pid.as_u32(),
            name: p.name().to_string_lossy().into_owned(),
            cpu_usage: (p.cpu_usage() * 10.0).round() / 10.0,
            memory_mb: p.memory() / 1024 / 1024,
        }
    }).collect();
    procs.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
    procs.truncate(5);

    let uptime_secs = System::uptime();
    let os_name = System::long_os_version().unwrap_or_else(|| "macOS".to_string());

    SystemMetricsSnapshot {
        cpu_usage: (cpu_usage * 10.0).round() / 10.0,
        cpu_cores,
        memory_total_mb,
        memory_used_mb,
        memory_percent: (memory_percent * 10.0).round() / 10.0,
        swap_total_mb,
        swap_used_mb,
        disks,
        cleanable_estimate_mb: cleanable_mb,
        network_rx_kb: rx_bytes / 1024,
        network_tx_kb: tx_bytes / 1024,
        top_processes: procs,
        uptime_secs,
        os_name,
    }
}

pub fn estimate_cleanable_cache() -> u64 {
    let mut cleanable_bytes = 0u64;
    if let Ok(home) = std::env::var("HOME") {
        let targets = [
            format!("{}/.omnia-vault/logs", home),
            format!("{}/Library/Caches/com.omniavault.app", home),
            format!("{}/Library/Logs/com.omniavault.app", home),
            std::env::temp_dir().to_string_lossy().to_string(),
        ];
        for t in &targets {
            let path = std::path::Path::new(t);
            if path.is_dir() {
                if let Ok(entries) = std::fs::read_dir(path) {
                    for entry in entries.flatten().take(100) {
                        let file_name = entry.file_name().to_string_lossy().to_string();
                        if file_name.starts_with("omnia") || file_name.starts_with("scion") || file_name.ends_with(".log") || file_name.ends_with(".tmp") {
                            if let Ok(meta) = entry.metadata() {
                                cleanable_bytes += meta.len();
                            }
                        }
                    }
                }
            }
        }
    }
    (cleanable_bytes / 1024 / 1024)
}

pub fn perform_quick_clean() -> Result<String, String> {
    let mut total_bytes_freed = 0u64;
    let mut cleaned_buckets = 0;
    let mut errors = 0;

    if let Ok(home) = std::env::var("HOME") {
        let targets = [
            format!("{}/.omnia-vault/logs", home),
            format!("{}/Library/Caches/com.omniavault.app", home),
        ];

        for t in &targets {
            let p = std::path::Path::new(t);
            if p.exists() {
                if let Ok(entries) = std::fs::read_dir(p) {
                    for entry in entries.flatten() {
                        if let Ok(meta) = entry.metadata() {
                            if std::fs::remove_file(entry.path()).is_ok() {
                                total_bytes_freed += meta.len();
                            } else {
                                errors += 1;
                            }
                        }
                    }
                }
                cleaned_buckets += 1;
            }
        }

        // Clean stale temp socket or tmp files
        let tmp_dir = std::env::temp_dir();
        if let Ok(entries) = std::fs::read_dir(&tmp_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if (name.starts_with("omnia_vault") && name.ends_with(".tmp")) || name.ends_with(".scion.tmp") {
                    if let Ok(meta) = entry.metadata() {
                        if std::fs::remove_file(entry.path()).is_ok() {
                            total_bytes_freed += meta.len();
                        } else {
                            errors += 1;
                        }
                    }
                }
            }
        }
    }

    let freed_mb = (total_bytes_freed as f64) / 1024.0 / 1024.0;
    if errors > 0 {
        return Err(format!("Cleaned {:.1} MB, but encountered {} errors.", freed_mb, errors));
    }
    
    if freed_mb > 0.05 {
        Ok(format!("Deleted {:.1} MB across {} locations", freed_mb, cleaned_buckets.max(1)))
    } else {
        Ok("All app caches are clean (0 B deleted)".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collect_metrics() {
        let metrics = collect_metrics();
        assert!(metrics.cpu_cores > 0);
        assert!(metrics.memory_total_mb > 0);
    }
}
