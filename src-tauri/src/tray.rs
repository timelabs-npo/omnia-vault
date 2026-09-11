// src-tauri/src/tray.rs
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Emitter,
};
use log::info;

use crate::metrics;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let metrics_item = MenuItem::with_id(app, "metrics_summary", "⚡ CPU: ... | RAM: ...", false, None::<&str>)?;
    let scion_item = MenuItem::with_id(app, "scion_status", "🌐 SCION: Active (AS ff00:0:110)", false, None::<&str>)?;
    let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let open_item = MenuItem::with_id(app, "open_dashboard", "📊 Open Dashboard", true, None::<&str>)?;
    let control_pane_item = MenuItem::with_id(app, "open_control_pane", "⚙️ Control Pane (System Settings)", true, None::<&str>)?;
    let clean_item = MenuItem::with_id(app, "quick_clean", "🧹 Safe Quick Clean (Mole)", true, None::<&str>)?;
    let flip_item = MenuItem::with_id(app, "flip_backbone", "🔄 Flip Backbone (mio ⇄ wd)", true, None::<&str>)?;
    let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "❌ Quit Omnia-Vault", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &metrics_item,
            &scion_item,
            &sep1,
            &open_item,
            &control_pane_item,
            &clean_item,
            &flip_item,
            &sep2,
            &quit_item,
        ],
    )?;

    let tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Omnia-Vault: SCION & System Monitor")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "open_dashboard" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "open_control_pane" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                        let _ = window.emit("navigate-tab", "control_pane");
                    }
                }
                "quick_clean" => {
                    info!("Running quick clean via Tray event");
                    let _ = metrics::perform_quick_clean();
                }
                "flip_backbone" => {
                    info!("Flipping backbone via Tray event");
                    let _ = crate::ssh_manager::flip_backbone("mio.local".into());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    // Background monitor task: update tray tooltip and item text periodically
    let app_handle = app.clone();
    let tray_handle = tray.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(3));
            let snap = metrics::collect_metrics();
            let summary = format!("⚡ CPU: {:.0}% | RAM: {:.0}% | Health: {}%", snap.cpu_usage, snap.memory_percent, snap.health_score);
            let _ = tray_handle.set_tooltip(Some(format!("Omnia-Vault\n{}", summary)));
            let _ = metrics_item.set_text(summary);
            // emit event to frontend if window is alive
            let _ = app_handle.emit("system-metrics-update", &snap);
        }
    });

    Ok(())
}
