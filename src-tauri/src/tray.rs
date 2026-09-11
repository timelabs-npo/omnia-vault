// src-tauri/src/tray.rs
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Emitter,
};
use log::info;

use crate::metrics;
use crate::control;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let metrics_item = MenuItem::with_id(app, "metrics_summary", "⚡ CPU: ... | RAM: ...", false, None::<&str>)?;
    let scion_flow_item = MenuItem::with_id(app, "scion_flow", "🌐 SCION: Blended (Warm Flow)", false, None::<&str>)?;
    let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let open_item = MenuItem::with_id(app, "open_dashboard", "📊 SCION Topology & Mole Monitor", true, None::<&str>)?;
    let control_pane_item = MenuItem::with_id(app, "open_control_pane", "⚙️ NDI Output (System Settings)", true, None::<&str>)?;
    let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let valve_mio_item = MenuItem::with_id(app, "toggle_valve_mio", "🚰 Valve A (mio.local): Active (Cold)", true, None::<&str>)?;
    let valve_wd_item = MenuItem::with_id(app, "toggle_valve_wd", "🚰 Valve B (wd.local):  Active (Hot)", true, None::<&str>)?;
    let clean_item = MenuItem::with_id(app, "quick_clean", "🧹 Wipe Caches (Mole)", true, None::<&str>)?;
    let sep3 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "❌ Quit Omnia-Vault", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &metrics_item,
            &scion_flow_item,
            &sep1,
            &open_item,
            &control_pane_item,
            &sep2,
            &valve_mio_item,
            &valve_wd_item,
            &clean_item,
            &sep3,
            &quit_item,
        ],
    )?;

    let icon_bytes = include_bytes!("../icons/32x32.png");
    let tray_icon = tauri::image::Image::from_bytes(icon_bytes)?;

    let tray = TrayIconBuilder::new()
        .icon(tray_icon)
        .icon_as_template(true)
        .title("⚡ 0% 0%")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Omnia-Vault: SCION Multi-Path & System Monitor")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "open_dashboard" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                        let _ = window.emit("navigate-tab", "monitor");
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
                "toggle_valve_mio" => {
                    info!("Toggling Valve A (mio.local)");
                    let state = control::get_dual_valve_state();
                    let updated = control::set_valve_state("mio", !state.valve_mio);
                    if let Ok(v) = updated {
                        let _ = app.emit("dual-valves-update", &v);
                    }
                }
                "toggle_valve_wd" => {
                    info!("Toggling Valve B (wd.local)");
                    let state = control::get_dual_valve_state();
                    let updated = control::set_valve_state("wd", !state.valve_wd);
                    if let Ok(v) = updated {
                        let _ = app.emit("dual-valves-update", &v);
                    }
                }
                "quick_clean" => {
                    info!("Running quick clean via Tray");
                    let _ = metrics::perform_quick_clean();
                    let snap = metrics::collect_metrics();
                    let _ = app.emit("system-metrics-update", &snap);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    // Background monitor task: update tray title ticker, tooltip and item text periodically
    let app_handle = app.clone();
    let tray_handle = tray.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            let snap = metrics::collect_metrics();
            let ticker = format!("⚡ {:.0}% {:.0}%", snap.cpu_usage, snap.memory_percent);
            let _ = tray_handle.set_title(Some(ticker));
            let summary = format!("⚡ CPU: {:.0}% · RAM: {:.0}%", snap.cpu_usage, snap.memory_percent);
            let _ = metrics_item.set_text(summary);
            
            // Dual valve multi-path flow calculation
            let valves = control::get_dual_valve_state();
            let _ = scion_flow_item.set_text(format!("🌐 SCION: {}", valves.flow_mode));
            let _ = valve_mio_item.set_text(format!("🚰 Valve A (mio.local): {}", if valves.valve_mio { "Active (Cold)" } else { "Closed" }));
            let _ = valve_wd_item.set_text(format!("🚰 Valve B (wd.local):  {}", if valves.valve_wd { "Active (Hot)" } else { "Closed" }));
            let _ = tray_handle.set_tooltip(Some(format!("Omnia-Vault: SCION Multi-Path\n{}\nCPU: {:.0}% | RAM: {:.0}%", valves.flow_mode, snap.cpu_usage, snap.memory_percent)));

            // Emit live updates
            let _ = app_handle.emit("system-metrics-update", &snap);
            let _ = app_handle.emit("dual-valves-update", &valves);
        }
    });

    Ok(())
}
