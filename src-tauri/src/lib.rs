use std::path::PathBuf;
use std::process::Command;

/// Convert a legacy `.doc` (Word 97–2003) file to HTML using macOS's built-in
/// `textutil` command. Returns the HTML body as a string.
///
/// `textutil` is shipped with every macOS install, so no external dependencies.
/// On Windows / Linux this command will not work and we'd need an alternative
/// backend (`antiword`, LibreOffice sidecar, or a Rust crate).
#[tauri::command]
fn convert_doc(path: String) -> Result<String, String> {
    let textutil = PathBuf::from("/usr/bin/textutil");
    if !textutil.exists() {
        return Err(
            "textutil not found. .doc parsing currently requires macOS."
                .to_string(),
        );
    }

    let output = Command::new(&textutil)
        .arg("-convert")
        .arg("html")
        .arg("-stdout")
        .arg("--")
        .arg(&path)
        .output()
        .map_err(|e| format!("Failed to run textutil: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("textutil failed: {}", stderr));
    }

    String::from_utf8(output.stdout)
        .map_err(|e| format!("textutil output was not valid UTF-8: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![convert_doc])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
