#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub mod ssh_manager;
pub mod socket_server;
pub mod metrics;
pub mod tray;
pub mod llm;
pub mod lit;
pub mod rheknel;
pub mod raw_socket;
pub mod control;
pub mod ffi;

use metrics::{collect_metrics, perform_quick_clean, SystemMetricsSnapshot};
use control::{
    get_gns3_tunnel_status, toggle_gns3_tunnel, restart_gns3_tunnel,
    get_dual_valve_state, set_valve_state,
    get_scion_managed_daemons, get_scion_paths, get_gns3_topology_nodes,
    get_ndi_settings, restart_ndi_stream,
    TunnelStatus, DualValveState, ScionDaemonEntity, ScionPathEntity, Gns3TopologyNode, NdiSettings,
};

#[tauri::command]
fn get_system_metrics() -> SystemMetricsSnapshot {
    collect_metrics()
}

#[tauri::command]
fn run_quick_clean() -> Result<String, String> {
    perform_quick_clean()
}

#[tauri::command]
fn get_tunnel_status() -> TunnelStatus {
    get_gns3_tunnel_status()
}

#[tauri::command]
fn toggle_tunnel(enable: bool) -> Result<TunnelStatus, String> {
    toggle_gns3_tunnel(enable)
}

#[tauri::command]
fn restart_tunnel() -> Result<TunnelStatus, String> {
    restart_gns3_tunnel()
}

#[tauri::command]
fn get_valves() -> DualValveState {
    get_dual_valve_state()
}

#[tauri::command]
fn set_valve(valve: String, enable: bool) -> Result<DualValveState, String> {
    set_valve_state(&valve, enable)
}

#[tauri::command]
fn get_scion_daemons() -> Vec<ScionDaemonEntity> {
    get_scion_managed_daemons()
}

#[tauri::command]
fn get_scion_routing_paths() -> Vec<ScionPathEntity> {
    get_scion_paths()
}

#[tauri::command]
fn get_gns3_nodes() -> Vec<Gns3TopologyNode> {
    get_gns3_topology_nodes()
}

#[tauri::command]
fn get_ndi_config() -> NdiSettings {
    get_ndi_settings()
}

#[tauri::command]
fn restart_ndi(video_format: String, frame_rate: String) -> Result<String, String> {
    restart_ndi_stream(video_format, frame_rate)
}

#[tauri::command]
async fn query_llm(req: llm::LLMQueryRequest) -> Result<llm::LLMQueryResponse, String> {
    llm::query_llm_provider(req).await
}

#[tauri::command]
fn get_llm_providers() -> Vec<llm::LLMProviderInfo> {
    llm::list_providers()
}

#[tauri::command]
fn lit_publish_text(
    workspace_id: String,
    replica_id: String,
    item_id: String,
    text: String,
) -> Result<String, String> {
    let mut ws = [0u8; 16];
    let mut rep = [0u8; 16];
    let mut it = [0u8; 16];
    let ws_bytes = workspace_id.as_bytes();
    let rep_bytes = replica_id.as_bytes();
    let it_bytes = item_id.as_bytes();
    ws[..ws_bytes.len().min(16)].copy_from_slice(&ws_bytes[..ws_bytes.len().min(16)]);
    rep[..rep_bytes.len().min(16)].copy_from_slice(&rep_bytes[..rep_bytes.len().min(16)]);
    it[..it_bytes.len().min(16)].copy_from_slice(&it_bytes[..it_bytes.len().min(16)]);

    let store = &*lit::DEFAULT_LIT_STORE;
    let (head_rev, head_gen) = store.init_workspace(&ws, &rep)?;

    let mut op_id = [0u8; 16];
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    op_id[..8].copy_from_slice(&(now as u64).to_be_bytes());

    let req = lit::PublishRequest {
        owner_id: [1u8; 16],
        workspace_id: ws,
        replica_id: rep,
        operation_id: op_id,
        expected_revision_digest: head_rev,
        expected_generation: head_gen,
        item_id: it,
        data: text.into_bytes(),
    };

    let receipt = store.publish_item_bytes(req)?;
    Ok(format!(
        "LIT-001 Receipt: outcome={:?}, gen={}, rev={:02x?}",
        receipt.outcome,
        receipt.result_generation,
        &receipt.result_revision_digest[..8]
    ))
}

#[tauri::command]
fn evaluate_proposal(provider: String, model: String, prompt: String, output: String) -> rheknel::AdvisoryProposal {
    rheknel::RheknelJudge::evaluate(&provider, &model, &prompt, &output)
}

pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .invoke_handler(tauri::generate_handler![
        get_system_metrics, 
        run_quick_clean, 
        get_tunnel_status,
        toggle_tunnel,
        restart_tunnel,
        get_valves,
        set_valve,
        get_scion_daemons,
        get_scion_routing_paths,
        get_gns3_nodes,
        get_ndi_config,
        restart_ndi,
        query_llm, 
        get_llm_providers,
        lit_publish_text,
        evaluate_proposal
    ])
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
