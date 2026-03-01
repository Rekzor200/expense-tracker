use reqwest::Url;
use std::time::Duration;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
