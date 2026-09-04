use axum::{
    routing::{get, post},
    Router,
    Json,
};
use serde::{Deserialize, Serialize};
use sysinfo::System;
use std::sync::{Arc, Mutex};
use std::fs;
use std::os::unix::fs::symlink;
use sha2::{Sha256, Digest};
use std::path::Path;
use rusqlite::Connection;
use std::time::{SystemTime, UNIX_EPOCH};

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
    db: Mutex<Connection>,
}

#[derive(Deserialize)]
struct StubRequest {
    file_path: String,
}

#[derive(Serialize)]
struct StubResponse {
    status: String,
    message: String,
    vault_path: Option<String>,
}

#[tokio::main]
async fn main() {
    println!("Starting Omnia Vault Local Supervisor...");

    // Initialize sysinfo
    let mut sys = System::new_all();
    sys.refresh_all();

    // Initialize SQLite Database
    let db_path = "/Users/sa/Documents/timelabs-npo/omnia-vault/supervisor/vault_state.db";
    let db = Connection::open(db_path).expect("Failed to open vault_state.db");
    db.execute(
        "CREATE TABLE IF NOT EXISTS stubbed_files (
            id INTEGER PRIMARY KEY,
            original_path TEXT NOT NULL UNIQUE,
            vault_path TEXT NOT NULL,
            size INTEGER,
            stubbed_at INTEGER
        )",
        [],
    ).expect("Failed to create stubbed_files table");

    let shared_state = Arc::new(AppState {
        sys: Mutex::new(sys),
        db: Mutex::new(db),
    });

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/cloud/scan", get(cloud_scan_handler))
        .route("/cloud/stub", post(cloud_stub_handler))
        .route("/cloud/restore", post(cloud_restore_handler))
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
struct HeavyFile {
    path: String,
    size_bytes: u64,
    is_stub: bool,
}

#[derive(Serialize)]
struct CloudScanResult {
    provider: String,
    total_files: usize,
    total_size_bytes: u64,
    heavy_files: Vec<HeavyFile>,
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
        let is_symlink = entry.file_type().is_symlink();
        if entry.file_type().is_file() || is_symlink {
            if let Ok(metadata) = std::fs::symlink_metadata(entry.path()) {
                if !is_symlink {
                    total_files += 1;
                    total_size_bytes += metadata.len();
                }
                
                // Identify files larger than 100MB
                if metadata.len() > 100 * 1024 * 1024 && !is_symlink {
                    heavy_files.push(HeavyFile {
                        path: entry.path().to_string_lossy().to_string(),
                        size_bytes: metadata.len(),
                        is_stub: false,
                    });
                } else if is_symlink {
                    // Check if it's one of our stubs
                    if let Ok(target) = std::fs::read_link(entry.path()) {
                        if target.to_string_lossy().contains(".nebula_vault_store") {
                            let target_size = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
                            heavy_files.push(HeavyFile {
                                path: entry.path().to_string_lossy().to_string(),
                                size_bytes: target_size,
                                is_stub: true,
                            });
                        }
                    }
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

async fn cloud_stub_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(payload): Json<StubRequest>,
) -> Json<StubResponse> {
    let vault_dir = "/Users/sa/Documents/timelabs-npo/omnia-vault/VaultData".to_string();
    
    if let Err(e) = fs::create_dir_all(&vault_dir) {
        return Json(StubResponse { status: "error".into(), message: format!("Failed to create vault: {}", e), vault_path: None });
    }
    
    let original_path = Path::new(&payload.file_path);
    if !original_path.exists() {
        return Json(StubResponse { status: "error".into(), message: "File not found".into(), vault_path: None });
    }
    
    if let Ok(metadata) = fs::symlink_metadata(original_path) {
        if metadata.file_type().is_symlink() {
            return Json(StubResponse { status: "error".into(), message: "File is already a stub (symlink)".into(), vault_path: None });
        }
    }
    
    let mut hasher = Sha256::new();
    hasher.update(payload.file_path.as_bytes());
    let hash_bytes = hasher.finalize();
    let hash = hash_bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    let vault_file_path = format!("{}/{}", vault_dir, hash);
    
    if let Err(e) = fs::rename(&payload.file_path, &vault_file_path) {
        if let Err(copy_err) = fs::copy(&payload.file_path, &vault_file_path) {
             return Json(StubResponse { status: "error".into(), message: format!("Move failed: {}", copy_err), vault_path: None });
        }
        let _ = fs::remove_file(&payload.file_path);
    }
    
    if let Err(e) = symlink(&vault_file_path, &payload.file_path) {
        let _ = fs::rename(&vault_file_path, &payload.file_path);
        return Json(StubResponse { status: "error".into(), message: format!("Symlink failed: {}", e), vault_path: None });
    }
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let file_size = fs::metadata(&vault_file_path).map(|m| m.len()).unwrap_or(0);
    
    let db = state.db.lock().unwrap();
    let _ = db.execute(
        "INSERT INTO stubbed_files (original_path, vault_path, size, stubbed_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(original_path) DO UPDATE SET vault_path=?2, size=?3, stubbed_at=?4",
        rusqlite::params![&payload.file_path, &vault_file_path, file_size as i64, now as i64],
    );

    Json(StubResponse {
        status: "success".into(),
        message: "File successfully stubbed".into(),
        vault_path: Some(vault_file_path),
    })
}

async fn cloud_restore_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(payload): Json<StubRequest>,
) -> Json<StubResponse> {
    let original_path = Path::new(&payload.file_path);
    
    if !original_path.exists() {
        return Json(StubResponse { status: "error".into(), message: "File not found".into(), vault_path: None });
    }
    
    if let Ok(metadata) = fs::symlink_metadata(original_path) {
        if !metadata.file_type().is_symlink() {
            return Json(StubResponse { status: "error".into(), message: "File is not a stub (not a symlink)".into(), vault_path: None });
        }
    } else {
        return Json(StubResponse { status: "error".into(), message: "Could not read metadata".into(), vault_path: None });
    }
    
    let vault_file_path = match fs::read_link(original_path) {
        Ok(path) => path,
        Err(e) => return Json(StubResponse { status: "error".into(), message: format!("Failed to read symlink: {}", e), vault_path: None }),
    };
    
    if !vault_file_path.exists() {
        return Json(StubResponse { status: "error".into(), message: "Vault file does not exist!".into(), vault_path: None });
    }
    
    if let Err(e) = fs::remove_file(original_path) {
        return Json(StubResponse { status: "error".into(), message: format!("Failed to remove symlink: {}", e), vault_path: None });
    }
    
    if let Err(_e) = fs::rename(&vault_file_path, original_path) {
         if let Err(copy_err) = fs::copy(&vault_file_path, original_path) {
             let _ = symlink(&vault_file_path, original_path);
             return Json(StubResponse { status: "error".into(), message: format!("Restore failed: {}", copy_err), vault_path: None });
         }
         let _ = fs::remove_file(&vault_file_path);
    }
    
    let db = state.db.lock().unwrap();
    let _ = db.execute(
        "DELETE FROM stubbed_files WHERE original_path = ?1",
        rusqlite::params![&payload.file_path],
    );
    
    Json(StubResponse {
        status: "success".into(),
        message: "File successfully restored".into(),
        vault_path: None,
    })
}
