use axum::{
    routing::get,
    Router,
    Json,
};
use serde::Serialize;
use sysinfo::System;
use std::sync::{Arc, Mutex};

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

#[derive(Serialize)]
struct SystemMetrics {
    total_memory: u64,
    used_memory: u64,
    free_memory: u64,
    cpu_usage: f32,
}

struct AppState {
    sys: Mutex<System>,
}

#[tokio::main]
async fn main() {
    println!("Starting Omnia Vault Local Supervisor...");

    // Initialize sysinfo
    let mut sys = System::new_all();
    sys.refresh_all();

    let shared_state = Arc::new(AppState {
        sys: Mutex::new(sys),
    });

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/cloud/scan", get(cloud_scan_handler))
        .with_state(shared_state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:4000").await.unwrap();
    println!("Supervisor listening on http://127.0.0.1:4000");
    
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: "0.1.0-alpha".to_string(),
    })
}

async fn metrics_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Json<SystemMetrics> {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_memory();
    sys.refresh_cpu_usage();

    let cpu_usage = sys.global_cpu_info().cpu_usage();

    Json(SystemMetrics {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        free_memory: sys.free_memory(),
        cpu_usage,
    })
}

#[derive(Serialize)]
struct CloudScanResult {
    provider: String,
    total_files: usize,
    total_size_bytes: u64,
    heavy_files: Vec<String>,
}

async fn cloud_scan_handler() -> Json<Vec<CloudScanResult>> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/sa".to_string());
    
    let icloud_path = format!("{}/Library/Mobile Documents/com~apple~CloudDocs", home);
    let gdrive_path = format!("{}/Library/CloudStorage", home);
    
    let mut results = Vec::new();
    
    // Scan iCloud
    results.push(scan_directory("iCloud", &icloud_path));
    
    // Scan G-Drive (finds subdirectories in CloudStorage containing 'google')
    if let Ok(entries) = std::fs::read_dir(&gdrive_path) {
        for entry in entries.flatten() {
            if let Ok(name) = entry.file_name().into_string() {
                if name.to_lowercase().contains("google") {
                    let full_path = entry.path().to_string_lossy().to_string();
                    results.push(scan_directory("Google Drive", &full_path));
                }
            }
        }
    }
    
    Json(results)
}

fn scan_directory(provider: &str, path: &str) -> CloudScanResult {
    let mut total_files = 0;
    let mut total_size_bytes = 0;
    let mut heavy_files = Vec::new();
    
    for entry in walkdir::WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total_files += 1;
            if let Ok(metadata) = entry.metadata() {
                let size = metadata.len();
                total_size_bytes += size;
                
                // Identify files larger than 100MB
                if size > 100 * 1024 * 1024 {
                    heavy_files.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    
    CloudScanResult {
        provider: provider.to_string(),
        total_files,
        total_size_bytes,
        heavy_files,
    }
}

