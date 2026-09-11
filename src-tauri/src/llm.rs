// src-tauri/src/llm.rs
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::process::Command;
use log::info;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LLMQueryRequest {
    pub provider: String,     // "openrouter", "codex", "trae"
    pub model: Option<String>,
    pub prompt: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LLMQueryResponse {
    pub status: String,
    pub provider: String,
    pub model: String,
    pub reply: String,
    pub latency_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LLMProviderInfo {
    pub id: String,
    pub name: String,
    pub default_model: String,
    pub supported_models: Vec<String>,
    pub is_configured: bool,
}

pub fn list_providers() -> Vec<LLMProviderInfo> {
    vec![
        LLMProviderInfo {
            id: "openrouter".into(),
            name: "OpenRouter Universal Gateway".into(),
            default_model: "deepseek/deepseek-r1".into(),
            supported_models: vec![
                "deepseek/deepseek-r1".into(),
                "anthropic/claude-3.5-sonnet".into(),
                "openai/gpt-4o".into(),
                "meta-llama/llama-3.3-70b-instruct".into(),
                "google/gemini-2.5-flash".into(),
            ],
            is_configured: std::env::var("OPENROUTER_API_KEY").is_ok(),
        },
        LLMProviderInfo {
            id: "codex".into(),
            name: "OpenAI Codex / Platform".into(),
            default_model: "gpt-4o".into(),
            supported_models: vec![
                "gpt-4o".into(),
                "gpt-4o-mini".into(),
                "o1-mini".into(),
                "code-davinci-002".into(),
            ],
            is_configured: std::env::var("OPENAI_API_KEY").is_ok(),
        },
        LLMProviderInfo {
            id: "trae".into(),
            name: "Trae Autonomous Agent Runner".into(),
            default_model: "trae-native-agent".into(),
            supported_models: vec![
                "trae-native-agent".into(),
                "trae-coder-agent".into(),
                "trae-reasoning-agent".into(),
            ],
            is_configured: true,
        },
    ]
}

pub async fn query_llm_provider(req: LLMQueryRequest) -> Result<LLMQueryResponse, String> {
    let start_time = std::time::Instant::now();
    let provider = req.provider.to_lowercase();

    match provider.as_str() {
        "openrouter" => {
            let model = req.model.unwrap_or_else(|| "deepseek/deepseek-r1".into());
            let api_key = req.api_key
                .or_else(|| std::env::var("OPENROUTER_API_KEY").ok())
                .unwrap_or_default();

            if api_key.is_empty() {
                // Return offline simulated response if no key provided
                let latency = start_time.elapsed().as_millis() as u64;
                return Ok(LLMQueryResponse {
                    status: "ok".into(),
                    provider: "openrouter".into(),
                    model: model.clone(),
                    reply: format!("[OpenRouter Simulator // {}]\nQuery acknowledged: \"{}\"\nTo enable live completions, set OPENROUTER_API_KEY in environment or Settings.", model, req.prompt),
                    latency_ms: latency,
                });
            }

            let payload = json!({
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are Omnia-Vault's internal AI copilot assisting with network mesh operations, SCION routing, and system optimization."},
                    {"role": "user", "content": req.prompt}
                ]
            });

            let reply = execute_curl_post(
                "https://openrouter.ai/api/v1/chat/completions",
                &api_key,
                &payload.to_string(),
            ).await?;

            let latency = start_time.elapsed().as_millis() as u64;
            Ok(LLMQueryResponse {
                status: "ok".into(),
                provider: "openrouter".into(),
                model,
                reply,
                latency_ms: latency,
            })
        },
        "codex" => {
            let model = req.model.unwrap_or_else(|| "gpt-4o".into());
            let api_key = req.api_key
                .or_else(|| std::env::var("OPENAI_API_KEY").ok())
                .unwrap_or_default();

            if api_key.is_empty() {
                let latency = start_time.elapsed().as_millis() as u64;
                return Ok(LLMQueryResponse {
                    status: "ok".into(),
                    provider: "codex".into(),
                    model: model.clone(),
                    reply: format!("[OpenAI Codex Simulator // {}]\nCode analysis request: \"{}\"\nTo enable live OpenAI completions, provide an OPENAI_API_KEY in Settings.", model, req.prompt),
                    latency_ms: latency,
                });
            }

            let payload = json!({
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are OpenAI Codex integrated into Omnia-Vault desktop environment."},
                    {"role": "user", "content": req.prompt}
                ]
            });

            let reply = execute_curl_post(
                "https://api.openai.com/v1/chat/completions",
                &api_key,
                &payload.to_string(),
            ).await?;

            let latency = start_time.elapsed().as_millis() as u64;
            Ok(LLMQueryResponse {
                status: "ok".into(),
                provider: "codex".into(),
                model,
                reply,
                latency_ms: latency,
            })
        },
        "trae" => {
            let model = req.model.unwrap_or_else(|| "trae-native-agent".into());
            let latency = start_time.elapsed().as_millis() as u64;
            
            // Trae agent protocol response
            let response_text = format!(
                "[Trae Autonomous Agent Bridge // {}]\nInstruction received: \"{}\"\nAgent State: Active | Supervisor: ~/.trae/argv.json | Target: Omnia Multi-Node Mesh.",
                model, req.prompt
            );

            Ok(LLMQueryResponse {
                status: "ok".into(),
                provider: "trae".into(),
                model,
                reply: response_text,
                latency_ms: latency,
            })
        },
        _ => Err(format!("Unsupported provider: {}. Available: openrouter, codex, trae", provider)),
    }
}

async fn execute_curl_post(url: &str, auth_token: &str, json_body: &str) -> Result<String, String> {
    info!("Dispatching curl request to {}", url);
    let output = Command::new("curl")
        .arg("-s")
        .arg("-X").arg("POST")
        .arg(url)
        .arg("-H").arg("Content-Type: application/json")
        .arg("-H").arg(format!("Authorization: Bearer {}", auth_token))
        .arg("-d").arg(json_body)
        .output()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("curl error: {}", err));
    }

    let body = String::from_utf8_lossy(&output.stdout);
    let parsed: Value = serde_json::from_str(&body)
        .map_err(|e| format!("JSON parse error on response: {} (Body: {})", e, body))?;

    if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
        if let Some(first) = choices.get(0) {
            if let Some(content) = first.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_str()) {
                return Ok(content.to_string());
            }
        }
    }

    if let Some(err) = parsed.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()) {
        return Err(format!("Provider error: {}", err));
    }

    Ok(body.to_string())
}
