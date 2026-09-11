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
    let scion_flow_item = MenuItem::with_id(app, "scion_flow", "🌐 SCION: ...", false, None::<&str>)?;
    let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let open_item = MenuItem::with_id(app, "open_dashboard", "Open Omnia-Vault Settings", true, None::<&str>)?;
    let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let valve_mio_item = MenuItem::with_id(app, "toggle_valve_mio", "Mio Proxy (macOS PAC): ...", true, None::<&str>)?;
    let valve_wd_item = MenuItem::with_id(app, "toggle_valve_wd", "WD Proxy: ...", true, None::<&str>)?;
    let clean_item = MenuItem::with_id(app, "quick_clean", "Clear Caches", true, None::<&str>)?;
    let sep3 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Omnia-Vault", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &metrics_item,
            &scion_flow_item,
            &sep1,
            &open_item,
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
        .title("⚡")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Omnia-Vault: SCION Proxy")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "open_dashboard" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "toggle_valve_mio" => {
                    info!("Toggling Mio Proxy");
                    let state = control::get_dual_valve_state();
                    let updated = control::set_valve_state("mio", !state.valve_mio);
                    if let Ok(v) = updated {
                        let _ = app.emit("dual-valves-update", &v);
                    }
                }
                "toggle_valve_wd" => {
                    info!("Toggling WD Proxy");
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

    // Background monitor task
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
            let flow_mode = if valves.valve_mio && valves.valve_wd {
                "Active"
            } else if valves.valve_mio || valves.valve_wd {
                "Degraded"
            } else {
                "Inactive"
            };
            
            let _ = scion_flow_item.set_text(format!("🌐 SCION: {}", flow_mode));
            let _ = valve_mio_item.set_text(format!("Mio Proxy (macOS PAC): {}", if valves.valve_mio { "ON" } else { "OFF" }));
            let _ = valve_wd_item.set_text(format!("WD Proxy:  {}", if valves.valve_wd { "ON" } else { "OFF" }));
            let _ = tray_handle.set_tooltip(Some(format!("Omnia-Vault: SCION Proxy\n{}\nCPU: {:.0}% | RAM: {:.0}%", flow_mode, snap.cpu_usage, snap.memory_percent)));

            // Emit live updates
            let _ = app_handle.emit("system-metrics-update", &snap);
            let _ = app_handle.emit("dual-valves-update", &valves);
        }
    });

    Ok(())
}
