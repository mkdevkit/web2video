use base64::Engine;
use serde_json::{json, Value};

fn dashscope_origin(base: &str) -> String {
  let b = base.trim().trim_end_matches('/');
  let cut = b.split("/api/v1").next().unwrap_or(b);
  if cut.is_empty() {
    "https://dashscope.aliyuncs.com".into()
  } else {
    cut.into()
  }
}

fn edge_texts(data: &Value, fallback: &[String]) -> Vec<String> {
  let Some(arr) = data.as_array() else {
    return fallback.to_vec();
  };
  arr
    .iter()
    .enumerate()
    .map(|(i, row)| {
      if let Some(s) = row.as_str() {
        return if s.is_empty() {
          fallback.get(i).cloned().unwrap_or_default()
        } else {
          s.to_string()
        };
      }
      row
        .get("translations")
        .and_then(|t| t.get(0))
        .and_then(|t| t.get("text"))
        .and_then(|t| t.as_str())
        .or_else(|| row.get("text").and_then(|t| t.as_str()))
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| fallback.get(i).cloned().unwrap_or_default())
    })
    .collect()
}

#[tauri::command]
async fn edge_translate(texts: Vec<String>, from: String, to: String) -> Result<Vec<String>, String> {
  let client = reqwest::Client::new();
  let url = format!(
    "https://edge.microsoft.com/translate/translatetext?from={from}&to={to}&isEnterpriseClient=false"
  );
  let res = client
    .post(url)
    .header("Content-Type", "application/json")
    .json(&texts)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !res.status().is_success() {
    let hint = res.text().await.unwrap_or_default();
    return Err(format!("Edge 翻译失败 {}", hint.chars().take(120).collect::<String>()));
  }
  let data: Value = res.json().await.map_err(|e| e.to_string())?;
  Ok(edge_texts(&data, &texts))
}

async fn pack_qwen_audio(client: &reqwest::Client, audio: &Value) -> Result<Value, String> {
  if let Some(raw) = audio.get("data").and_then(|v| v.as_str()) {
    if let Some(rest) = raw.strip_prefix("data:") {
      if let Some((meta, b64)) = rest.split_once(";base64,") {
        return Ok(json!({ "audioBase64": b64, "contentType": meta }));
      }
    }
    if !raw.is_empty() {
      return Ok(json!({ "audioBase64": raw, "contentType": "audio/wav" }));
    }
  }
  let href = audio.get("url").and_then(|v| v.as_str()).unwrap_or("").trim();
  if href.is_empty() {
    return Err("千问未返回音频".into());
  }
  let file = client.get(href).send().await.map_err(|e| e.to_string())?;
  if !file.status().is_success() {
    return Err(format!("下载千问音频失败 {}", file.status()));
  }
  let ct = file
    .headers()
    .get(reqwest::header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("audio/wav")
    .split(';')
    .next()
    .unwrap_or("audio/wav")
    .to_string();
  let bytes = file.bytes().await.map_err(|e| e.to_string())?;
  let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
  Ok(json!({ "audioBase64": b64, "contentType": ct }))
}

#[tauri::command]
async fn qwen_generate(key: String, base: String, body: Value) -> Result<Value, String> {
  let text = body
    .get("text")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .trim()
    .to_string();
  if text.is_empty() {
    return Err("文本为空".into());
  }
  let voice = body.get("voice").and_then(|v| v.as_str()).unwrap_or("");
  if voice.is_empty() {
    return Err("缺少音色".into());
  }
  let model = body
    .get("model")
    .and_then(|v| v.as_str())
    .unwrap_or("qwen3-tts-vd-2026-01-26");
  let language_type = body
    .get("language_type")
    .and_then(|v| v.as_str())
    .unwrap_or("Chinese");
  let origin = dashscope_origin(&base);
  let client = reqwest::Client::new();
  let res = client
    .post(format!("{origin}/api/v1/services/aigc/multimodal-generation/generation"))
    .header("Authorization", format!("Bearer {key}"))
    .json(&json!({
      "model": model,
      "input": { "text": text, "voice": voice, "language_type": language_type }
    }))
    .send()
    .await
    .map_err(|e| e.to_string())?;
  let data: Value = res.json().await.map_err(|e| e.to_string())?;
  if data.get("code").and_then(|c| c.as_str()).is_some() {
    let msg = data.get("message").and_then(|m| m.as_str()).unwrap_or("千问 TTS 失败");
    return Err(msg.into());
  }
  let audio = data.pointer("/output/audio").cloned().unwrap_or(Value::Null);
  pack_qwen_audio(&client, &audio).await
}

#[tauri::command]
async fn qwen_customize(key: String, base: String, body: Value) -> Result<Value, String> {
  let origin = dashscope_origin(&base);
  let client = reqwest::Client::new();
  let res = client
    .post(format!("{origin}/api/v1/services/audio/tts/customization"))
    .header("Authorization", format!("Bearer {key}"))
    .json(&body)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  let data: Value = res.json().await.map_err(|e| e.to_string())?;
  if let Some(code) = data.get("code").and_then(|c| c.as_str()) {
    if !code.is_empty() {
      let msg = data.get("message").and_then(|m| m.as_str()).unwrap_or("千问音色失败");
      return Err(msg.into());
    }
  }
  Ok(data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![edge_translate, qwen_generate, qwen_customize])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
