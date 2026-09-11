use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use crate::control::{get_dual_valve_state, set_valve_state};
use rusqlite::Connection;

#[no_mangle]
pub extern "C" fn get_valve_status() -> *mut c_char {
    let state = get_dual_valve_state();
    let status = format!("macOS:{},Win11:{}", state.valve_mio, state.valve_wd);
    CString::new(status).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn set_macos_valve(open: bool) {
    let _ = set_valve_state("macos", open);
}

#[no_mangle]
pub extern "C" fn set_win11_valve(open: bool) {
    let _ = set_valve_state("win11", open);
}

#[no_mangle]
pub extern "C" fn get_latest_lit_receipt() -> *mut c_char {
    if let Ok(conn) = Connection::open("/tmp/omnia_lit_store.db") {
        if let Ok(mut stmt) = conn.prepare("SELECT hash, logit FROM receipts ORDER BY id DESC LIMIT 1") {
            if let Ok(mut rows) = stmt.query([]) {
                if let Ok(Some(row)) = rows.next() {
                    let hash: String = row.get(0).unwrap_or_default();
                    let logit: f64 = row.get(1).unwrap_or_default();
                    let receipt = format!("{} (Logit: {:.2})", hash, logit);
                    return CString::new(receipt).unwrap().into_raw();
                }
            }
        }
    }
    CString::new("Waiting for LIT-001...").unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn fire_scion_l2_frame(claim: *const c_char) {
    if claim.is_null() { return; }
    let c_str = unsafe { CStr::from_ptr(claim) };
    if let Ok(s) = c_str.to_str() {
        let _ = crate::raw_socket::fire_scion_frame(s);
    }
}

#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    if s.is_null() { return; }
    unsafe {
        let _ = CString::from_raw(s);
    }
}

#[no_mangle]
pub extern "C" fn inject_scion_frame(target_host: *const c_char) -> i32 {
    if target_host.is_null() {
        return -1;
    }

    let c_str = unsafe { CStr::from_ptr(target_host) };
    let host = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return -2,
    };

    println!("[RUST C-FFI] Intercepted frame injection request for host: {}", host);
    println!("[RUST C-FFI] Successfully simulated native L2 frame injection via BSD raw sockets.");
    0
}
