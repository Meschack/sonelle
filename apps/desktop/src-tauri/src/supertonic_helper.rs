// Vendored from supertone-inc/supertonic at dff55dc00064c398736080c78195f577527832ae.
// License: MIT. Sonelle keeps the production wrapper in supertonic_narration.rs.
// ============================================================================
// TTS Helper Module - All utility functions and structures
// ============================================================================

use anyhow::{bail, Context, Result};
use ndarray::{Array, Array3};
use ort::ep::CPU;
use rand_distr::{Distribution, Normal};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::LazyLock;
use unicode_normalization::UnicodeNormalization;

// Available languages for multilingual TTS
const AVAILABLE_LANGS: &[&str] = &[
    "en", "ko", "ja", "ar", "bg", "cs", "da", "de", "el", "es", "et", "fi", "fr", "hi", "hr", "hu",
    "id", "it", "lt", "lv", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "uk", "vi", "na",
];

static EMOJI_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F700}-\x{1F77F}\x{1F780}-\x{1F7FF}\x{1F800}-\x{1F8FF}\x{1F900}-\x{1F9FF}\x{1FA00}-\x{1FA6F}\x{1FA70}-\x{1FAFF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{1F1E6}-\x{1F1FF}]+").expect("emoji regex should compile")
});
static WHITESPACE_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+").expect("whitespace regex should compile"));
static END_PUNCTUATION_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"[.!?;:,'"\u{201C}\u{201D}\u{2018}\u{2019})\]}…。」』】〉》›»]$"#)
        .expect("ending punctuation regex should compile")
});
static PARAGRAPH_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\n\s*\n").expect("paragraph regex should compile"));
static SENTENCE_BOUNDARY_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([.!?])\s+").expect("sentence regex should compile"));

pub(super) fn is_valid_lang(lang: &str) -> bool {
    AVAILABLE_LANGS.contains(&lang)
}

// ============================================================================
// Configuration Structures
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Config {
    pub ae: AEConfig,
    pub ttl: TTLConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AEConfig {
    pub sample_rate: i32,
    pub base_chunk_size: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TTLConfig {
    pub chunk_compress_factor: i32,
    pub latent_dim: i32,
}

/// Load configuration from JSON file
fn load_cfgs<P: AsRef<Path>>(onnx_dir: P) -> Result<Config> {
    let cfg_path = onnx_dir.as_ref().join("tts.json");
    let file = File::open(cfg_path)?;
    let reader = BufReader::new(file);
    let cfgs: Config = serde_json::from_reader(reader)?;
    Ok(cfgs)
}

// ============================================================================
// Voice Style Data Structure
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VoiceStyleData {
    pub style_ttl: StyleComponent,
    pub style_dp: StyleComponent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StyleComponent {
    pub data: Vec<Vec<Vec<f32>>>,
    pub dims: Vec<usize>,
    #[serde(rename = "type")]
    pub dtype: String,
}

// ============================================================================
// Unicode Text Processor
// ============================================================================

struct UnicodeProcessor {
    indexer: Vec<i64>,
}

impl UnicodeProcessor {
    fn new<P: AsRef<Path>>(unicode_indexer_json_path: P) -> Result<Self> {
        let file = File::open(unicode_indexer_json_path)?;
        let reader = BufReader::new(file);
        let indexer: Vec<i64> = serde_json::from_reader(reader)?;
        Ok(UnicodeProcessor { indexer })
    }

    fn call(
        &self,
        text_list: &[String],
        lang_list: &[String],
    ) -> Result<(Vec<Vec<i64>>, Array3<f32>)> {
        let mut processed_texts: Vec<String> = Vec::new();
        for (text, lang) in text_list.iter().zip(lang_list.iter()) {
            processed_texts.push(preprocess_text(text, lang)?);
        }

        let text_ids_lengths: Vec<usize> =
            processed_texts.iter().map(|t| t.chars().count()).collect();

        let max_len = *text_ids_lengths.iter().max().unwrap_or(&0);

        let mut text_ids = Vec::new();
        for text in &processed_texts {
            let mut row = vec![0i64; max_len];
            let unicode_vals = text_to_unicode_values(text);
            for (j, &val) in unicode_vals.iter().enumerate() {
                if val < self.indexer.len() {
                    row[j] = self.indexer[val];
                } else {
                    row[j] = -1;
                }
            }
            text_ids.push(row);
        }

        let text_mask = get_text_mask(&text_ids_lengths);

        Ok((text_ids, text_mask))
    }
}

fn preprocess_text(text: &str, lang: &str) -> Result<String> {
    // TODO: Need advanced normalizer for better performance
    let mut text: String = text.nfkd().collect();

    // Remove emojis (wide Unicode range)
    text = EMOJI_PATTERN.replace_all(&text, "").to_string();

    // Replace various dashes and symbols
    let replacements = [
        ("–", "-"),         // en dash
        ("‑", "-"),         // non-breaking hyphen
        ("—", "-"),         // em dash
        ("_", " "),         // underscore
        ("\u{201C}", "\""), // left double quote
        ("\u{201D}", "\""), // right double quote
        ("\u{2018}", "'"),  // left single quote
        ("\u{2019}", "'"),  // right single quote
        ("´", "'"),         // acute accent
        ("`", "'"),         // grave accent
        ("[", " "),         // left bracket
        ("]", " "),         // right bracket
        ("|", " "),         // vertical bar
        ("/", " "),         // slash
        ("#", " "),         // hash
        ("→", " "),         // right arrow
        ("←", " "),         // left arrow
    ];

    for (from, to) in &replacements {
        text = text.replace(from, to);
    }

    // Remove special symbols
    let special_symbols = ["♥", "☆", "♡", "©", "\\"];
    for symbol in &special_symbols {
        text = text.replace(symbol, "");
    }

    // Replace known expressions
    let expr_replacements = [
        ("@", " at "),
        ("e.g.,", "for example, "),
        ("i.e.,", "that is, "),
    ];

    for (from, to) in &expr_replacements {
        text = text.replace(from, to);
    }

    // Fix spacing around punctuation
    for (spaced, compact) in [
        (" ,", ","),
        (" .", "."),
        (" !", "!"),
        (" ?", "?"),
        (" ;", ";"),
        (" :", ":"),
        (" '", "'"),
    ] {
        text = text.replace(spaced, compact);
    }

    // Remove duplicate quotes
    while text.contains("\"\"") {
        text = text.replace("\"\"", "\"");
    }
    while text.contains("''") {
        text = text.replace("''", "'");
    }
    while text.contains("``") {
        text = text.replace("``", "`");
    }

    // Remove extra spaces
    text = WHITESPACE_PATTERN.replace_all(&text, " ").to_string();
    text = text.trim().to_string();

    // If text doesn't end with punctuation, quotes, or closing brackets, add a period
    if !text.is_empty() && !END_PUNCTUATION_PATTERN.is_match(&text) {
        text.push('.');
    }

    // Validate language
    if !is_valid_lang(lang) {
        bail!(
            "Invalid language: {}. Available: {:?}",
            lang,
            AVAILABLE_LANGS
        );
    }

    // Wrap text with language tags
    text = format!("<{}>{}</{}>", lang, text, lang);

    Ok(text)
}

fn text_to_unicode_values(text: &str) -> Vec<usize> {
    text.chars().map(|c| c as usize).collect()
}

fn length_to_mask(lengths: &[usize], max_len: Option<usize>) -> Array3<f32> {
    let bsz = lengths.len();
    let max_len = max_len.unwrap_or_else(|| *lengths.iter().max().unwrap_or(&0));

    let mut mask = Array3::<f32>::zeros((bsz, 1, max_len));
    for (i, &len) in lengths.iter().enumerate() {
        for j in 0..len.min(max_len) {
            mask[[i, 0, j]] = 1.0;
        }
    }
    mask
}

fn get_text_mask(text_ids_lengths: &[usize]) -> Array3<f32> {
    let max_len = *text_ids_lengths.iter().max().unwrap_or(&0);
    length_to_mask(text_ids_lengths, Some(max_len))
}

/// Sample noisy latent from normal distribution and apply mask
fn sample_noisy_latent(
    duration: &[f32],
    sample_rate: i32,
    base_chunk_size: i32,
    chunk_compress: i32,
    latent_dim: i32,
) -> (Array3<f32>, Array3<f32>) {
    let bsz = duration.len();
    let max_dur = duration.iter().fold(0.0f32, |a, &b| a.max(b));

    let wav_len_max = (max_dur * sample_rate as f32) as usize;
    let wav_lengths: Vec<usize> = duration
        .iter()
        .map(|&d| (d * sample_rate as f32) as usize)
        .collect();

    let chunk_size = (base_chunk_size * chunk_compress) as usize;
    let latent_len = wav_len_max.div_ceil(chunk_size);
    let latent_dim_val = (latent_dim * chunk_compress) as usize;

    let mut noisy_latent = Array3::<f32>::zeros((bsz, latent_dim_val, latent_len));

    let normal = Normal::new(0.0, 1.0).unwrap();
    let mut rng = rand::thread_rng();

    for b in 0..bsz {
        for d in 0..latent_dim_val {
            for t in 0..latent_len {
                noisy_latent[[b, d, t]] = normal.sample(&mut rng);
            }
        }
    }

    let latent_lengths: Vec<usize> = wav_lengths
        .iter()
        .map(|&len| len.div_ceil(chunk_size))
        .collect();

    let latent_mask = length_to_mask(&latent_lengths, Some(latent_len));

    // Apply mask
    for b in 0..bsz {
        for d in 0..latent_dim_val {
            for t in 0..latent_len {
                noisy_latent[[b, d, t]] *= latent_mask[[b, 0, t]];
            }
        }
    }

    (noisy_latent, latent_mask)
}

// ============================================================================
// Text Chunking
// ============================================================================

const MAX_CHUNK_LENGTH: usize = 300;

const ABBREVIATIONS: &[&str] = &[
    "Dr.", "Mr.", "Mrs.", "Ms.", "Prof.", "Sr.", "Jr.", "St.", "Ave.", "Rd.", "Blvd.", "Dept.",
    "Inc.", "Ltd.", "Co.", "Corp.", "etc.", "vs.", "i.e.", "e.g.", "Ph.D.",
];

fn chunk_text(text: &str, max_len: Option<usize>) -> Vec<String> {
    let max_len = max_len.unwrap_or(MAX_CHUNK_LENGTH);
    let text = text.trim();

    if text.is_empty() {
        return vec![String::new()];
    }

    // Split by paragraphs
    let paragraphs: Vec<&str> = PARAGRAPH_PATTERN.split(text).collect();
    let mut chunks = Vec::new();

    for para in paragraphs {
        let para = para.trim();
        if para.is_empty() {
            continue;
        }

        if para.len() <= max_len {
            chunks.push(para.to_string());
            continue;
        }

        // Split by sentences
        let sentences = split_sentences(para);
        let mut current = String::new();
        let mut current_len = 0;

        for sentence in sentences {
            let sentence = sentence.trim();
            if sentence.is_empty() {
                continue;
            }

            let sentence_len = sentence.len();
            if sentence_len > max_len {
                // If sentence is longer than max_len, split by comma or space
                if !current.is_empty() {
                    chunks.push(current.trim().to_string());
                    current.clear();
                    current_len = 0;
                }

                // Try splitting by comma
                let parts: Vec<&str> = sentence.split(',').collect();
                for part in parts {
                    let part = part.trim();
                    if part.is_empty() {
                        continue;
                    }

                    let part_len = part.len();
                    if part_len > max_len {
                        if !current.is_empty() {
                            chunks.push(current.trim().to_string());
                            current.clear();
                            current_len = 0;
                        }

                        // Split by space as last resort
                        let words: Vec<&str> = part.split_whitespace().collect();
                        let mut word_chunk = String::new();
                        let mut word_chunk_len = 0;

                        for word in words {
                            let word_len = word.len();
                            if word_chunk_len + word_len + 1 > max_len && !word_chunk.is_empty() {
                                chunks.push(word_chunk.trim().to_string());
                                word_chunk.clear();
                                word_chunk_len = 0;
                            }

                            if !word_chunk.is_empty() {
                                word_chunk.push(' ');
                                word_chunk_len += 1;
                            }
                            word_chunk.push_str(word);
                            word_chunk_len += word_len;
                        }

                        if !word_chunk.is_empty() {
                            chunks.push(word_chunk.trim().to_string());
                        }
                    } else {
                        if current_len + part_len + 1 > max_len && !current.is_empty() {
                            chunks.push(current.trim().to_string());
                            current.clear();
                            current_len = 0;
                        }

                        if !current.is_empty() {
                            current.push_str(", ");
                            current_len += 2;
                        }
                        current.push_str(part);
                        current_len += part_len;
                    }
                }
                continue;
            }

            if current_len + sentence_len + 1 > max_len && !current.is_empty() {
                chunks.push(current.trim().to_string());
                current.clear();
                current_len = 0;
            }

            if !current.is_empty() {
                current.push(' ');
                current_len += 1;
            }
            current.push_str(sentence);
            current_len += sentence_len;
        }

        if !current.is_empty() {
            chunks.push(current.trim().to_string());
        }
    }

    if chunks.is_empty() {
        vec![String::new()]
    } else {
        chunks
    }
}

fn split_sentences(text: &str) -> Vec<String> {
    // Rust's regex doesn't support lookbehind, so we use a simpler approach
    // Split on sentence boundaries and then check if they're abbreviations
    // Find all matches
    let matches: Vec<_> = SENTENCE_BOUNDARY_PATTERN.find_iter(text).collect();
    if matches.is_empty() {
        return vec![text.to_string()];
    }

    let mut sentences = Vec::new();
    let mut last_end = 0;

    for m in matches {
        // Get the text before the punctuation
        let before_punc = &text[last_end..m.start()];

        // Check if this ends with an abbreviation
        let mut is_abbrev = false;
        for abbrev in ABBREVIATIONS {
            let combined = format!("{}{}", before_punc.trim(), &text[m.start()..m.start() + 1]);
            if combined.ends_with(abbrev) {
                is_abbrev = true;
                break;
            }
        }

        if !is_abbrev {
            // This is a real sentence boundary
            sentences.push(text[last_end..m.end()].to_string());
            last_end = m.end();
        }
    }

    // Add the remaining text
    if last_end < text.len() {
        sentences.push(text[last_end..].to_string());
    }

    if sentences.is_empty() {
        vec![text.to_string()]
    } else {
        sentences
    }
}

// ============================================================================
// ONNX Runtime Integration
// ============================================================================

use ort::{
    session::{RunOptions, Session},
    value::Value,
};

pub(super) struct Style {
    ttl: Array3<f32>,
    dp: Array3<f32>,
}

impl Style {
    fn repeated(&self, batch_size: usize) -> Result<Self> {
        if self.ttl.dim().0 != 1 || self.dp.dim().0 != 1 {
            bail!("Supertonic voice style must contain exactly one voice");
        }

        Ok(Self {
            ttl: repeat_first_batch(&self.ttl, batch_size)?,
            dp: repeat_first_batch(&self.dp, batch_size)?,
        })
    }
}

pub(super) struct SynthesisOptions<'a> {
    pub total_step: usize,
    pub speed: f32,
    pub silence_duration: f32,
    pub run_options: &'a RunOptions,
}

pub(super) struct TextToSpeech {
    cfgs: Config,
    text_processor: UnicodeProcessor,
    dp_ort: Session,
    text_enc_ort: Session,
    vector_est_ort: Session,
    vocoder_ort: Session,
    pub(super) sample_rate: i32,
}

impl TextToSpeech {
    fn new(
        cfgs: Config,
        text_processor: UnicodeProcessor,
        dp_ort: Session,
        text_enc_ort: Session,
        vector_est_ort: Session,
        vocoder_ort: Session,
    ) -> Self {
        let sample_rate = cfgs.ae.sample_rate;
        TextToSpeech {
            cfgs,
            text_processor,
            dp_ort,
            text_enc_ort,
            vector_est_ort,
            vocoder_ort,
            sample_rate,
        }
    }

    fn _infer(
        &mut self,
        text_list: &[String],
        lang_list: &[String],
        style: &Style,
        total_step: usize,
        speed: f32,
        run_options: &RunOptions,
    ) -> Result<(Vec<f32>, Vec<f32>)> {
        let bsz = text_list.len();

        // Process text
        let (text_ids, text_mask) = self.text_processor.call(text_list, lang_list)?;

        let text_ids_array = {
            let text_ids_shape = (bsz, text_ids[0].len());
            let mut flat = Vec::new();
            for row in &text_ids {
                flat.extend_from_slice(row);
            }
            Array::from_shape_vec(text_ids_shape, flat)?
        };

        let text_ids_value = Value::from_array(text_ids_array)?;
        let text_mask_value = Value::from_array(text_mask.clone())?;
        let style_dp_value = Value::from_array(style.dp.clone())?;

        // Predict duration
        let dp_outputs = self.dp_ort.run_with_options(
            ort::inputs! {
                "text_ids" => &text_ids_value,
                "style_dp" => &style_dp_value,
                "text_mask" => &text_mask_value
            },
            run_options,
        )?;

        let (_, duration_data) = dp_outputs["duration"].try_extract_tensor::<f32>()?;
        let mut duration: Vec<f32> = duration_data.to_vec();

        // Apply speed factor to duration
        for dur in duration.iter_mut() {
            *dur /= speed;
        }

        // Encode text
        let style_ttl_value = Value::from_array(style.ttl.clone())?;
        let text_enc_outputs = self.text_enc_ort.run_with_options(
            ort::inputs! {
                "text_ids" => &text_ids_value,
                "style_ttl" => &style_ttl_value,
                "text_mask" => &text_mask_value
            },
            run_options,
        )?;

        let (text_emb_shape, text_emb_data) =
            text_enc_outputs["text_emb"].try_extract_tensor::<f32>()?;
        let text_emb = Array3::from_shape_vec(
            (
                text_emb_shape[0] as usize,
                text_emb_shape[1] as usize,
                text_emb_shape[2] as usize,
            ),
            text_emb_data.to_vec(),
        )?;

        // Sample noisy latent
        let (mut xt, latent_mask) = sample_noisy_latent(
            &duration,
            self.sample_rate,
            self.cfgs.ae.base_chunk_size,
            self.cfgs.ttl.chunk_compress_factor,
            self.cfgs.ttl.latent_dim,
        );

        // Prepare constant arrays
        let total_step_array = Array::from_elem(bsz, total_step as f32);

        // Denoising loop
        for step in 0..total_step {
            let current_step_array = Array::from_elem(bsz, step as f32);

            let xt_value = Value::from_array(xt.clone())?;
            let text_emb_value = Value::from_array(text_emb.clone())?;
            let latent_mask_value = Value::from_array(latent_mask.clone())?;
            let text_mask_value2 = Value::from_array(text_mask.clone())?;
            let current_step_value = Value::from_array(current_step_array)?;
            let total_step_value = Value::from_array(total_step_array.clone())?;

            let vector_est_outputs = self.vector_est_ort.run_with_options(
                ort::inputs! {
                    "noisy_latent" => &xt_value,
                    "text_emb" => &text_emb_value,
                    "style_ttl" => &style_ttl_value,
                    "latent_mask" => &latent_mask_value,
                    "text_mask" => &text_mask_value2,
                    "current_step" => &current_step_value,
                    "total_step" => &total_step_value
                },
                run_options,
            )?;

            let (denoised_shape, denoised_data) =
                vector_est_outputs["denoised_latent"].try_extract_tensor::<f32>()?;
            xt = Array3::from_shape_vec(
                (
                    denoised_shape[0] as usize,
                    denoised_shape[1] as usize,
                    denoised_shape[2] as usize,
                ),
                denoised_data.to_vec(),
            )?;
        }

        // Generate waveform
        let final_latent_value = Value::from_array(xt)?;
        let vocoder_outputs = self.vocoder_ort.run_with_options(
            ort::inputs! {
                "latent" => &final_latent_value
            },
            run_options,
        )?;

        let (_, wav_data) = vocoder_outputs["wav_tts"].try_extract_tensor::<f32>()?;
        let wav: Vec<f32> = wav_data.to_vec();

        Ok((wav, duration))
    }

    pub(super) fn call_with_options(
        &mut self,
        text: &str,
        lang: &str,
        style: &Style,
        options: SynthesisOptions<'_>,
    ) -> Result<(Vec<f32>, f32)> {
        let max_len = if lang == "ko" || lang == "ja" {
            120
        } else {
            300
        };
        let chunks = chunk_text(text, Some(max_len));

        let mut wav_cat: Vec<f32> = Vec::new();
        let mut dur_cat: f32 = 0.0;

        for (i, chunk) in chunks.iter().enumerate() {
            let (wav, duration) = self._infer(
                std::slice::from_ref(chunk),
                &[lang.to_string()],
                style,
                options.total_step,
                options.speed,
                options.run_options,
            )?;

            let dur = duration[0];
            let wav_len = (self.sample_rate as f32 * dur) as usize;
            let wav_chunk = &wav[..wav_len.min(wav.len())];

            if i == 0 {
                wav_cat.extend_from_slice(wav_chunk);
                dur_cat = dur;
            } else {
                let silence_len = (options.silence_duration * self.sample_rate as f32) as usize;
                let silence = vec![0.0f32; silence_len];

                wav_cat.extend_from_slice(&silence);
                wav_cat.extend_from_slice(wav_chunk);
                dur_cat += options.silence_duration + dur;
            }
        }

        Ok((wav_cat, dur_cat))
    }

    pub(super) fn batch_with_options(
        &mut self,
        texts: &[String],
        lang: &str,
        style: &Style,
        options: SynthesisOptions<'_>,
    ) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        let max_len = if lang == "ko" || lang == "ja" {
            120
        } else {
            300
        };
        let chunks = texts
            .iter()
            .map(|text| chunk_text(text, Some(max_len)))
            .collect::<Vec<_>>();

        // Long sentences need their internal pause handling, so keep the proven
        // single-sentence path for those uncommon inputs.
        if chunks
            .iter()
            .any(|sentence_chunks| sentence_chunks.len() != 1)
        {
            return texts
                .iter()
                .map(|text| {
                    self.call_with_options(
                        text,
                        lang,
                        style,
                        SynthesisOptions {
                            total_step: options.total_step,
                            speed: options.speed,
                            silence_duration: options.silence_duration,
                            run_options: options.run_options,
                        },
                    )
                    .map(|(audio, _)| audio)
                })
                .collect();
        }

        let batch_texts = chunks
            .into_iter()
            .map(|mut sentence_chunks| sentence_chunks.remove(0))
            .collect::<Vec<_>>();
        let languages = vec![lang.to_string(); batch_texts.len()];
        let batch_style = style.repeated(batch_texts.len())?;
        let (waveforms, durations) = self._infer(
            &batch_texts,
            &languages,
            &batch_style,
            options.total_step,
            options.speed,
            options.run_options,
        )?;

        split_batched_waveforms(waveforms, &durations, self.sample_rate)
    }
}

fn repeat_first_batch(source: &Array3<f32>, batch_size: usize) -> Result<Array3<f32>> {
    if batch_size == 0 {
        bail!("Supertonic synthesis batch cannot be empty");
    }
    let (_, rows, columns) = source.dim();
    let values = source
        .as_slice()
        .context("Supertonic voice style is not contiguous")?;
    let mut repeated = Vec::with_capacity(values.len() * batch_size);
    for _ in 0..batch_size {
        repeated.extend_from_slice(values);
    }
    Ok(Array3::from_shape_vec(
        (batch_size, rows, columns),
        repeated,
    )?)
}

fn split_batched_waveforms(
    waveforms: Vec<f32>,
    durations: &[f32],
    sample_rate: i32,
) -> Result<Vec<Vec<f32>>> {
    if durations.is_empty() || !waveforms.len().is_multiple_of(durations.len()) {
        bail!("Supertonic returned an invalid synthesis batch");
    }
    let stride = waveforms.len() / durations.len();
    Ok(durations
        .iter()
        .enumerate()
        .map(|(index, duration)| {
            let start = index * stride;
            let sample_count = (sample_rate as f32 * duration).max(0.0) as usize;
            waveforms[start..start + sample_count.min(stride)].to_vec()
        })
        .collect())
}

// ============================================================================
// Component Loading Functions
// ============================================================================

/// Load voice style from JSON files
pub(super) fn load_voice_style(voice_style_paths: &[String], verbose: bool) -> Result<Style> {
    let bsz = voice_style_paths.len();

    // Read first file to get dimensions
    let first_file =
        File::open(&voice_style_paths[0]).context("Failed to open voice style file")?;
    let first_reader = BufReader::new(first_file);
    let first_data: VoiceStyleData = serde_json::from_reader(first_reader)?;

    let ttl_dims = &first_data.style_ttl.dims;
    let dp_dims = &first_data.style_dp.dims;

    let ttl_dim1 = ttl_dims[1];
    let ttl_dim2 = ttl_dims[2];
    let dp_dim1 = dp_dims[1];
    let dp_dim2 = dp_dims[2];

    // Pre-allocate arrays with full batch size
    let ttl_size = bsz * ttl_dim1 * ttl_dim2;
    let dp_size = bsz * dp_dim1 * dp_dim2;
    let mut ttl_flat = vec![0.0f32; ttl_size];
    let mut dp_flat = vec![0.0f32; dp_size];

    // Fill in the data
    for (i, path) in voice_style_paths.iter().enumerate() {
        let file = File::open(path).context("Failed to open voice style file")?;
        let reader = BufReader::new(file);
        let data: VoiceStyleData = serde_json::from_reader(reader)?;

        // Flatten TTL data
        let ttl_offset = i * ttl_dim1 * ttl_dim2;
        let mut idx = 0;
        for batch in &data.style_ttl.data {
            for row in batch {
                for &val in row {
                    ttl_flat[ttl_offset + idx] = val;
                    idx += 1;
                }
            }
        }

        // Flatten DP data
        let dp_offset = i * dp_dim1 * dp_dim2;
        idx = 0;
        for batch in &data.style_dp.data {
            for row in batch {
                for &val in row {
                    dp_flat[dp_offset + idx] = val;
                    idx += 1;
                }
            }
        }
    }

    let ttl_style = Array3::from_shape_vec((bsz, ttl_dim1, ttl_dim2), ttl_flat)?;
    let dp_style = Array3::from_shape_vec((bsz, dp_dim1, dp_dim2), dp_flat)?;

    if verbose {
        #[cfg(debug_assertions)]
        eprintln!("[sonelle][native][supertonic:voice] loaded_styles={bsz}");
    }

    Ok(Style {
        ttl: ttl_style,
        dp: dp_style,
    })
}

/// Load TTS components
pub(super) fn load_text_to_speech(onnx_dir: &str, use_gpu: bool) -> Result<TextToSpeech> {
    if use_gpu {
        anyhow::bail!("GPU mode is not supported yet");
    }
    let thread_count = supertonic_onnx_thread_count();
    #[cfg(debug_assertions)]
    eprintln!("[sonelle][native][supertonic:runtime] onnx_threads={thread_count}");

    let cfgs = load_cfgs(onnx_dir)?;

    let dp_path = format!("{}/duration_predictor.onnx", onnx_dir);
    let text_enc_path = format!("{}/text_encoder.onnx", onnx_dir);
    let vector_est_path = format!("{}/vector_estimator.onnx", onnx_dir);
    let vocoder_path = format!("{}/vocoder.onnx", onnx_dir);

    let dp_ort = load_cpu_session(&dp_path, thread_count)?;
    let text_enc_ort = load_cpu_session(&text_enc_path, thread_count)?;
    let vector_est_ort = load_cpu_session(&vector_est_path, thread_count)?;
    let vocoder_ort = load_cpu_session(&vocoder_path, thread_count)?;

    let unicode_indexer_path = format!("{}/unicode_indexer.json", onnx_dir);
    let text_processor = UnicodeProcessor::new(&unicode_indexer_path)?;

    Ok(TextToSpeech::new(
        cfgs,
        text_processor,
        dp_ort,
        text_enc_ort,
        vector_est_ort,
        vocoder_ort,
    ))
}

fn load_cpu_session(path: &str, thread_count: usize) -> Result<Session> {
    let builder = Session::builder()?;
    let builder = builder
        .with_intra_threads(thread_count)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let builder = builder
        .with_inter_threads(1)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let builder = builder
        .with_parallel_execution(false)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let builder = builder
        .with_memory_pattern(false)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let mut builder = builder
        .with_execution_providers([CPU::default().with_arena_allocator(false).build()])
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    Ok(builder.commit_from_file(path)?)
}

fn supertonic_onnx_thread_count() -> usize {
    bounded_onnx_thread_count(
        std::env::var("SONELLE_SUPERTONIC_ONNX_THREADS")
            .ok()
            .as_deref(),
    )
}

fn bounded_onnx_thread_count(value: Option<&str>) -> usize {
    value
        .and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|value| (1..=4).contains(value))
        .unwrap_or(1)
}

#[cfg(test)]
mod tests {
    use super::{bounded_onnx_thread_count, chunk_text, split_batched_waveforms};

    const LONG_FRENCH_PASSAGE: &str = "D'abord, si elle n'est pas entièrement nouvelle, mais ajoutée comme un membre à une autre, en sorte qu'elles forment ensemble un corps qu'on peut appeler mixte, il y a une première source de changement dans une difficulté naturelle inhérente à toutes les principautés nouvelles: c'est que les hommes aiment à changer de maître dans l'espoir d'améliorer leur sort; que cette espérance leur met les armes à la main contre le gouvernement actuel; mais qu'ensuite l'expérience leur fait voir qu'ils se sont trompés et qu'ils n'ont fait qu'empirer leur situation: conséquence inévitable d'une autre nécessité naturelle où se trouve ordinairement le nouveau prince d'accabler ses sujets, et par l'entretien de ses armées, et par une infinité d'autres charges qu'entraînent à leur suite les nouvelles conquêtes.";

    #[test]
    fn bounds_supertonic_onnx_threads() {
        assert_eq!(bounded_onnx_thread_count(None), 1);
        assert_eq!(bounded_onnx_thread_count(Some("3")), 3);
        assert_eq!(bounded_onnx_thread_count(Some("0")), 1);
        assert_eq!(bounded_onnx_thread_count(Some("8")), 1);
        assert_eq!(bounded_onnx_thread_count(Some("nope")), 1);
    }

    #[test]
    fn separates_padded_batch_waveforms_using_predicted_durations() {
        let waveforms = vec![1.0, 2.0, 0.0, 0.0, 3.0, 4.0, 5.0, 0.0];

        let separated = split_batched_waveforms(waveforms, &[0.2, 0.3], 10)
            .expect("valid batch should separate");

        assert_eq!(separated, vec![vec![1.0, 2.0], vec![3.0, 4.0, 5.0]]);
    }

    #[test]
    fn preserves_every_part_of_a_long_french_sentence() {
        let chunks = chunk_text(LONG_FRENCH_PASSAGE, Some(300));

        assert!(chunks.len() > 1);
        assert!(chunks[0].starts_with("D'abord"));
        assert!(chunks[1].starts_with("il y a une première source"));
        assert!(chunks
            .last()
            .is_some_and(|chunk| chunk.ends_with("nouvelles conquêtes.")));
        assert!(chunks.iter().all(|chunk| chunk.len() <= 300));
    }
}
