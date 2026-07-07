use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SentenceAudioRequest {
    pub book_id: String,
    pub chapter_id: String,
    pub sentence_id: String,
    pub sentence_index: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedSentenceAudio {
    pub book_id: String,
    pub chapter_id: String,
    pub sentence_id: String,
    pub readiness: String,
    pub duration_sec: Option<f64>,
    pub source_url: Option<String>,
    pub playback_mode: String,
    pub cached: bool,
    pub message: Option<String>,
}

trait SpeechAdapter {
    fn prepare(
        &self,
        request: &SentenceAudioRequest,
        cache: &SentenceAudioCache,
    ) -> Result<AdapterOutput, String>;
}

struct AdapterOutput {
    readiness: &'static str,
    playback_mode: &'static str,
    source_url: Option<String>,
    cached: bool,
    message: Option<String>,
}

struct SentenceAudioCache {
    dir: PathBuf,
    audio_path: PathBuf,
    speech_text_path: PathBuf,
}

pub fn prepare_narration(
    app: &AppHandle,
    request: SentenceAudioRequest,
) -> Result<PreparedSentenceAudio, String> {
    let cache = SentenceAudioCache::open(app, &request)?;
    let adapter = LocalSpeechAdapter;
    let output = adapter.prepare(&request, &cache)?;

    Ok(PreparedSentenceAudio {
        book_id: request.book_id,
        chapter_id: request.chapter_id,
        sentence_id: request.sentence_id,
        readiness: output.readiness.to_string(),
        duration_sec: Some(estimate_duration_sec(&request.text)),
        source_url: output.source_url,
        playback_mode: output.playback_mode.to_string(),
        cached: output.cached,
        message: output.message,
    })
}

pub fn speak_prepared_narration(
    app: &AppHandle,
    request: SentenceAudioRequest,
) -> Result<(), String> {
    let cache = SentenceAudioCache::open(app, &request)?;
    let text = fs::read_to_string(&cache.speech_text_path).unwrap_or(request.text);

    if !command_exists("spd-say") {
        return Err("Install a local speech voice to listen offline.".to_string());
    }

    let status = Command::new("spd-say")
        .arg("--wait")
        .arg(text)
        .status()
        .map_err(|_| "We couldn't start local narration.".to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Local narration needs attention. Please try another voice.".to_string())
    }
}

pub fn stop_narration() -> Result<(), String> {
    if command_exists("spd-say") {
        Command::new("spd-say")
            .arg("--stop")
            .status()
            .map_err(|_| "We couldn't stop narration.".to_string())?;
    }

    Ok(())
}

struct LocalSpeechAdapter;

impl SpeechAdapter for LocalSpeechAdapter {
    fn prepare(
        &self,
        request: &SentenceAudioRequest,
        cache: &SentenceAudioCache,
    ) -> Result<AdapterOutput, String> {
        if cache.audio_path.exists() {
            return Ok(AdapterOutput {
                readiness: "ready",
                playback_mode: "html-audio",
                source_url: Some(wav_data_url(&cache.audio_path)?),
                cached: true,
                message: None,
            });
        }

        if cache.speech_text_path.exists() && command_exists("spd-say") {
            return Ok(AdapterOutput {
                readiness: "ready",
                playback_mode: "native-speech",
                source_url: None,
                cached: true,
                message: None,
            });
        }

        fs::create_dir_all(&cache.dir)
            .map_err(|_| "We couldn't prepare local narration.".to_string())?;

        if synthesize_wav(&request.text, &cache.audio_path)? {
            return Ok(AdapterOutput {
                readiness: "ready",
                playback_mode: "html-audio",
                source_url: Some(wav_data_url(&cache.audio_path)?),
                cached: false,
                message: None,
            });
        }

        if command_exists("spd-say") {
            fs::write(&cache.speech_text_path, &request.text)
                .map_err(|_| "We couldn't prepare local narration.".to_string())?;
            return Ok(AdapterOutput {
                readiness: "ready",
                playback_mode: "native-speech",
                source_url: None,
                cached: false,
                message: None,
            });
        }

        Ok(AdapterOutput {
            readiness: "needs-attention",
            playback_mode: "native-speech",
            source_url: None,
            cached: false,
            message: Some("Install a local speech voice to listen offline.".to_string()),
        })
    }
}

#[cfg(test)]
pub struct FakeSpeechAdapter;

#[cfg(test)]
impl SpeechAdapter for FakeSpeechAdapter {
    fn prepare(
        &self,
        request: &SentenceAudioRequest,
        cache: &SentenceAudioCache,
    ) -> Result<AdapterOutput, String> {
        let cached = cache.audio_path.exists();
        fs::create_dir_all(&cache.dir)
            .map_err(|_| "We couldn't prepare local narration.".to_string())?;

        if !cached {
            fs::write(&cache.audio_path, fake_wav_bytes(&request.text))
                .map_err(|_| "We couldn't prepare local narration.".to_string())?;
        }

        Ok(AdapterOutput {
            readiness: "ready",
            playback_mode: "html-audio",
            source_url: Some(wav_data_url(&cache.audio_path)?),
            cached,
            message: None,
        })
    }
}

impl SentenceAudioCache {
    fn open(app: &AppHandle, request: &SentenceAudioRequest) -> Result<Self, String> {
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|_| "We couldn't open the local library folder.".to_string())?;
        Ok(Self::for_root(app_dir.join("audio"), request))
    }

    #[cfg(test)]
    fn for_root(root: PathBuf, request: &SentenceAudioRequest) -> Self {
        let key = cache_key(request);
        let dir = root.join(&key);
        Self {
            audio_path: dir.join("sentence.wav"),
            speech_text_path: dir.join("sentence.txt"),
            dir,
        }
    }
}

#[cfg(not(test))]
impl SentenceAudioCache {
    fn for_root(root: PathBuf, request: &SentenceAudioRequest) -> Self {
        let key = cache_key(request);
        let dir = root.join(&key);
        Self {
            audio_path: dir.join("sentence.wav"),
            speech_text_path: dir.join("sentence.txt"),
            dir,
        }
    }
}

fn synthesize_wav(text: &str, output: &Path) -> Result<bool, String> {
    let output_path = output.to_string_lossy().to_string();
    let commands: [(&str, Vec<String>); 3] = [
        (
            "espeak-ng",
            vec!["-w".to_string(), output_path.clone(), text.to_string()],
        ),
        (
            "espeak",
            vec!["-w".to_string(), output_path.clone(), text.to_string()],
        ),
        (
            "pico2wave",
            vec!["-w".to_string(), output_path, text.to_string()],
        ),
    ];

    for (command, args) in commands {
        if !command_exists(command) {
            continue;
        }

        let status = Command::new(command)
            .args(args)
            .status()
            .map_err(|_| "We couldn't prepare local narration.".to_string())?;

        if status.success() && output.exists() {
            return Ok(true);
        }
    }

    Ok(false)
}

fn wav_data_url(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|_| "We couldn't load prepared narration.".to_string())?;
    Ok(format!("data:audio/wav;base64,{}", STANDARD.encode(bytes)))
}

fn command_exists(command: &str) -> bool {
    let Some(path) = env::var_os("PATH") else {
        return false;
    };

    env::split_paths(&path).any(|dir| dir.join(command).exists())
}

fn cache_key(request: &SentenceAudioRequest) -> String {
    let mut hasher = Sha256::new();
    hasher.update(request.book_id.as_bytes());
    hasher.update(request.chapter_id.as_bytes());
    hasher.update(request.sentence_id.as_bytes());
    hasher.update(request.text.as_bytes());
    hex_prefix(&hasher.finalize(), 32)
}

fn estimate_duration_sec(text: &str) -> f64 {
    let word_count = text
        .split_whitespace()
        .filter(|word| !word.is_empty())
        .count() as f64;
    (word_count * 0.34 + 0.5).clamp(1.1, 12.0)
}

fn hex_prefix(bytes: &[u8], length: usize) -> String {
    bytes
        .iter()
        .flat_map(|byte| [byte >> 4, byte & 0x0f])
        .take(length)
        .map(|nibble| char::from_digit(nibble.into(), 16).unwrap_or('0'))
        .collect()
}

#[cfg(test)]
fn fake_wav_bytes(text: &str) -> Vec<u8> {
    let samples = (estimate_duration_sec(text) * 8000.0) as usize;
    let mut data = Vec::with_capacity(44 + samples);
    let data_len = samples as u32;
    let riff_len = 36 + data_len;

    data.extend_from_slice(b"RIFF");
    data.extend_from_slice(&riff_len.to_le_bytes());
    data.extend_from_slice(b"WAVEfmt ");
    data.extend_from_slice(&16u32.to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes());
    data.extend_from_slice(&8000u32.to_le_bytes());
    data.extend_from_slice(&8000u32.to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes());
    data.extend_from_slice(&8u16.to_le_bytes());
    data.extend_from_slice(b"data");
    data.extend_from_slice(&data_len.to_le_bytes());
    data.extend(std::iter::repeat(128u8).take(samples));
    data
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use chrono::Utc;

    use super::{FakeSpeechAdapter, SentenceAudioCache, SentenceAudioRequest, SpeechAdapter};

    #[test]
    fn fake_adapter_creates_and_reuses_cached_audio() {
        let request = SentenceAudioRequest {
            book_id: "book".to_string(),
            chapter_id: "chapter".to_string(),
            sentence_id: "sentence".to_string(),
            sentence_index: 0,
            text: "Hello reader.".to_string(),
        };
        let temp_dir = temp_audio_dir();
        let cache = SentenceAudioCache::for_root(temp_dir.clone(), &request);
        let adapter = FakeSpeechAdapter;

        let first = adapter
            .prepare(&request, &cache)
            .expect("audio should prepare");
        let second = adapter
            .prepare(&request, &cache)
            .expect("audio should be cached");

        assert_eq!(first.readiness, "ready");
        assert!(!first.cached);
        assert!(second.cached);
        assert!(second
            .source_url
            .expect("url should exist")
            .starts_with("data:audio/wav"));

        fs::remove_dir_all(temp_dir).ok();
    }

    fn temp_audio_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "readex-audio-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ))
    }
}
