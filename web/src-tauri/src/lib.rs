use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;
use url::Url;
use uuid::Uuid;

/// Response from YouTube download
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResponse {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub duration: f64,
    pub thumbnail: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
}

/// YouTube video metadata from yt-dlp
#[derive(Debug, Deserialize)]
struct YtdlpMetadata {
    title: Option<String>,
    uploader: Option<String>,
    channel: Option<String>,
    duration: Option<f64>,
    thumbnail: Option<String>,
}

/// Get the audio cache directory
fn get_audio_dir() -> Result<PathBuf, String> {
    let cache_dir = dirs::cache_dir()
        .ok_or_else(|| "Could not find cache directory".to_string())?;
    let audio_dir = cache_dir.join("autostepper").join("audio");
    std::fs::create_dir_all(&audio_dir)
        .map_err(|e| format!("Failed to create audio directory: {}", e))?;
    Ok(audio_dir)
}

/// Find yt-dlp executable
fn find_ytdlp() -> Option<String> {
    let candidates = [
        "yt-dlp",
        "/usr/local/bin/yt-dlp",
        "/opt/homebrew/bin/yt-dlp",
        "/usr/bin/yt-dlp",
    ];

    for candidate in candidates {
        if std::process::Command::new(candidate)
            .arg("--version")
            .output()
            .is_ok()
        {
            return Some(candidate.to_string());
        }
    }
    None
}

/// Find Deno executable
fn find_deno() -> Option<String> {
    let home = dirs::home_dir()?;
    let candidates = [
        home.join(".deno/bin/deno"),
        PathBuf::from("/usr/local/bin/deno"),
        PathBuf::from("/opt/homebrew/bin/deno"),
        PathBuf::from("/usr/bin/deno"),
        home.join(".local/bin/deno"),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    which::which("deno")
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

/// Detect available browser for cookies extraction
/// Returns the browser name that yt-dlp can use with --cookies-from-browser
fn find_browser_for_cookies() -> Option<&'static str> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return None,
    };

    // Check browsers in order of preference
    // Each tuple: (browser name for yt-dlp, cookie database paths to check)
    let browsers: &[(&str, &[&str])] = &[
        ("chrome", &[
            ".config/google-chrome/Default/Cookies",
            ".config/google-chrome/Default/Network/Cookies",
            "Library/Application Support/Google/Chrome/Default/Cookies",
            "AppData/Local/Google/Chrome/User Data/Default/Network/Cookies",
        ]),
        ("chromium", &[
            ".config/chromium/Default/Cookies",
            ".config/chromium/Default/Network/Cookies",
            "Library/Application Support/Chromium/Default/Cookies",
        ]),
        ("firefox", &[
            ".mozilla/firefox",
            "Library/Application Support/Firefox/Profiles",
            "AppData/Roaming/Mozilla/Firefox/Profiles",
        ]),
        ("brave", &[
            ".config/BraveSoftware/Brave-Browser/Default/Cookies",
            "Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies",
            "AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Network/Cookies",
        ]),
        ("edge", &[
            ".config/microsoft-edge/Default/Cookies",
            "Library/Application Support/Microsoft Edge/Default/Cookies",
            "AppData/Local/Microsoft/Edge/User Data/Default/Network/Cookies",
        ]),
    ];

    for (browser_name, paths) in browsers {
        for path in *paths {
            let full_path = home.join(path);
            // For Firefox, just check if the profiles directory exists
            if *browser_name == "firefox" {
                if full_path.is_dir() {
                    return Some(browser_name);
                }
            } else if full_path.exists() {
                return Some(browser_name);
            }
        }
    }

    None
}

/// Validate YouTube URL
fn validate_youtube_url(url: &str) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|_| "Invalid URL format")?;

    let valid_hosts = [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtu.be",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
    ];

    let host = parsed.host_str().ok_or("No host in URL")?;

    if !valid_hosts.contains(&host) {
        return Err("Not a valid YouTube URL".to_string());
    }

    Ok(())
}

/// Build yt-dlp command with appropriate options
fn build_ytdlp_args(
    base_args: &[&str],
    deno_path: Option<&str>,
    cookies_browser: Option<&str>,
) -> Vec<String> {
    let mut args: Vec<String> = base_args.iter().map(|s| s.to_string()).collect();

    // Add Deno path if found (for JS challenge solving)
    if let Some(deno) = deno_path {
        args.push("--js-runtimes".to_string());
        args.push(format!("deno:{}", deno));
        args.push("--remote-components".to_string());
        args.push("ejs:github".to_string());
    }

    // Add cookies from browser if specified (fallback for bot detection)
    if let Some(browser) = cookies_browser {
        args.push("--cookies-from-browser".to_string());
        args.push(browser.to_string());
    }

    args
}

/// Check if error indicates bot detection
fn is_bot_detection_error(stderr: &str) -> bool {
    stderr.contains("Sign in to confirm")
        || stderr.to_lowercase().contains("bot")
        || stderr.contains("This helps protect our community")
}

/// Run yt-dlp command with given arguments
async fn run_ytdlp(ytdlp: &str, args: &[String]) -> std::io::Result<std::process::Output> {
    Command::new(ytdlp).args(args).output().await
}

/// Download audio from YouTube
#[tauri::command]
async fn download_youtube(youtube_url: String) -> Result<DownloadResponse, String> {
    // Validate URL
    validate_youtube_url(&youtube_url)?;

    // Find yt-dlp
    let ytdlp = find_ytdlp().ok_or("yt-dlp not found. Install with: pip install -U yt-dlp")?;
    let deno_path = find_deno();
    let cookies_browser = find_browser_for_cookies();

    if deno_path.is_none() && cookies_browser.is_none() {
        log::warn!("Neither Deno nor browser cookies found - YouTube may block downloads");
    }

    // Generate unique ID
    let song_id = Uuid::new_v4().to_string();
    let audio_dir = get_audio_dir()?;
    let output_path = audio_dir.join(format!("{}.mp3", song_id));

    log::info!("Fetching metadata for: {}", youtube_url);

    // Try to get metadata - first with Deno only, then with cookies fallback
    let metadata_base_args = vec!["--dump-json", "--no-download", youtube_url.as_str()];

    // First attempt: Deno only (if available)
    let metadata_args = build_ytdlp_args(&metadata_base_args, deno_path.as_deref(), None);
    log::info!("Trying metadata fetch with Deno...");

    let metadata_output = run_ytdlp(&ytdlp, &metadata_args)
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    // If bot detection, retry with cookies
    let metadata_output = if !metadata_output.status.success() {
        let stderr = String::from_utf8_lossy(&metadata_output.stderr);
        if is_bot_detection_error(&stderr) && cookies_browser.is_some() {
            log::warn!("Bot detection triggered, retrying with browser cookies...");
            let metadata_args_with_cookies = build_ytdlp_args(
                &metadata_base_args,
                deno_path.as_deref(),
                cookies_browser,
            );
            run_ytdlp(&ytdlp, &metadata_args_with_cookies)
                .await
                .map_err(|e| format!("Failed to run yt-dlp with cookies: {}", e))?
        } else {
            metadata_output
        }
    } else {
        metadata_output
    };

    if !metadata_output.status.success() {
        let stderr = String::from_utf8_lossy(&metadata_output.stderr);
        if is_bot_detection_error(&stderr) {
            let hint = if cookies_browser.is_some() {
                "Browser cookies didn't help. Try logging into YouTube in your browser and try again."
            } else {
                "Install Deno (https://deno.land) or log into YouTube in Chrome/Firefox."
            };
            return Err(format!("YouTube bot detection triggered. {}", hint));
        }
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let metadata: YtdlpMetadata = serde_json::from_slice(&metadata_output.stdout)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;

    log::info!("Title: {}", metadata.title.as_deref().unwrap_or("Unknown"));

    // Download audio - use same strategy (Deno first, cookies fallback)
    log::info!("Downloading audio...");

    let download_base_args: Vec<&str> = vec![
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--no-playlist",
        "--max-filesize", "50m",
        "-o", output_path.to_str().unwrap(),
        &youtube_url,
    ];

    // First attempt: Deno only
    let download_args = build_ytdlp_args(&download_base_args, deno_path.as_deref(), None);

    let download_output = run_ytdlp(&ytdlp, &download_args)
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    // If bot detection, retry with cookies
    let download_output = if !download_output.status.success() {
        let stderr = String::from_utf8_lossy(&download_output.stderr);
        if is_bot_detection_error(&stderr) && cookies_browser.is_some() {
            log::warn!("Bot detection on download, retrying with browser cookies...");
            let download_args_with_cookies = build_ytdlp_args(
                &download_base_args,
                deno_path.as_deref(),
                cookies_browser,
            );
            run_ytdlp(&ytdlp, &download_args_with_cookies)
                .await
                .map_err(|e| format!("Failed to download with cookies: {}", e))?
        } else {
            download_output
        }
    } else {
        download_output
    };

    if !download_output.status.success() {
        let stderr = String::from_utf8_lossy(&download_output.stderr);
        return Err(format!("Download failed: {}", stderr));
    }

    // Check file exists and get size
    let file_size = std::fs::metadata(&output_path)
        .map_err(|_| "Downloaded file not found")?
        .len();

    log::info!("Download complete: {:.2} MB", file_size as f64 / 1024.0 / 1024.0);

    Ok(DownloadResponse {
        id: song_id.clone(),
        title: metadata.title.unwrap_or_else(|| "Unknown".to_string()),
        artist: metadata.uploader
            .or(metadata.channel)
            .unwrap_or_else(|| "Unknown".to_string()),
        duration: metadata.duration.unwrap_or(0.0),
        thumbnail: metadata.thumbnail.unwrap_or_default(),
        download_url: format!("autostepper://audio/{}", song_id),
        file_size,
    })
}

/// Get audio file path for serving
#[tauri::command]
fn get_audio_path(song_id: String) -> Result<String, String> {
    let audio_dir = get_audio_dir()?;
    let path = audio_dir.join(format!("{}.mp3", song_id));

    if !path.exists() {
        return Err("Audio file not found".to_string());
    }

    Ok(path.to_string_lossy().to_string())
}

/// Read audio file as bytes
#[tauri::command]
fn read_audio_file(song_id: String) -> Result<Vec<u8>, String> {
    let audio_dir = get_audio_dir()?;
    let path = audio_dir.join(format!("{}.mp3", song_id));

    std::fs::read(&path)
        .map_err(|e| format!("Failed to read audio file: {}", e))
}

/// Read audio file as base64 (more efficient for IPC than byte array)
#[tauri::command]
fn read_audio_file_base64(song_id: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let audio_dir = get_audio_dir()?;
    let path = audio_dir.join(format!("{}.mp3", song_id));

    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read audio file: {}", e))?;

    Ok(STANDARD.encode(&bytes))
}

/// Check if required tools are available
#[tauri::command]
fn check_dependencies() -> serde_json::Value {
    let ytdlp = find_ytdlp();
    let deno = find_deno();
    let browser = find_browser_for_cookies();

    // Check ffmpeg
    let ffmpeg = std::process::Command::new("ffmpeg")
        .arg("-version")
        .output()
        .is_ok();

    serde_json::json!({
        "ytdlp": ytdlp.is_some(),
        "ytdlp_path": ytdlp,
        "deno": deno.is_some(),
        "deno_path": deno,
        "ffmpeg": ffmpeg,
        "cookies_browser": browser
    })
}

/// Cleanup all downloaded audio files
#[tauri::command]
fn cleanup_audio() -> Result<u32, String> {
    let audio_dir = get_audio_dir()?;
    let mut count = 0;

    if let Ok(entries) = std::fs::read_dir(&audio_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "mp3").unwrap_or(false) {
                if std::fs::remove_file(entry.path()).is_ok() {
                    count += 1;
                }
            }
        }
    }

    Ok(count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .invoke_handler(tauri::generate_handler![
            download_youtube,
            get_audio_path,
            read_audio_file,
            read_audio_file_base64,
            check_dependencies,
            cleanup_audio,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
