use reqwest::Url;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Manager;

const LEGACY_APPDATA_DIR_NAME: &str = "com.messiah.expense-tracker";
const DATABASE_FILE_NAME: &str = "expense-tracker.db";

fn is_allowed_http_get_url(url: &str) -> bool {
    let parsed = match Url::parse(url) {
        Ok(v) => v,
        Err(_) => return false,
    };

    if parsed.scheme() != "https" {
        return false;
    }

    let host = match parsed.host_str() {
        Some(v) => v,
        None => return false,
    };

    match host {
        "api.coingecko.com" => parsed.path() == "/api/v3/simple/price",
        "www.ecb.europa.eu" => parsed.path() == "/stats/eurofxref/eurofxref-daily.xml",
        _ => false,
    }
}

#[tauri::command]
async fn http_get_text(url: String) -> Result<String, String> {
    if !is_allowed_http_get_url(&url) {
        return Err("URL is not allowed".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {} for {}", status.as_u16(), url));
    }

    let body = response.bytes().await.map_err(|e| e.to_string())?;
    if body.len() > 1024 * 1024 {
        return Err("HTTP response body exceeds 1MB".to_string());
    }

    String::from_utf8(body.to_vec()).map_err(|e| e.to_string())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create {}: {}", dst.display(), e))?;

    let entries =
        fs::read_dir(src).map_err(|e| format!("Failed to read {}: {}", src.display(), e))?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if src_path.is_file() {
            if let Some(parent) = dst_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
            }
            fs::copy(&src_path, &dst_path).map_err(|e| {
                format!(
                    "Failed to copy {} -> {}: {}",
                    src_path.display(),
                    dst_path.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

fn dir_is_empty(path: &Path) -> Result<bool, String> {
    if !path.exists() {
        return Ok(true);
    }
    let mut entries =
        fs::read_dir(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    Ok(entries.next().is_none())
}

fn migrate_legacy_app_data(app: &tauri::AppHandle) -> Result<(), String> {
    let new_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&new_dir)
        .map_err(|e| format!("Failed to prepare {}: {}", new_dir.display(), e))?;

    let appdata = match std::env::var("APPDATA") {
        Ok(v) => PathBuf::from(v),
        Err(_) => return Ok(()),
    };
    let old_dir = appdata.join(LEGACY_APPDATA_DIR_NAME);
    if !old_dir.exists() || old_dir == new_dir {
        return Ok(());
    }

    let new_is_empty = dir_is_empty(&new_dir)?;
    let new_has_db = new_dir.join(DATABASE_FILE_NAME).exists();
    if !new_is_empty || new_has_db {
        return Ok(());
    }

    copy_dir_recursive(&old_dir, &new_dir)?;

    // Best effort cleanup of legacy folder after successful copy.
    if let Err(err) = fs::remove_dir_all(&old_dir) {
        eprintln!(
            "Warning: failed to delete legacy app data folder {}: {}",
            old_dir.display(),
            err
        );
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(err) = migrate_legacy_app_data(app.handle()) {
                eprintln!("App data migration skipped: {}", err);
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![http_get_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
