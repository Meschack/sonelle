use tauri::{AppHandle, Manager};

use crate::audio::{
    audio_cache_summary_for_book, clear_audio_cache_for_book, prepare_narration,
    speak_prepared_narration, stop_narration, AudioCacheStats, PreparedSentenceAudio,
    SentenceAudioRequest,
};
use crate::library_import::prepare_epub_import;
use crate::narration_engine_pack::{
    engine_status, install_engine, NarrationEngineInstallationStatus,
};
use crate::narration_manifest::{
    cancel_manifest_narration as cancel_manifest_narration_request, clear_manifest_cache,
    manifest_cache_summary, prepare_manifest_narration as prepare_manifest_narration_asset,
    ManifestNarrationRequest, PreparedManifestNarration,
};

#[tauri::command]
pub fn cancel_manifest_narration(request_id: String) {
    cancel_manifest_narration_request(request_id);
}
use crate::storage::{
    BookExportView, BookmarkView, LibraryBookView, LibrarySearchRequest, LibrarySearchResultView,
    ReaderDocumentView, RecordDomainEventRequest, SaveBookmarkRequest, SaveReadingPositionRequest,
    SonelleStore,
};
use crate::system_fonts::list_system_font_families;
use crate::voice_installation::{install_voice, voice_status, NarrationVoiceInstallationStatus};

#[tauri::command]
pub async fn import_epub(app: AppHandle, path: String) -> Result<ReaderDocumentView, String> {
    let store = managed_store(&app);
    run_blocking(move || {
        let imported = prepare_epub_import(path.as_ref()).map_err(|error| error.to_string())?;
        store.save_imported_book(imported)
    })
    .await
}

#[tauri::command]
pub async fn list_books(app: AppHandle) -> Result<Vec<LibraryBookView>, String> {
    let store = managed_store(&app);
    run_blocking(move || store.list_books()).await
}

#[tauri::command]
pub async fn open_book(
    app: AppHandle,
    book_id: String,
    chapter_id: Option<String>,
) -> Result<ReaderDocumentView, String> {
    let store = managed_store(&app);
    run_blocking(move || store.open_book(&book_id, chapter_id.as_deref())).await
}

#[tauri::command]
pub async fn prepare_sentence_audio(
    app: AppHandle,
    request: SentenceAudioRequest,
) -> Result<PreparedSentenceAudio, String> {
    run_blocking(move || prepare_narration(&app, request)).await
}

#[tauri::command]
pub async fn prepare_manifest_narration(
    app: AppHandle,
    request: ManifestNarrationRequest,
) -> Result<PreparedManifestNarration, String> {
    run_blocking(move || prepare_manifest_narration_asset(&app, request)).await
}

#[tauri::command]
pub async fn play_sentence_audio(
    app: AppHandle,
    request: SentenceAudioRequest,
) -> Result<(), String> {
    run_blocking(move || speak_prepared_narration(&app, request)).await
}

#[tauri::command]
pub fn stop_sentence_audio() -> Result<(), String> {
    stop_narration()
}

#[tauri::command]
pub async fn get_narration_voice_status(
    app: AppHandle,
    voice_id: String,
) -> Result<NarrationVoiceInstallationStatus, String> {
    run_blocking(move || voice_status(&app, &voice_id)).await
}

#[tauri::command]
pub async fn install_narration_voice(
    app: AppHandle,
    voice_id: String,
) -> Result<NarrationVoiceInstallationStatus, String> {
    run_blocking(move || install_voice(&app, &voice_id)).await
}

#[tauri::command]
pub async fn get_narration_engine_status(
    app: AppHandle,
    engine_id: String,
) -> Result<NarrationEngineInstallationStatus, String> {
    run_blocking(move || engine_status(&app, &engine_id)).await
}

#[tauri::command]
pub async fn install_narration_engine(
    app: AppHandle,
    engine_id: String,
) -> Result<NarrationEngineInstallationStatus, String> {
    run_blocking(move || install_engine(&app, &engine_id)).await
}

#[tauri::command]
pub async fn get_audio_cache_stats(
    app: AppHandle,
    book_id: String,
) -> Result<AudioCacheStats, String> {
    run_blocking(move || book_audio_cache_summary(&app, &book_id)).await
}

#[tauri::command]
pub async fn clear_prepared_audio_cache(
    app: AppHandle,
    book_id: String,
) -> Result<AudioCacheStats, String> {
    run_blocking(move || {
        clear_audio_cache_for_book(&app, &book_id)?;
        clear_manifest_cache(&app, &book_id)?;
        book_audio_cache_summary(&app, &book_id)
    })
    .await
}

fn book_audio_cache_summary(app: &AppHandle, book_id: &str) -> Result<AudioCacheStats, String> {
    let legacy = audio_cache_summary_for_book(app, book_id)?;
    let manifest = manifest_cache_summary(app, book_id)?;
    Ok(AudioCacheStats {
        sentence_count: legacy.sentence_count + manifest.covered_sentence_count,
        size_bytes: legacy.size_bytes + manifest.size_bytes,
    })
}

#[tauri::command]
pub fn report_development_error(scope: String, message: String) {
    #[cfg(debug_assertions)]
    eprintln!("{}", format_development_error_line(&scope, &message));

    #[cfg(not(debug_assertions))]
    let _ = (scope, message);
}

#[tauri::command]
pub async fn save_reading_position(
    app: AppHandle,
    position: SaveReadingPositionRequest,
) -> Result<(), String> {
    let store = managed_store(&app);
    run_blocking(move || store.save_reading_position(position)).await
}

#[tauri::command]
pub async fn record_domain_event(
    app: AppHandle,
    event: RecordDomainEventRequest,
) -> Result<(), String> {
    let store = managed_store(&app);
    run_blocking(move || store.record_domain_event(event)).await
}

#[tauri::command]
pub async fn list_bookmarks(
    app: AppHandle,
    book_id: Option<String>,
) -> Result<Vec<BookmarkView>, String> {
    let store = managed_store(&app);
    run_blocking(move || store.list_bookmarks(book_id.as_deref())).await
}

#[tauri::command]
pub async fn save_bookmark(
    app: AppHandle,
    bookmark: SaveBookmarkRequest,
) -> Result<BookmarkView, String> {
    let store = managed_store(&app);
    run_blocking(move || store.save_bookmark(bookmark)).await
}

#[tauri::command]
pub async fn delete_bookmark(app: AppHandle, bookmark_id: String) -> Result<(), String> {
    let store = managed_store(&app);
    run_blocking(move || store.delete_bookmark(&bookmark_id)).await
}

#[tauri::command]
pub async fn search_library(
    app: AppHandle,
    request: LibrarySearchRequest,
) -> Result<Vec<LibrarySearchResultView>, String> {
    let store = managed_store(&app);
    run_blocking(move || store.search_library(request)).await
}

#[tauri::command]
pub async fn export_book_data(app: AppHandle, book_id: String) -> Result<BookExportView, String> {
    let store = managed_store(&app);
    run_blocking(move || store.export_book_data(&book_id)).await
}

#[tauri::command]
pub async fn list_system_fonts() -> Result<Vec<String>, String> {
    run_blocking(list_system_font_families).await
}

fn managed_store(app: &AppHandle) -> SonelleStore {
    app.state::<SonelleStore>().inner().clone()
}

#[cfg(any(debug_assertions, test))]
fn format_development_error_line(scope: &str, message: &str) -> String {
    let scope = sanitize_development_log_field(scope, 64);
    let message = sanitize_development_log_field(message, 600);
    let scope = if scope.is_empty() { "app" } else { &scope };
    let message = if message.is_empty() {
        "Unknown renderer error."
    } else {
        &message
    };

    format!("[sonelle][webview][{scope}] {message}")
}

#[cfg(any(debug_assertions, test))]
fn sanitize_development_log_field(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .take(max_chars)
        .collect::<String>()
        .trim()
        .to_string()
}

async fn run_blocking<T, F>(operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(operation).await {
        Ok(result) => result,
        Err(error) => {
            log_native_issue("blocking", &error.to_string());
            Err("Local work stopped unexpectedly. Please try again.".to_string())
        }
    }
}

fn log_native_issue(scope: &str, detail: &str) {
    #[cfg(debug_assertions)]
    eprintln!("[sonelle][native][{scope}] {detail}");

    #[cfg(not(debug_assertions))]
    let _ = (scope, detail);
}

#[cfg(test)]
mod tests {
    use super::format_development_error_line;

    #[test]
    fn development_errors_are_single_line_and_bounded() {
        let line = format_development_error_line(
            "audio.playback\nspoofed",
            &format!("Voice failed\n{}", "x".repeat(1_000)),
        );

        assert!(line.starts_with("[sonelle][webview][audio.playback spoofed] Voice failed "));
        assert!(!line.contains('\n'));
        assert!(line.chars().count() < 720);
    }
}
