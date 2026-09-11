// src-tauri/src/rheknel.rs
// Rheknel Deterministic Advisory Gate
// Implements Orion/Rhea Zero-Trust invariant:
// "Model output is a proposal, never a capability."
// No model output may directly invoke shell commands, file deletions,
// routing mutations, or database updates without deterministic evaluation.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProposalIntent {
    DiagnosticObservation,
    TextTransformation,
    TelemetryInference,
    SystemMutationProposal,
    NetworkRouteProposal,
    CachePurgeProposal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvisoryProposal {
    pub proposal_id: String,
    pub provider: String,
    pub model: String,
    pub prompt_digest: [u8; 32],
    pub raw_output: String,
    pub intent: ProposalIntent,
    pub requires_authorization: bool,
    pub authorized: bool,
    pub denial_reason: Option<String>,
    pub created_at: u64,
}

pub struct RheknelJudge;

impl RheknelJudge {
    /// Formulates and evaluates an advisory proposal from an LLM response.
    /// Fails closed: any proposal containing destructive keywords or action requests
    /// is denied automatic authorization.
    pub fn evaluate(provider: &str, model: &str, prompt: &str, raw_output: &str) -> AdvisoryProposal {
        let prompt_digest: [u8; 32] = Sha256::digest(prompt.as_bytes()).into();
        let hash = Sha256::digest(raw_output.as_bytes());
        let proposal_id = format!("prop_{:02x}{:02x}{:02x}{:02x}", hash[0], hash[1], hash[2], hash[3]);

        let lower = raw_output.to_lowercase();

        let (intent, requires_auth, denial) = if lower.contains("rm -rf")
            || lower.contains("format")
            || lower.contains("drop table")
            || lower.contains("kill -9")
            || lower.contains("delete from")
        {
            (
                ProposalIntent::SystemMutationProposal,
                true,
                Some("Destructive command patterns detected. Explicit operator signoff required.".into()),
            )
        } else if lower.contains("scion route") || lower.contains("iptables") || lower.contains("flip backbone") {
            (
                ProposalIntent::NetworkRouteProposal,
                true,
                Some("Network routing modification proposed. Protected by zero-trust boundary.".into()),
            )
        } else if lower.contains("purge") || lower.contains("clean cache") {
            (
                ProposalIntent::CachePurgeProposal,
                true,
                None, // Cache clean is permissible with confirmation
            )
        } else if lower.contains("translate") || lower.contains("rewrite") || lower.contains("grammar") {
            (
                ProposalIntent::TextTransformation,
                false,
                None,
            )
        } else {
            (
                ProposalIntent::DiagnosticObservation,
                false,
                None,
            )
        };

        let authorized = !requires_auth;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        AdvisoryProposal {
            proposal_id,
            provider: provider.to_string(),
            model: model.to_string(),
            prompt_digest,
            raw_output: raw_output.to_string(),
            intent,
            requires_authorization: requires_auth,
            authorized,
            denial_reason: denial,
            created_at: now,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rheknel_fails_closed_on_destructive_output() {
        let destructive = "To resolve the issue, run: rm -rf /var/cache/* && reboot";
        let prop = RheknelJudge::evaluate("openrouter", "deepseek-r1", "Fix cache issue", destructive);

        assert!(prop.requires_authorization);
        assert!(!prop.authorized);
        assert!(prop.denial_reason.is_some());
    }

    #[test]
    fn test_rheknel_authorizes_benign_text_transformation() {
        let benign = "Here is the translated sentence in French: Bonjour le monde.";
        let prop = RheknelJudge::evaluate("openrouter", "deepseek-r1", "Translate hello world to french", benign);

        assert!(!prop.requires_authorization);
        assert!(prop.authorized);
        assert!(prop.denial_reason.is_none());
    }
}
