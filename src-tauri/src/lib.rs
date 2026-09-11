#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub mod ssh_manager;
pub mod socket_server;
pub mod metrics;
pub mod tray;
pub mod llm;

use metrics::{collect_metrics, perform_quick_clean, SystemMetricsSnapshot};

#[tauri::command]
fn get_system_metrics() -> SystemMetricsSnapshot {
    collect_metrics()
}

#[tauri::command]
fn run_quick_clean() -> Result<String, String> {
    perform_quick_clean()
}

#[tauri::command]
async fn query_llm(req: llm::LLMQueryRequest) -> Result<llm::LLMQueryResponse, String> {
    llm::query_llm_provider(req).await
}

#[tauri::command]
fn get_llm_providers() -> Vec<llm::LLMProviderInfo> {
    llm::list_providers()
}

pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .invoke_handler(tauri::generate_handler![get_system_metrics, run_quick_clean, query_llm, get_llm_providers])
    .setup(|app| {
      // Setup system tray with live monitor and quick actions
      if let Err(e) = tray::setup_tray(app.handle()) {
        log::error!("Failed to initialize tray: {}", e);
      }

      // Start Unix socket server in background
      let app_handle = app.handle().clone();
      std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
          .enable_all()
          .build()
          .expect("Failed to build Tokio runtime");
        rt.block_on(async move {
          if let Err(e) = socket_server::run_socket_server(app_handle).await {
            log::error!("Socket server error: {}", e);
          }
        });
      });
      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Hide to tray instead of exiting process
        let _ = window.hide();
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
