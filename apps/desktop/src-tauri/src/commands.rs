use tauri::AppHandle;

use crate::audio::{
    prepare_narration, speak_prepared_narration, stop_narration, PreparedSentenceAudio,
    SentenceAudioRequest,
};
use crate::epub_import::import_epub_file;
use crate::storage::{
    LibraryBookView, ReaderDocumentView, ReadexStore, SaveReadingPositionRequest,
};

#[tauri::command]
pub fn import_epub(app: AppHandle, path: String) -> Result<ReaderDocumentView, String> {
    let imported = import_epub_file(path.as_ref()).map_err(|error| error.to_string())?;
    ReadexStore::open(&app)?.save_imported_book(imported)
}

#[tauri::command]
pub fn list_books(app: AppHandle) -> Result<Vec<LibraryBookView>, String> {
    ReadexStore::open(&app)?.list_books()
}

#[tauri::command]
pub fn open_book(app: AppHandle, book_id: String) -> Result<ReaderDocumentView, String> {
    ReadexStore::open(&app)?.open_book(&book_id)
}

#[tauri::command]
pub fn prepare_sentence_audio(
    app: AppHandle,
    request: SentenceAudioRequest,
) -> Result<PreparedSentenceAudio, String> {
    prepare_narration(&app, request)
}

#[tauri::command]
pub fn play_sentence_audio(app: AppHandle, request: SentenceAudioRequest) -> Result<(), String> {
    speak_prepared_narration(&app, request)
}

#[tauri::command]
pub fn stop_sentence_audio() -> Result<(), String> {
    stop_narration()
}

#[tauri::command]
pub fn save_reading_position(
    app: AppHandle,
    position: SaveReadingPositionRequest,
) -> Result<(), String> {
    ReadexStore::open(&app)?.save_reading_position(position)
}
