// Connection actions must not infer network health from internal control flags.
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Emitter,
};
use crate::{metrics, control};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = MenuItem::with_id(app, "connection_status", "Connection not verified", false, None::<&str>)?;
    let checks = MenuItem::with_id(app, "connection_checks", "Check connection", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open_dashboard", "Open app", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Omnia-Vault", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&state, &checks, &open, &separator, &quit])?;
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))?;
    TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Connection not verified. Open connection checks for current results.")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "connection_checks" => {
                if let Err(error) = control::open_connection_checks() {
                    log::error!("Could not open connection checks: {}", error);
                    let _ = app.emit("connection-checks-error", &error);
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
            "open_dashboard" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    // Preserve system readings for the System page. They do not assert routing.
    let app_handle = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(2));
        let snapshot = metrics::collect_metrics();
        let _ = app_handle.emit("system-metrics-update", &snapshot);
    });
    Ok(())
}
